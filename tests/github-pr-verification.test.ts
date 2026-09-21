import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { mockDbOperations, mockSession } = vi.hoisted(() => {
  const mockSession = {
    userId: 'dev-user-1',
    email: 'dev@gig.dev',
    role: 'developer',
    name: 'Dev User',
    githubId: 'gh-12345' as string | undefined,
  };
  const mockDbOperations = {
    getTaskById: vi.fn(),
    getRepositoryById: vi.fn(),
    getActiveClaimForUserAndTask: vi.fn(),
    getActiveClaimForTask: vi.fn(),
    claimTask: vi.fn(),
    submitPR: vi.fn(),
    getSubmissionById: vi.fn(),
    getFullProfile: vi.fn(),
    updateSubmissionStatus: vi.fn(),
    createContribution: vi.fn(),
    setClaimStatus: vi.fn(),
    creditReward: vi.fn(),
    updateTaskStatus: vi.fn(),
    expireOtherClaimsForTask: vi.fn(),
    getClaimById: vi.fn(),
  };
  return { mockDbOperations, mockSession };
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db-operations', () => mockDbOperations);

import { getSession } from '@/lib/session';
import { claimIssueAction, submitPrAction } from '@/app/actions/dev-loop';
import { reviewSubmissionAction } from '@/app/actions/business-loop';

const mockGetSession = getSession as unknown as ReturnType<typeof vi.fn>;

describe('Tier 1 & Tier 2: GitHub PR Verification & Repository Binding', () => {
  let fetchSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.userId = 'dev-user-1';
    mockSession.role = 'developer';
    mockSession.githubId = 'gh-12345';
    mockGetSession.mockImplementation(async () => mockSession);

    mockDbOperations.getTaskById.mockResolvedValue({
      id: 'task-1',
      repository_id: 'repo-1',
      title: 'Fix issue #42',
      issue_url: 'https://github.com/octocat/spoon-knife/issues/42',
      status: 'open',
      reward_amount: 1000,
      reward_currency: 'INR',
    });

    mockDbOperations.getRepositoryById.mockResolvedValue({
      id: 'repo-1',
      owner: 'octocat',
      name: 'spoon-knife',
      url: 'https://github.com/octocat/spoon-knife',
      opted_in: true,
    });

    mockDbOperations.getActiveClaimForUserAndTask.mockResolvedValue({
      id: 'claim-1',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      status: 'active',
    });

    mockDbOperations.getClaimById.mockResolvedValue({
      id: 'claim-1',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      status: 'active',
      claimed_at: new Date(Date.now() - 3600000).toISOString(),
    });

    mockDbOperations.getFullProfile.mockImplementation(async (userId: string) => {
      if (userId === 'biz-1') {
        return { user: { id: 'biz-1', role: 'business', company: 'octocat' } };
      }
      return {
        user: {
          id: 'dev-user-1',
          role: 'developer',
          github_id: '12345',
          github_handle: 'octocat-dev',
        },
      };
    });

    mockDbOperations.getSubmissionById.mockResolvedValue({
      id: 'sub-1',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      claim_id: 'claim-1',
      pr_url: 'https://github.com/octocat/spoon-knife/pull/42',
      pr_number: '42',
      pr_status: 'pending',
    });

    mockDbOperations.claimTask.mockResolvedValue({
      id: 'claim-1',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      status: 'active',
    });

    mockDbOperations.submitPR.mockResolvedValue({
      id: 'sub-1',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      pr_status: 'pending',
    });

    mockDbOperations.updateSubmissionStatus.mockResolvedValue({ id: 'sub-1', pr_status: 'merged' });
    mockDbOperations.createContribution.mockResolvedValue({ id: 'ctb-1', status: 'verified' });
    mockDbOperations.creditReward.mockResolvedValue({ ok: true });

    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature 43: R2j.1 GitHub linkage check in claims
  it('test_r2j1_claim_issue_requires_github_linkage: rejects claim if developer has no linked GitHub account', async () => {
    mockSession.githubId = undefined;

    const formData = new FormData();
    formData.set('taskId', 'task-1');

    const result = await claimIssueAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/GitHub account before claiming|connect.*github|github_required/i);
    expect(mockDbOperations.claimTask).not.toHaveBeenCalled();
  });

  // Feature 16 & 17: R1f.1 & R1f.2 PR URL parser & repo matching check in submitPrAction
  it('test_r1f2_submit_pr_rejects_foreign_repository: developer cannot submit PR from unowned/different repository', async () => {
    const formData = new FormData();
    formData.set('taskId', 'task-1');
    // Task is in octocat/spoon-knife, but PR points to rogue-org/other-repo
    formData.set('prUrl', 'https://github.com/rogue-org/other-repo/pull/99');

    const result = await submitPrAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/mismatch|repository|does not belong/i);
    expect(mockDbOperations.submitPR).not.toHaveBeenCalled();
  });

  it('test_r1f1_pr_url_parser_validation: accepts valid PR URL targeting the exact task repository', async () => {
    const formData = new FormData();
    formData.set('taskId', 'task-1');
    formData.set('prUrl', 'https://github.com/octocat/spoon-knife/pull/42');

    const result = await submitPrAction({ ok: false }, formData);

    expect(result.ok).toBe(true);
    expect(mockDbOperations.submitPR).toHaveBeenCalledWith(expect.objectContaining({
      task_id: 'task-1',
      pr_url: 'https://github.com/octocat/spoon-knife/pull/42',
      pr_number: '42',
    }));
  });

  it('test_r1f1_pr_url_parser_rejects_malformed_urls: rejects non-github, invalid syntax, or missing pull number', async () => {
    const invalidUrls = [
      'https://gitlab.com/octocat/spoon-knife/pull/42',
      'https://github.com/octocat/spoon-knife/issues/42',
      'https://github.com/octocat/spoon-knife/pull/',
      'not-a-url',
      'https://github.com/octocat/spoon-knife/pull/abc',
    ];

    for (const url of invalidUrls) {
      const formData = new FormData();
      formData.set('taskId', 'task-1');
      formData.set('prUrl', url);

      const result = await submitPrAction({ ok: false }, formData);
      expect(result.ok).toBe(false);
    }
  });

  // Feature 12 & 15: R1e.1 & R1e.4 PR merged state verification via GitHub REST API
  it('test_r1e4_review_rejects_unmerged_pr: business approval must be rejected if GitHub reports merged: false', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    // Mock GitHub REST API returning PR data with merged: false
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        number: 42,
        state: 'open',
        merged: false,
        head: { ref: 'patch-1' },
        base: { repo: { full_name: 'octocat/spoon-knife' } },
      }),
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not merged|github/i);
    expect(mockDbOperations.createContribution).not.toHaveBeenCalled();
    expect(mockDbOperations.creditReward).not.toHaveBeenCalled();
  });

  // Feature 13: R1e.2 PR exists verification on review
  it('test_r1e2_review_rejects_nonexistent_pr: business approval rejected if GitHub reports 404 Not Found', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ message: 'Not Found' }),
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not found|does not exist/i);
    expect(mockDbOperations.createContribution).not.toHaveBeenCalled();
  });

  // Feature 14: R1e.3 PR repo binding verification on review
  it('test_r1e3_review_rejects_mismatched_repo_pr: business approval rejected if PR is in different repository', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    mockDbOperations.getSubmissionById.mockResolvedValueOnce({
      id: 'sub-mismatch',
      task_id: 'task-1',
      user_id: 'dev-user-1',
      claim_id: 'claim-1',
      pr_url: 'https://github.com/different-org/different-repo/pull/10',
      pr_number: '10',
      pr_status: 'pending',
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-mismatch');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/does not belong to your company|mismatch|repository/i);
  });

  // Feature: PR author verification
  it('test_r1e5_review_rejects_pr_from_different_author: business approval rejected if PR author does not match claiming developer', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    // GitHub returns PR created by attacker 'bob-hacker' instead of 'octocat-dev'
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        number: 42,
        state: 'closed',
        merged: true,
        user: { id: 99999, login: 'bob-hacker' },
        title: 'Fix issue #42',
        body: 'Closes #42',
        created_at: new Date().toISOString(),
      }),
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/PR author.*does not match/i);
    expect(mockDbOperations.createContribution).not.toHaveBeenCalled();
  });

  // Feature: Task issue ↔ PR reference verification
  it('test_r1e6_review_rejects_pr_without_linked_issue_reference: business approval rejected if PR body/title does not reference the task issue', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    // GitHub returns PR created by correct developer but implementing unrelated feature (no reference to #42)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        number: 42,
        state: 'closed',
        merged: true,
        user: { id: 12345, login: 'octocat-dev' },
        title: 'Unrelated refactor of logging',
        body: 'Resolves issue #999 instead',
        created_at: new Date().toISOString(),
      }),
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/does not reference the linked task issue #42/i);
    expect(mockDbOperations.createContribution).not.toHaveBeenCalled();
  });

  // Feature: Claim timing verification
  it('test_r1e7_review_rejects_pre_existing_pr: business approval rejected if PR was created before the issue was claimed', async () => {
    mockSession.userId = 'biz-1';
    mockSession.role = 'business';

    // GitHub returns PR created 2 days ago, but claim was created 1 hour ago
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        number: 42,
        state: 'closed',
        merged: true,
        user: { id: 12345, login: 'octocat-dev' },
        title: 'Fix issue #42',
        body: 'Closes #42',
        created_at: new Date(Date.now() - 48 * 3600000).toISOString(),
      }),
    });

    const formData = new FormData();
    formData.set('submissionId', 'sub-1');
    formData.set('decision', 'approve');

    const result = await reviewSubmissionAction({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/created before the issue was claimed/i);
    expect(mockDbOperations.createContribution).not.toHaveBeenCalled();
  });
});
