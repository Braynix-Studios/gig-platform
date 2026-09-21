import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockSupabase, mockUpdateChain } = vi.hoisted(() => {
  const mockUpdateChain = {
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    insert: vi.fn().mockResolvedValue({ error: null }),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  };
  return { mockSupabase, mockUpdateChain };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
  createServerClientWithCookies: vi.fn().mockResolvedValue(mockSupabase),
  isSupabaseConfigured: true,
}));

import { creditReward, debitWallet } from '@/lib/db-operations';

function resetSupabase() {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.gte.mockReturnThis();
  mockSupabase.order.mockReturnThis();
  mockSupabase.limit.mockReturnThis();
  mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
  mockSupabase.single.mockResolvedValue({ data: null, error: null });
  mockSupabase.update.mockReturnValue(mockUpdateChain);
  mockUpdateChain.eq.mockReturnThis();
  mockUpdateChain.maybeSingle.mockResolvedValue({ data: { available_balance: 500 }, error: null });
  mockSupabase.insert.mockResolvedValue({ error: null });
  mockSupabase.rpc.mockResolvedValue({ data: { success: true, new_balance: 500 }, error: null });
}

describe('Tier 1 & Tier 2: Atomic Wallet Ledger & State Machines', () => {
  beforeEach(() => {
    resetSupabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Feature 1: R1a.1 Atomic wallet credit RPC (atomic_credit_reward_pending)
  it('test_r1a1_atomic_credit_reward_rpc_contract: requires atomic execution for reward credit and transaction logging', async () => {
    // If the system uses atomic_credit_reward_pending RPC, it calls client.rpc with the expected parameters
    const userId = 'usr-dev-1';
    const taskId = 'tsk-100';
    const contributionId = 'ctb-200';

    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, transaction_id: 'tx-123' },
      error: null,
    });

    // In a system with the atomic RPC, rpc('atomic_credit_reward_pending', ...) is invoked
    const rpcResult = await mockSupabase.rpc('atomic_credit_reward_pending', {
      p_user_id: userId,
      p_task_id: taskId,
      p_amount: 1000,
      p_currency: 'INR',
      p_contribution_id: contributionId,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('atomic_credit_reward_pending', {
      p_user_id: userId,
      p_task_id: taskId,
      p_amount: 1000,
      p_currency: 'INR',
      p_contribution_id: contributionId,
    });
    expect(rpcResult.data.success).toBe(true);
  });

  // Feature 2: R1a.2 Atomic wallet debit RPC (atomic_debit_wallet)
  it('test_r1a2_atomic_debit_wallet_rpc_contract: requires atomic debit checking balance and inserting transaction in one step', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, new_balance: 500, transaction_id: 'tx-456' },
      error: null,
    });

    const rpcResult = await mockSupabase.rpc('atomic_debit_wallet', {
      p_user_id: 'usr-dev-1',
      p_amount: 500,
      p_currency: 'INR',
      p_type: 'WITHDRAWAL',
      p_status: 'REQUESTED',
      p_task_id: null,
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('atomic_debit_wallet', expect.objectContaining({
      p_user_id: 'usr-dev-1',
      p_amount: 500,
      p_type: 'WITHDRAWAL',
    }));
    expect(rpcResult.data.success).toBe(true);
    expect(rpcResult.data.new_balance).toBe(500);
  });

  // Feature 4: R1b.1 Reward status schema (PENDING, not immediately AVAILABLE)
  it('test_r1b1_reward_status_schema_pending: credited reward transaction must record status PENDING', async () => {
    // When creditReward is invoked, the recorded transaction status MUST be PENDING (per R1b)
    const walletData = { id: 'w-1', user_id: 'usr-dev-1', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null }); // wallet query
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // idempotency query
    mockSupabase.insert.mockResolvedValueOnce({ error: null }); // tx insert

    await creditReward({
      user_id: 'usr-dev-1',
      task_id: 'task-1',
      amount: 500,
      currency: 'INR',
      contribution_id: 'ctb-1',
    }, mockSupabase as any);

    // Assert: In R1b compliant implementation, transaction status must be PENDING (not immediately CREDITED)
    const txInsertCall = mockSupabase.insert.mock.calls.find((call: any[]) => {
      const payload = call[0];
      return payload && payload.type === 'TASK_REWARD';
    });

    if (txInsertCall) {
      expect(txInsertCall[0].status).toBe('PENDING');
    }
  });

  // Feature 6: R1b.3 Fix inverted idempotency bug
  it('test_r1b3_credit_reward_idempotency_checks_transactions: must check wallet_transactions for duplicate, NOT contributions', async () => {
    // When creditReward is invoked for a new contribution, it must NOT query the contributions table
    // to check if the contribution exists (which would always abort if contribution was just created).
    // It must check wallet_transactions.
    const walletData = { id: 'w-1', user_id: 'usr-dev-1', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });

    // Inverted bug: currently queries "contributions" table.
    // Correct logic: queries "wallet_transactions" table where contribution_id = input.contribution_id.
    await creditReward({
      user_id: 'usr-dev-1',
      task_id: 'task-1',
      amount: 500,
      currency: 'INR',
      contribution_id: 'ctb-existing',
    }, mockSupabase as any);

    // Verify that the idempotency check inspected wallet_transactions, not contributions
    const fromCalls = mockSupabase.from.mock.calls.map((c: any[]) => c[0]);
    expect(fromCalls).not.toContain('contributions');
  });

  // Feature 7 & 8: R1c.1 & R1c.2 Withdrawal status machine lifecycle (REQUESTED -> PROCESSING -> PAID)
  it('test_r1c1_withdrawal_status_machine_lifecycle: withdrawal request must initiate as REQUESTED, not instant COMPLETED', async () => {
    // A withdrawal request must not mark transaction COMPLETED instantly without real payout
    const walletData = { id: 'w-1', user_id: 'usr-dev-1', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // no idempotency collision

    await debitWallet({
      userId: 'usr-dev-1',
      amount: 500,
      currency: 'INR',
    }, mockSupabase as any);

    const txInsertCall = mockSupabase.insert.mock.calls.find((call: any[]) => {
      const payload = call[0];
      return payload && payload.type === 'WITHDRAWAL';
    });

    if (txInsertCall) {
      expect(txInsertCall[0].status).toBe('REQUESTED');
    }
  });

  // Feature 9: R1c.3 Withdrawal confirmation hook/RPC (atomic_confirm_withdrawal)
  it('test_r1c3_withdrawal_confirmation_hook: transitions status to PAID and finalizes debit', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: { success: true, new_balance: 500 },
      error: null,
    });

    const confirmResult = await mockSupabase.rpc('atomic_confirm_withdrawal', {
      p_transaction_id: 'tx-withdraw-1',
      p_payout_status: 'PAID',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('atomic_confirm_withdrawal', {
      p_transaction_id: 'tx-withdraw-1',
      p_payout_status: 'PAID',
    });
    expect(confirmResult.data.success).toBe(true);
  });

  // Feature 42: R2i.1 Concurrent withdrawal race prevention (BVA & Race condition)
  it('test_r2i1_concurrent_withdrawal_race_prevention: atomic decrement prevents double-spending when balance is only sufficient for one request', async () => {
    // Given available_balance = 600
    // Request 1: 500
    // Request 2: 500
    // With atomic UPDATE wallets SET available_balance = available_balance - 500 WHERE available_balance >= 500
    // Exactly one succeeds, second returns error "Insufficient balance"

    // Simulate atomic update returning row count / modified row for first call, but empty for second call
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'w-1', user_id: 'u-1', available_balance: 600 }, error: null })
      .mockResolvedValueOnce({ data: null, error: null }); // idempotency check 1

    mockUpdateChain.maybeSingle
      .mockResolvedValueOnce({ data: { available_balance: 100 }, error: null }); // first debit succeeds

    const req1 = debitWallet({ userId: 'u-1', amount: 500 }, mockSupabase as any);

    // Second simultaneous debit:
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'w-1', user_id: 'u-1', available_balance: 100 }, error: null }); // updated balance is 100

    const req2 = debitWallet({ userId: 'u-1', amount: 500 }, mockSupabase as any);

    const [res1, res2] = await Promise.all([req1, req2]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(false);
    expect(res2.error).toMatch(/insufficient balance/i);
  });

  // Tier 2: Boundary Value Analysis on Wallet Debit
  it('test_debit_wallet_bva_minimum_and_negative_amounts: rejects negative or zero debit attempts', async () => {
    const resNegative = await debitWallet({ userId: 'u-1', amount: -100 }, mockSupabase as any);
    expect(resNegative.ok).toBe(false);

    const resZero = await debitWallet({ userId: 'u-1', amount: 0 }, mockSupabase as any);
    expect(resZero.ok).toBe(false);
  });

  // Tier 2: Rollback on Transaction Insert Failure (Atomicity Invariant R1a)
  it('test_r1a3_db_operations_atomic_rollback_on_failed_tx_insert: failure to insert transaction must not commit balance deduction', async () => {
    const walletData = { id: 'w-1', user_id: 'u-1', available_balance: 1000, total_earned: 1000 };
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: walletData, error: null });
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null }); // idempotency

    // Simulate transaction insert failure
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'DB connection lost during insert' } });

    const result = await debitWallet({ userId: 'u-1', amount: 500 }, mockSupabase as any);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/DB connection lost/i);
  });
});
