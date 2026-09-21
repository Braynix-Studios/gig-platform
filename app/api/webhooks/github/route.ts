import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin, supabase } from "@/lib/supabaseClient";
import {
  createContribution,
  creditReward,
  releaseReward,
  setClaimStatus,
  updateTaskStatus,
  expireOtherClaimsForTask,
  updateSubmissionStatus,
} from "@/lib/db-operations";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const parts = signature.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256") return false;
  try {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
    const sigBuffer = Buffer.from(parts[1], "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // If secret is configured, enforce HMAC verification
  if (secret) {
    if (!signature || !verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const event = req.headers.get("x-github-event");
  if (event === "ping") {
    return NextResponse.json({ message: "pong" }, { status: 200 });
  }

  if (event !== "pull_request") {
    return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { action, pull_request, repository } = body;

  // Only handle PR closed with merged: true
  if (action !== "closed" || !pull_request?.merged) {
    return NextResponse.json({ message: "PR not merged, ignoring" }, { status: 200 });
  }

  const prNumber = pull_request.number;
  const prHtmlUrl = pull_request.html_url;
  const repoOwner = repository?.owner?.login;
  const repoName = repository?.name;
  const prAuthorId = pull_request.user?.id ? String(pull_request.user.id) : null;
  const mergeCommitSha = pull_request.merge_commit_sha || null;

  if (!prNumber || !repoOwner || !repoName) {
    return NextResponse.json({ error: "Missing required PR/repo metadata" }, { status: 400 });
  }

  const client = supabaseAdmin ?? supabase;
  if (!client) {
    return NextResponse.json({ error: "Database client unavailable" }, { status: 500 });
  }

  // 1. Locate repository in database
  const { data: repoRecord } = await client
    .from("repositories")
    .select("id, owner, name, github_repo_id")
    .ilike("owner", repoOwner)
    .ilike("name", repoName)
    .maybeSingle();

  if (!repoRecord) {
    return NextResponse.json({ message: "Repository not registered on platform" }, { status: 200 });
  }

  // 2. Locate active pending submission matching PR URL or number within repository tasks
  const { data: submissions } = await client
    .from("submissions")
    .select("id, task_id, user_id, claim_id, pr_url, pr_number, pr_status, tasks(id, repository_id, reward_amount, reward_currency, issue_url)")
    .eq("pr_status", "pending");

  const matchingSubmission = (submissions ?? []).find((s: any) => {
    const task = s.tasks;
    if (!task || task.repository_id !== repoRecord.id) return false;
    if (s.pr_number && Number(s.pr_number) === Number(prNumber)) return true;
    if (s.pr_url && (s.pr_url === prHtmlUrl || s.pr_url.endsWith(`/pull/${prNumber}`))) return true;
    return false;
  });

  if (!matchingSubmission) {
    return NextResponse.json({ message: "No active pending submission found for this PR" }, { status: 200 });
  }

  const task = (matchingSubmission as any).tasks;

  // 3. Atomically update submission status to 'merged'
  const updated = await updateSubmissionStatus(matchingSubmission.id, "merged", "pending", client);
  if (!updated) {
    return NextResponse.json({ message: "Submission status already resolved" }, { status: 200 });
  }

  // 4. Create durable verified contribution record
  const issueNumMatch = task?.issue_url ? task.issue_url.match(/\/issues\/(\d+)/) : null;
  const contribution = await createContribution(
    {
      user_id: matchingSubmission.user_id,
      task_id: matchingSubmission.task_id,
      submission_id: matchingSubmission.id,
      status: "verified",
      reviewer: repoOwner,
      merged_at: pull_request.merged_at || new Date().toISOString(),
      github_repo_id: repoRecord.github_repo_id || `${repoOwner}/${repoName}`,
      github_issue_number: issueNumMatch ? parseInt(issueNumMatch[1], 10) : null,
      pr_number: Number(prNumber),
      pr_author_github_id: prAuthorId,
      merge_commit_sha: mergeCommitSha,
      verification_source: "github_webhook",
    },
    client,
  );

  // 5. Queue reward as PENDING then advance to AVAILABLE
  const amount = task?.reward_amount ?? 0;
  if (amount > 0 && contribution) {
    const payout = await creditReward(
      {
        user_id: matchingSubmission.user_id,
        task_id: matchingSubmission.task_id,
        amount,
        currency: task?.reward_currency || "INR",
        contribution_id: contribution.id,
      },
      client,
    );
    if (!payout.ok) {
      return NextResponse.json(
        { ok: false, message: `PR verified but reward failed: ${payout.error}` },
        { status: 500 },
      );
    }
    if (payout.transactionId) {
      const released = await releaseReward(
        { transactionId: payout.transactionId },
        client,
      );
      if (!released.ok) {
        return NextResponse.json(
          {
            ok: false,
            message: `PR verified but reward release failed: ${released.error}`,
          },
          { status: 500 },
        );
      }
    }
  }

  // 6. Complete winning claim, close task, and expire competitor claims
  await setClaimStatus(matchingSubmission.claim_id, "completed", undefined, client);
  await updateTaskStatus(task.id, "closed", "open", client);
  await expireOtherClaimsForTask(task.id, matchingSubmission.claim_id, client);

  return NextResponse.json(
    {
      ok: true,
      message: `PR #${prNumber} verified and merged via webhook. Reward advanced to AVAILABLE.`,
      contribution_id: contribution?.id ?? null,
    },
    { status: 200 },
  );
}
