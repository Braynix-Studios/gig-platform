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
  if (decision !== 'approve' && decision !== 'reject') {
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

  if (decision === 'reject') {
    const updated = await updateSubmissionStatus(submission.id, 'rejected');
    if (!updated) {
      return { ok: false, message: 'Could not reject the submission.' };
    }
    await setClaimStatus(submission.claim_id, 'expired');
    revalidatePath('/dashboard/business', 'page');
    return { ok: true, message: 'Submission rejected and the developer lock was released.' };
  }

  const updated = await updateSubmissionStatus(submission.id, 'merged');
  if (!updated) {
    return { ok: false, message: 'Could not mark the submission as merged.' };
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
  await updateTaskStatus(task.id, 'closed');
  await expireOtherClaimsForTask(task.id, submission.claim_id);

  revalidatePath('/dashboard/business', 'page');
  revalidatePath('/dashboard/developer', 'page');
  return { ok: true, message: `PR verified — ${amount} ${task.reward_currency || 'INR'} paid out to the developer.` };
}