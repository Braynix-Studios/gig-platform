import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockSupabase, mockUpdateChain } = vi.hoisted(() => {
  const mockUpdateChain = {
    eq: vi.fn().mockResolvedValue({ error: null }),
  };
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
  return { mockSupabase, mockUpdateChain };
});

vi.mock('../lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
  createServerClientWithCookies: vi.fn().mockResolvedValue(mockSupabase),
  // lib/session.ts reads this flag before delegating to supabaseAuth;
  // omitting it throws and turns every route test into a 500.
  isSupabaseConfigured: true,
}));

vi.mock('../lib/supabaseAuth', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'test-user-id' }),
}));

import * as supabaseClientModule from '../lib/supabaseClient';
import * as supabaseAuthModule from '../lib/supabaseAuth';
import { debitWallet } from '../lib/db-operations';
import { POST } from '../app/api/wallet/withdrawal/route';

type MockSupabase = typeof mockSupabase;

type MockSupabaseClientModule = {
  supabase: MockSupabase | null;
  supabaseAdmin: MockSupabase | null;
  createServerClientWithCookies: ReturnType<typeof vi.fn>;
  isSupabaseConfigured: boolean;
};

type MockSupabaseAuthModule = {
  getSession: ReturnType<typeof vi.fn>;
};

const mockSupabaseClient = supabaseClientModule as unknown as MockSupabaseClientModule;
const mockSupabaseAuth = supabaseAuthModule as unknown as MockSupabaseAuthModule;

function resetSupabaseMocks() {
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockSupabase.update.mockReturnValue(mockUpdateChain);
  mockUpdateChain.eq.mockResolvedValue({ error: null });
  mockSupabase.insert.mockResolvedValue({ error: null });
  mockSupabaseClient.supabase = mockSupabase;
  mockSupabaseClient.supabaseAdmin = mockSupabase;
  mockSupabaseClient.createServerClientWithCookies.mockResolvedValue(mockSupabase);
  mockSupabaseAuth.getSession.mockResolvedValue({ userId: 'test-user-id' });
}

describe('debitWallet function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should succeed with valid user and sufficient balance', async () => {
    const walletData = { id: 'wallet-1', user_id: 'test-user-id', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
    mockSupabase.insert.mockResolvedValueOnce({ error: null });

    const result = await debitWallet({ userId: 'test-user-id', amount: 500 });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(mockSupabase.from).toHaveBeenCalledWith('wallets');
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    expect(mockSupabase.update).toHaveBeenCalledWith({
      available_balance: 500,
    });
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_id: 'wallet-1',
        amount: -500,
        type: 'WITHDRAWAL',
        status: 'COMPLETED',
      })
    );
  });

  it('should return error for insufficient balance', async () => {
    const walletData = { id: 'wallet-1', user_id: 'test-user-id', available_balance: 300, total_earned: 300 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });

    const result = await debitWallet({ userId: 'test-user-id', amount: 500 });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Insufficient balance');
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it('should return error for wallet not found', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await debitWallet({ userId: 'test-user-id', amount: 500 });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Wallet not found');
    expect(mockSupabase.update).not.toHaveBeenCalled();
    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it('should return error for no database client', async () => {
    mockSupabaseClient.supabase = null;
    mockSupabaseClient.supabaseAdmin = null;

    const result = await debitWallet({ userId: 'test-user-id', amount: 500 });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('No database client');
  });
});

describe('Withdrawal API endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should return 200 for successful withdrawal', async () => {
    mockSupabaseAuth.getSession.mockResolvedValueOnce({ userId: 'test-user-id' });
    const walletData = { id: 'wallet-1', user_id: 'test-user-id', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
    mockSupabase.insert.mockResolvedValueOnce({ error: null });

    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
  });

  it('should return 401 for unauthorized (no session)', async () => {
    mockSupabaseAuth.getSession.mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe('Unauthorized');
  });

  it('should return 400 for invalid amount (non-numeric)', async () => {
    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 'abc' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Amount must be a valid number');
  });

  it('should return 400 for amount less than 500', async () => {
    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Minimum withdrawal amount is 500');
  });

  it('should return 400 for insufficient balance from debitWallet', async () => {
    mockSupabaseAuth.getSession.mockResolvedValueOnce({ userId: 'test-user-id' });
    const walletData = { id: 'wallet-1', user_id: 'test-user-id', available_balance: 300, total_earned: 300 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });

    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Insufficient balance');
  });

  it('should return 400 for wallet not found', async () => {
    mockSupabaseAuth.getSession.mockResolvedValueOnce({ userId: 'test-user-id' });
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Wallet not found');
  });

  it('should return 500 for internal error (Supabase misconfiguration)', async () => {
    mockSupabaseClient.createServerClientWithCookies.mockResolvedValueOnce(null);

    const request = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Supabase is not configured');
  });

  it('test_r2i1_concurrent_withdrawal_race: concurrent withdrawals cannot overdraw wallet balance', async () => {
    mockSupabaseAuth.getSession.mockResolvedValue({ userId: 'test-user-id' });
    // Wallet has balance 600. Two simultaneous withdrawals of 500.
    const walletData = { id: 'wallet-1', user_id: 'test-user-id', available_balance: 600, total_earned: 600 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });

    const req1 = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(200);

    // Second simultaneous request sees reduced balance (100) or atomic lock fail
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { ...walletData, available_balance: 100 },
      error: null,
    });

    const req2 = new Request('http://localhost/api/wallet/withdrawal', {
      method: 'POST',
      body: JSON.stringify({ amount: 500 }),
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(400);
    const json2 = await res2.json();
    expect(json2.error).toMatch(/insufficient balance/i);
  });
});

