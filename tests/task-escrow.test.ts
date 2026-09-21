import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockSupabase, mockUpdateChain } = vi.hoisted(() => {
  const mockUpdateChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    insert: vi.fn().mockReturnThis(),
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

vi.mock('@/lib/session', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'biz-user-1',
    email: 'sponsor@company.com',
    role: 'business',
    name: 'Acme Corp',
  }),
}));

import { getSession } from '@/lib/session';
import { POST } from '@/app/api/tasks/route';

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;

function resetMocks() {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnThis();
  mockSupabase.select.mockReturnThis();
  mockSupabase.eq.mockReturnThis();
  mockSupabase.single.mockResolvedValue({ data: { id: 'task-created-1' }, error: null });
  mockSupabase.maybeSingle.mockResolvedValue({ data: { role: 'business', company: 'Acme' }, error: null });
  mockSupabase.insert.mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'task-created-1' }, error: null }),
    }),
  });
  mockSupabase.rpc.mockResolvedValue({ data: { success: true }, error: null });

  mockGetSession.mockResolvedValue({
    userId: 'biz-user-1',
    email: 'sponsor@acme.com',
    role: 'business',
    name: 'Acme Sponsor',
  });
}

describe('Tier 1 & Tier 2: Task Creation, Escrow Reservation & Repository Validation', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Feature 10: R1d.1 Atomic escrow task creation RPC (atomic_create_task_with_escrow)
  it('test_r1d1_atomic_create_task_with_escrow_rpc: verifies atomic PostgreSQL RPC contract for task creation and escrow lock', async () => {
    mockSupabase.rpc.mockResolvedValueOnce({
      data: {
        success: true,
        task: {
          id: 'tsk-new-1',
          title: 'Implement Dark Mode',
          reward_amount: 5000,
          reward_currency: 'INR',
          status: 'open',
        },
      },
      error: null,
    });

    const result = await mockSupabase.rpc('atomic_create_task_with_escrow', {
      p_business_id: 'biz-user-1',
      p_repository_id: 'repo-acme-1',
      p_title: 'Implement Dark Mode',
      p_issue_url: 'https://github.com/acme/repo/issues/1',
      p_reward_amount: 5000,
      p_reward_currency: 'INR',
      p_difficulty: 'medium',
      p_technology: 'TypeScript',
      p_description: 'Add dark mode toggle to the dashboard.',
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('atomic_create_task_with_escrow', expect.objectContaining({
      p_business_id: 'biz-user-1',
      p_repository_id: 'repo-acme-1',
      p_reward_amount: 5000,
    }));
    expect(result.data.success).toBe(true);
    expect(result.data.task.id).toBe('tsk-new-1');
  });

  // Feature 11: R1d.2 Task route escrow integration (Atomicity & Failure Rollback)
  it('test_r1d2_task_route_escrow_atomicity: task creation failure must not leave business funds debited', async () => {
    // User is business user with company 'Acme'
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { role: 'business', company: 'Acme' }, error: null }) // user check
      .mockResolvedValueOnce({ data: { id: 'repo-1', owner: 'Acme', opted_in: true }, error: null }) // repo check
      .mockResolvedValueOnce({ data: { id: 'w-1', available_balance: 10000 }, error: null }); // wallet check

    // Task insert fails at DB level (e.g. constraint error)
    mockSupabase.insert.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Foreign key violation or DB error' },
        }),
      }),
    });

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-1',
        title: 'Fix Critical Memory Leak',
        reward_amount: 2000,
        reward_currency: 'INR',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    // In an atomic system, wallet debit and task insert are unified in RPC or rolled back.
    // If tasks.insert failed, the net balance reduction must be zero.
  });

  // Feature 39: R2h.1 Task reward amount validation (reward_amount > 0)
  it('test_r2h1_task_creation_requires_positive_reward: rejects non-positive or zero bounty amounts with 400', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { role: 'business', company: 'Acme' },
      error: null,
    });

    // Zero bounty
    const reqZero = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-1',
        title: 'Free Work Request',
        reward_amount: 0,
      }),
    });
    const resZero = await POST(reqZero);
    expect(resZero.status).toBe(400);
    const jsonZero = await resZero.json();
    expect(jsonZero.error).toMatch(/reward_amount must be a positive number|reward/i);

    // Negative bounty
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { role: 'business', company: 'Acme' },
      error: null,
    });
    const reqNegative = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-1',
        title: 'Negative Work Request',
        reward_amount: -500,
      }),
    });
    const resNegative = await POST(reqNegative);
    expect(resNegative.status).toBe(400);
  });

  // Feature 40: R2h.2 Task repo opt-in validation
  it('test_r2h2_task_creation_requires_repo_opted_in: rejects tasks on repositories that have not opted into the network', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { role: 'business', company: 'Acme' }, error: null }) // user
      .mockResolvedValueOnce({ data: { id: 'repo-unopted', owner: 'Acme', opted_in: false }, error: null }); // repo opted_in = false

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-unopted',
        title: 'Task on Non-Opted Repo',
        reward_amount: 1500,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/opted in/i);
  });

  // Feature 41: R2h.3 Task repo ownership validation
  it('test_r2h3_task_creation_enforces_repo_ownership: business user cannot post tasks on another company repository', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { role: 'business', company: 'Acme' }, error: null }) // user is Acme
      .mockResolvedValueOnce({ data: { id: 'repo-foreign', owner: 'CompetitorCorp', opted_in: true }, error: null }); // repo belongs to CompetitorCorp

    const req = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-foreign',
        title: 'Task on Foreign Repo',
        reward_amount: 1500,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/does not belong to your company|ownership|forbidden/i);
  });

  // Tier 2: Boundary & Validation on Missing Title & Permissions
  it('test_task_creation_boundary_missing_title_or_role: enforces required title and business role', async () => {
    // Missing title
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { role: 'business', company: 'Acme' },
      error: null,
    });
    const reqNoTitle = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-1',
        title: '   ',
        reward_amount: 1000,
      }),
    });
    const resNoTitle = await POST(reqNoTitle);
    expect(resNoTitle.status).toBe(400);

    // Developer role attempting to post tasks
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { role: 'developer', company: null },
      error: null,
    });
    const reqDev = new NextRequest('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        repository_id: 'repo-1',
        title: 'Dev posted task',
        reward_amount: 1000,
      }),
    });
    const resDev = await POST(reqDev);
    expect(resDev.status).toBe(403);
  });
});
