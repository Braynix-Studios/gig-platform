'use server';

import { revalidatePath } from 'next/cache';
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
  updateTaskStatus,
  expireOtherClaimsForTask,
} from '@/lib/db-operations';

interface GitHubPRInfo {
  merged: boolean;
  state: string;
  head: { repo: { full_name: string } | null };
  user: { login: string } | null;
  number: number;
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
  // --- End GitHub verification ---

  const updated = await updateSubmissionStatus(submission.id, 'merged', 'pending');
  if (!updated) {
    return { ok: false, message: 'Could not mark the submission as merged or status already changed.' };
  }

  const contribution = await createContribution({
    user_id: submission.user_id,
    task_id: submission.task_id,
    submission_id: submission.id,
    status: 'verified',
    reviewer: company,
    merged_at: new Date().toISOString(),
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

  await setClaimStatus(submission.claim_id, 'completed');
  // Competitive racing resolution: mark task completed and expire competitor claims
  await updateTaskStatus(task.id, 'closed', 'open');
  await expireOtherClaimsForTask(task.id, submission.claim_id);

  revalidatePath('/dashboard/business', 'page');
  revalidatePath('/dashboard/developer', 'page');
  return { ok: true, message: `PR approved — reward of ${amount} ${task.reward_currency || 'INR'} queued as PENDING verification.` };
}