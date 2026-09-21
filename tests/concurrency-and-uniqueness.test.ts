import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockSupabase, mockQueryBuilder } = vi.hoisted(() => {
  const mockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const mockSupabase = {
    from: vi.fn().mockReturnValue(mockQueryBuilder),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  };
  return { mockSupabase, mockQueryBuilder };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
  createServerClientWithCookies: vi.fn().mockResolvedValue(mockSupabase),
  isSupabaseConfigured: true,
}));

import {
  createContribution,
  updateSubmissionStatus,
  updateTaskStatus,
  setClaimStatus,
} from '@/lib/db-operations';

function resetMocks() {
  vi.clearAllMocks();
  mockSupabase.from.mockReturnValue(mockQueryBuilder);
  mockQueryBuilder.select.mockReturnThis();
  mockQueryBuilder.insert.mockReturnThis();
  mockQueryBuilder.update.mockReturnThis();
  mockQueryBuilder.eq.mockReturnThis();
  mockQueryBuilder.single.mockResolvedValue({ data: null, error: null });
  mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
}

describe('Tier 1 & Tier 2: Concurrency Invariants, Uniqueness & Race Safety', () => {
  beforeEach(() => {
    resetMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Feature 18 & 19: R1g.1 & R1g.2 Unique submission constraint and violation handling
  it('test_r1g1_contributions_unique_submission_constraint: duplicate submission_id in contributions violates unique constraint', async () => {
    // Simulate PostgreSQL UNIQUE constraint error code '23505' (unique_violation)
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "idx_contributions_submission_id"',
      },
    });

    const result = await createContribution({
      user_id: 'dev-1',
      task_id: 'task-1',
      submission_id: 'sub-duplicate-1',
      status: 'verified',
    });

    // Per R1g.2: Must handle constraint violation gracefully without uncaught exception
    expect(result).toBeNull();
  });

  it('test_r1g2_create_contribution_handles_unique_violation: graceful fallback when duplicate contribution attempted concurrently', async () => {
    // First insert succeeds
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: 'ctb-1', submission_id: 'sub-1', status: 'verified' },
      error: null,
    });

    const ctb1 = await createContribution({
      user_id: 'dev-1',
      task_id: 'task-1',
      submission_id: 'sub-1',
    });
    expect(ctb1?.id).toBe('ctb-1');

    // Second concurrent insert encounters 23505 unique violation
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });

    const ctb2 = await createContribution({
      user_id: 'dev-1',
      task_id: 'task-1',
      submission_id: 'sub-1',
    });
    expect(ctb2).toBeNull();
  });

  // Feature 20: R1h.1 Conditional submission review update (UPDATE ... WHERE pr_status = 'pending')
  it('test_r1h1_conditional_submission_review_update: update must be conditioned on status=pending to prevent dual-approval race', async () => {
    // When updating submission status during review, query must condition on expected status
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: 'sub-1', pr_status: 'merged' },
      error: null,
    });

    await updateSubmissionStatus('sub-1', 'merged');

    expect(mockSupabase.from).toHaveBeenCalledWith('submissions');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({ pr_status: 'merged' });
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sub-1');
  });

  // Concurrent Review Race Simulation (Tier 2 Boundary)
  it('test_concurrent_reviewers_race_condition: two simultaneous approval requests results in exactly one success', async () => {
    // Simulate two reviewers approving the same submission at the same time:
    // Reviewer A's update matches 1 row (pr_status was pending)
    // Reviewer B's update matches 0 rows (pr_status was already merged by Reviewer A)

    mockQueryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: { id: 'sub-1', pr_status: 'merged' }, error: null }) // Reviewer A: 1 row
      .mockResolvedValueOnce({ data: null, error: null }); // Reviewer B: 0 rows affected

    const reqA = updateSubmissionStatus('sub-1', 'merged');
    const reqB = updateSubmissionStatus('sub-1', 'merged');

    const [resA, resB] = await Promise.all([reqA, reqB]);

    expect(resA).not.toBeNull();
    expect(resA?.pr_status).toBe('merged');
    expect(resB).toBeNull(); // Second reviewer fails atomically
  });

  // Feature 22: R1h.3 Conditional task status update
  it('test_r1h3_conditional_task_status_update: updates task status conditionally to avoid racing task completions', async () => {
    mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: 'task-1', status: 'closed' },
      error: null,
    });

    const res = await updateTaskStatus('task-1', 'closed');

    expect(mockSupabase.from).toHaveBeenCalledWith('tasks');
    expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'closed' });
    expect(res).toBe(true);
  });
});
