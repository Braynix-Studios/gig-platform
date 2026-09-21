'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from '@/lib/session';
import {
  getSubmissionById,
  getTaskById,
  getRepositoryById,
  getFullProfile,
  updateSubmissionStatus,
  createContribution,
  setClaimStatus,
  creditReward,
  releaseReward,
  updateTaskStatus,
  expireOtherClaimsForTask,
  getClaimById,
} from '@/lib/db-operations';

interface GitHubPRInfo {
  merged: boolean;
  state: string;
  head: { repo: { full_name: string } | null };
  user: { id?: number | string; login: string } | null;
  number: number;
  title?: string;
  body?: string | null;
  created_at?: string;
  merge_commit_sha?: string | null;
}

async function fetchGitHubPR(owner: string, repo: string, prNumber: string): Promise<GitHubPRInfo | null> {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GIG-Platform/1.0',
      },
      next: { revalidate: 0 }, // no cache
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export interface BusinessReviewState {
  ok: boolean;
  message?: string;
}

export async function reviewSubmissionAction(
  _prevState: BusinessReviewState,
  formData: FormData,
): Promise<BusinessReviewState> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, message: 'Sign in to review submissions.' };
  }
  if (session.role !== 'business') {
    return { ok: false, message: 'Only business sponsors can review submissions.' };
  }

  const submissionId = formData.get('submissionId');
  const decision = formData.get('decision');
  if (typeof submissionId !== 'string' || !submissionId) {
    return { ok: false, message: 'Missing submission reference.' };
  }
  if (decision !== 'approve' && decision !== 'reject' && decision !== 'changes_requested') {
    return { ok: false, message: 'Invalid decision.' };
  }

  const profile = await getFullProfile(session.userId);
  const company = profile?.user?.company ?? null;
  if (!company) {
    return { ok: false, message: 'Your business profile has no company assigned.' };
  }

  const submission = await getSubmissionById(submissionId);
  if (!submission) {
    return { ok: false, message: 'Submission not found.' };
  }
  if (submission.pr_status !== 'pending') {
    return { ok: false, message: 'This submission has already been reviewed.' };
  }

  const task = await getTaskById(submission.task_id);
  if (!task) {
    return { ok: false, message: 'Linked task not found.' };
  }
  const repo = await getRepositoryById(task.repository_id);
  if (!repo || repo.owner !== company) {
    return { ok: false, message: 'This submission does not belong to your company.' };
  }

  if (decision === 'changes_requested') {
    const updated = await updateSubmissionStatus(submission.id, 'changes_requested');
    if (!updated) {
      return { ok: false, message: 'Could not update submission status or status already changed.' };
    }
    revalidatePath('/dashboard/business', 'page');
    revalidatePath('/dashboard/developer', 'page');
    return { ok: true, message: 'Changes requested. The developer retains their active claim to submit an updated PR.' };
  }

  if (decision === 'reject') {
    const updated = await updateSubmissionStatus(submission.id, 'rejected');
    if (!updated) {
      return { ok: false, message: 'Could not reject the submission or status already changed.' };
    }
    await setClaimStatus(submission.claim_id, 'expired', 'active');
    revalidatePath('/dashboard/business', 'page');
    return { ok: true, message: 'Submission rejected and the developer lock was released.' };
  }

  // --- GitHub PR verification (R1e + R1f) ---
  const prMatch = submission.pr_url?.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!prMatch) {
    return { ok: false, message: 'Submission has an invalid or missing PR URL.' };
  }
  const [, prOwner, prRepo, prNumber] = prMatch;
  // R1f: PR must belong to the task's repository
  if (prOwner.toLowerCase() !== repo.owner.toLowerCase() || prRepo.toLowerCase() !== repo.name.toLowerCase()) {
    return { ok: false, message: `PR does not belong to the task repository: ${repo.owner}/${repo.name}` };
  }

  const prInfo = await fetchGitHubPR(repo.owner, repo.name, prNumber);
  if (prInfo === null) {
    return { ok: false, message: 'PR not found on GitHub or repository is private. Ensure the PR exists and is publicly accessible.' };
  }
  if (prInfo.merged !== true) {
    return { ok: false, message: 'PR is not yet merged on GitHub. Wait for the PR to be merged before approving.' };
  }

  // 1. Author verification: PR author must match submitting developer's verified GitHub identity
  const devProfile = await getFullProfile(submission.user_id);
  const devGithubId = devProfile?.user?.github_id ? String(devProfile.user.github_id) : null;
  const devGithubHandle = devProfile?.user?.github_handle?.toLowerCase() || null;

  if (prInfo.user) {
    const prUserId = prInfo.user.id ? String(prInfo.user.id) : null;
    const prUserLogin = prInfo.user.login ? prInfo.user.login.toLowerCase() : null;

    const authorMatched =
      (devGithubId && prUserId && devGithubId === prUserId) ||
      (devGithubHandle && prUserLogin && devGithubHandle === prUserLogin);

    if (!authorMatched) {
      return {
        ok: false,
        message: `PR author (@${prInfo.user.login}) does not match the claiming developer's verified GitHub account.`,
      };
    }
  }

  // 2. Issue link verification: If task has an issue_url, PR body or title must reference that issue
  if (task.issue_url) {
    const issueMatch = task.issue_url.match(/\/issues\/(\d+)/);
    if (issueMatch) {
      const expectedIssueNum = issueMatch[1];
      const issueRefRegex = new RegExp(`(#|/issues/)${expectedIssueNum}\\b`, 'i');
      const prText = `${prInfo.title || ''} ${prInfo.body || ''}`;
      if (!issueRefRegex.test(prText)) {
        return {
          ok: false,
          message: `PR does not reference the linked task issue #${expectedIssueNum}. Ensure the PR links or closes issue #${expectedIssueNum}.`,
        };
      }
    }
  }

  // 3. Timing verification: PR created_at must be after claim.claimed_at
  const claim = await getClaimById(submission.claim_id);
  if (claim?.claimed_at && prInfo.created_at) {
    const claimTime = new Date(claim.claimed_at).getTime();
    const prCreateTime = new Date(prInfo.created_at).getTime();
    // Allow up to 1 minute clock skew buffer
    if (prCreateTime < claimTime - 60000) {
      return {
        ok: false,
        message: 'PR was created before the issue was claimed. Submissions must be produced during an active claim.',
      };
    }
  }
  // --- End GitHub verification ---

  const updated = await updateSubmissionStatus(submission.id, 'merged', 'pending');
  if (!updated) {
    return { ok: false, message: 'Could not mark the submission as merged or status already changed.' };
  }

  const issueNumMatch = task.issue_url ? task.issue_url.match(/\/issues\/(\d+)/) : null;
  const contribution = await createContribution({
    user_id: submission.user_id,
    task_id: submission.task_id,
    submission_id: submission.id,
    status: 'verified',
    reviewer: company,
    merged_at: new Date().toISOString(),
    github_repo_id: repo.github_repo_id || `${repo.owner}/${repo.name}`,
    github_issue_number: issueNumMatch ? parseInt(issueNumMatch[1], 10) : null,
    pr_number: prInfo.number ? Number(prInfo.number) : (prNumber ? parseInt(prNumber, 10) : null),
    pr_author_github_id: prInfo.user?.id ? String(prInfo.user.id) : devGithubId,
    merge_commit_sha: prInfo.merge_commit_sha || null,
    verification_source: 'github_api',
  });
  if (!contribution) {
    return { ok: false, message: 'Could not record the verified contribution.' };
  }

  const amount = task.reward_amount ?? 0;
  const payout = await creditReward({
    user_id: submission.user_id,
    task_id: submission.task_id,
    amount,
    currency: task.reward_currency || 'INR',
    contribution_id: contribution.id,
  });
  if (!payout.ok) {
    return { ok: false, message: `PR verified but payout failed: ${payout.error}` };
  }

  // Advance reward from PENDING → AVAILABLE after business verification.
  // The creditReward() call created a PENDING wallet_transaction; releaseReward()
  // atomically transitions it to AVAILABLE and credits available_balance.
  if (payout.transactionId) {
    const released = await releaseReward({ transactionId: payout.transactionId }, supabaseAdmin);
    if (!released.ok) {
      return {
        ok: false,
        message: `PR verified and reward queued, but release failed: ${released.error}`,
      };
    }
  }

  await setClaimStatus(submission.claim_id, 'completed');
  // Competitive racing resolution: mark task completed and expire competitor claims
  await updateTaskStatus(task.id, 'closed', 'open');
  await expireOtherClaimsForTask(task.id, submission.claim_id);

  revalidatePath('/dashboard/business', 'page');
  revalidatePath('/dashboard/developer', 'page');
  return { ok: true, message: `PR approved — reward of ${amount} ${task.reward_currency || 'INR'} released to available balance.` };
}