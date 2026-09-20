import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies, supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { getRepositories, getUserById, debitWallet } from "@/lib/db-operations";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    const dbClient = supabaseAdmin ?? supabase;
    const { data: user } = await dbClient
      .from("users")
      .select("role")
      .eq("id", session.userId)
      .maybeSingle();

    if (!user || user.role !== "business") {
      return NextResponse.json(
        { error: "Only business sponsors are authorized to raise or post new issues." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const {
      repository_id,
      repo_owner,
      repo_name,
      repo_url,
      title,
      description,
      difficulty,
      technology,
      reward_amount,
      reward_currency,
      issue_url,
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Issue title is required" }, { status: 400 });
    }

    // Resolve or automatically register target repository
    let targetRepoId = repository_id;

    if (!targetRepoId) {
      if (!repo_owner || !repo_name) {
        return NextResponse.json(
          { error: "Either repository_id or repo_owner and repo_name are required" },
          { status: 400 },
        );
      }

      const githubRepoId = `${repo_owner.trim()}/${repo_name.trim()}`;
      const dbClient = supabaseAdmin ?? supabase;

      const { data: existingRepo } = await dbClient
        .from("repositories")
        .select("id")
        .eq("github_repo_id", githubRepoId)
        .maybeSingle();

      if (existingRepo) {
        targetRepoId = existingRepo.id;
      } else {
        const { data: newRepo, error: repoError } = await dbClient
          .from("repositories")
          .insert({
            github_repo_id: githubRepoId,
            name: repo_name.trim(),
            owner: repo_owner.trim(),
            url: repo_url?.trim() || `https://github.com/${githubRepoId}`,
            opted_in: true,
            opted_in_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (repoError || !newRepo) {
          return NextResponse.json(
            { error: repoError?.message || "Failed to register repository for this issue" },
            { status: 400 },
          );
        }
        targetRepoId = newRepo.id;
      }
    }

    const reward = Number(reward_amount);
    const hasBounty = reward && reward > 0;

    // If task has a coin bounty, deduct from user's GIG Coins wallet into Escrow
    if (hasBounty) {
      const debitResult = await debitWallet(
        {
          userId: session.userId,
          amount: reward,
          currency: reward_currency || "INR",
        },
        supabaseAdmin ?? supabase,
      );

      if (!debitResult.ok) {
        return NextResponse.json(
          { error: `Insufficient GIG Coins balance: ${debitResult.error || "Please top up your wallet."}` },
          { status: 400 },
        );
      }
    }

    const { data: task, error } = await dbClient
      .from("tasks")
      .insert({
        repository_id: targetRepoId,
        title: title.trim(),
        description: description?.trim() || null,
        issue_url: issue_url?.trim() || null,
        difficulty: difficulty || "medium",
        technology: technology?.trim() || null,
        status: "open",
        reward_amount: hasBounty ? reward : null,
        reward_currency: reward_currency || "INR",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
