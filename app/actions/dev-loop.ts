'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import {
  claimTask,
  getTaskById,
  getActiveClaimForTask,
  submitPR,
} from '@/lib/db-operations';

export interface DevLoopState {
  ok: boolean;
  message?: string;
}

const GITHUB_PR_URL =
  /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+(\?.*)?$/;

export async function claimIssueAction(
  _prevState: DevLoopState,
  formData: FormData,
): Promise<DevLoopState> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, message: 'Sign in to claim issues.' };
  }
  if (session.role !== 'developer') {
    return { ok: false, message: 'Only developers can claim issues.' };
  }

  const taskId = formData.get('taskId');
  if (typeof taskId !== 'string' || !taskId) {
    return { ok: false, message: 'Missing issue reference.' };
  }

  const task = await getTaskById(taskId);
  if (!task) {
    return { ok: false, message: 'Issue not found.' };
  }
  if (task.status !== 'open') {
    return { ok: false, message: 'This issue is no longer open.' };
  }

  const claim = await claimTask(taskId, session.userId);
  if (!claim) {
    return {
      ok: false,
      message:
        'Could not claim this issue. You may already hold an active claim on another issue.',
    };
  }

  revalidatePath('/dashboard/developer', 'page');
  return { ok: true, message: `Claimed "${task.title}" — it is locked to you for 48 hours.` };
}

export async function submitPrAction(
  _prevState: DevLoopState,
  formData: FormData,
): Promise<DevLoopState> {
  const session = await getSession();
  if (!session?.userId) {
    return { ok: false, message: 'Sign in to submit a PR.' };
  }
  if (session.role !== 'developer') {
    return { ok: false, message: 'Only developers can submit PRs.' };
  }

  const taskId = formData.get('taskId');
  const prUrl = formData.get('prUrl');
  if (typeof taskId !== 'string' || typeof prUrl !== 'string') {
    return { ok: false, message: 'Missing submission details.' };
  }

  const url = prUrl.trim();
  if (!GITHUB_PR_URL.test(url)) {
    return {
      ok: false,
      message: 'Enter a valid GitHub pull-request URL, e.g. https://github.com/org/repo/pull/12',
    };
  }

  const claim = await getActiveClaimForTask(taskId);
  if (!claim || claim.user_id !== session.userId) {
    return { ok: false, message: 'Claim this issue first before submitting a PR.' };
  }

  const prNumber = url.match(/\/pull\/(\d+)/)?.[1] ?? null;

  const submission = await submitPR({
    task_id: taskId,
    user_id: session.userId,
    claim_id: claim.id,
    pr_url: url,
    pr_number: prNumber,
  });
  if (!submission) {
    return { ok: false, message: 'Submission failed. Please try again.' };
  }

  revalidatePath('/dashboard/developer', 'page');
  return {
    ok: true,
    message: prNumber ? `PR #${prNumber} submitted for verification.` : 'PR submitted for verification.',
  };
}