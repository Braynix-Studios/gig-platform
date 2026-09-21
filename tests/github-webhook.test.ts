import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';

const { mockSupabase, mockDbOps } = vi.hoisted(() => {
  const mockSupabase = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    maybeSingle: vi.fn(),
  };
  const mockDbOps = {
    createContribution: vi.fn(),
    creditReward: vi.fn(),
    releaseReward: vi.fn(),
    setClaimStatus: vi.fn(),
    updateTaskStatus: vi.fn(),
    expireOtherClaimsForTask: vi.fn(),
    updateSubmissionStatus: vi.fn(),
  };
  return { mockSupabase, mockDbOps };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabase,
}));

vi.mock('@/lib/db-operations', () => mockDbOps);

import { POST } from '@/app/api/webhooks/github/route';
import { NextRequest } from 'next/server';

describe('GitHub Webhook Endpoint (/api/webhooks/github)', () => {
  const secret = 'test-webhook-secret';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = secret;

    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.ilike.mockReturnValue(mockSupabase);
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'repo-1',
        owner: 'octocat',
        name: 'spoon-knife',
        github_repo_id: 'octocat/spoon-knife',
      },
      error: null,
    });
  });

  function createSignedRequest(bodyObj: any, event: string = 'pull_request') {
    const rawBody = JSON.stringify(bodyObj);
    const signature =
      'sha256=' +
      crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return new NextRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-github-event': event,
        'x-hub-signature-256': signature,
      },
    });
  }

  it('rejects payloads with invalid HMAC signatures when secret is set', async () => {
    const rawBody = JSON.stringify({ action: 'ping' });
    const req = new NextRequest('http://localhost:3000/api/webhooks/github', {
      method: 'POST',
      body: rawBody,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'ping',
        'x-hub-signature-256': 'sha256=invalidhexsignature000000000000000000000000000000000000000000000000',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('Invalid signature');
  });

  it('responds with 200 pong for ping events', async () => {
    const req = createSignedRequest({ zen: 'Keep it logically awesome.' }, 'ping');
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('pong');
  });

  it('ignores pull_request events when PR is not merged', async () => {
    const req = createSignedRequest({
      action: 'opened',
      pull_request: { merged: false, number: 10 },
      repository: { owner: { login: 'octocat' }, name: 'spoon-knife' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toMatch(/PR not merged/i);
    expect(mockDbOps.createContribution).not.toHaveBeenCalled();
  });

  it('verifies merged PR, transitions submission, records evidence snapshot and credits pending reward', async () => {
    // Setup matching submission
    mockSupabase.eq.mockResolvedValueOnce({
      data: [
        {
          id: 'sub-1',
          task_id: 'task-1',
          user_id: 'dev-user-1',
          claim_id: 'claim-1',
          pr_url: 'https://github.com/octocat/spoon-knife/pull/42',
          pr_number: '42',
          pr_status: 'pending',
          tasks: {
            id: 'task-1',
            repository_id: 'repo-1',
            reward_amount: 500,
            reward_currency: 'INR',
            issue_url: 'https://github.com/octocat/spoon-knife/issues/42',
          },
        },
      ],
      error: null,
    });

    mockDbOps.updateSubmissionStatus.mockResolvedValueOnce({ id: 'sub-1', pr_status: 'merged' });
    mockDbOps.createContribution.mockResolvedValueOnce({ id: 'contrib-1' });
    mockDbOps.creditReward.mockResolvedValueOnce({ ok: true });

    const req = createSignedRequest({
      action: 'closed',
      pull_request: {
        number: 42,
        html_url: 'https://github.com/octocat/spoon-knife/pull/42',
        merged: true,
        merged_at: '2026-09-21T10:00:00Z',
        merge_commit_sha: 'sha-webhook-merged-999',
        user: { id: 12345, login: 'octocat-dev' },
      },
      repository: {
        owner: { login: 'octocat' },
        name: 'spoon-knife',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.contribution_id).toBe('contrib-1');

    expect(mockDbOps.createContribution).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_id: 'sub-1',
        task_id: 'task-1',
        user_id: 'dev-user-1',
        status: 'verified',
        reviewer: 'octocat',
        github_repo_id: 'octocat/spoon-knife',
        github_issue_number: 42,
        pr_number: 42,
        pr_author_github_id: '12345',
        merge_commit_sha: 'sha-webhook-merged-999',
        verification_source: 'github_webhook',
      }),
      expect.anything(),
    );

    expect(mockDbOps.creditReward).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'dev-user-1',
        task_id: 'task-1',
        amount: 500,
        currency: 'INR',
        contribution_id: 'contrib-1',
      }),
      expect.anything(),
    );

    expect(mockDbOps.setClaimStatus).toHaveBeenCalledWith('claim-1', 'completed', undefined, expect.anything());
    expect(mockDbOps.updateTaskStatus).toHaveBeenCalledWith('task-1', 'closed', 'open', expect.anything());
    expect(mockDbOps.expireOtherClaimsForTask).toHaveBeenCalledWith('task-1', 'claim-1', expect.anything());
  });
});
