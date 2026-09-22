import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";

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

    const dbClient = supabase;
    const { data: user } = await dbClient
      .from("users")
      .select("role, company")
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
      tags,
    } = body;

    // 1. Validate title
    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Issue title is required" }, { status: 400 });
    }

    // 2. Validate reward amount: must be positive number > 0 (R2h.1)
    const reward = Number(reward_amount);
    if (reward_amount === undefined || reward_amount === null || isNaN(reward) || reward <= 0) {
      return NextResponse.json(
        { error: "reward_amount must be a positive number greater than 0" },
        { status: 400 },
      );
    }

    // 3. Resolve and validate repository (R2h.2 & R2h.3)
    let targetRepoId = repository_id;
    const userCompany = (user.company ?? "").trim().toLowerCase();

    if (targetRepoId) {
      const { data: repo, error: repoError } = await dbClient
        .from("repositories")
        .select("id, owner, opted_in")
        .eq("id", targetRepoId)
        .maybeSingle();

      if (repoError || !repo) {
        return NextResponse.json({ error: "Repository not found." }, { status: 404 });
      }

      if (repo.owner.trim().toLowerCase() !== userCompany) {
        return NextResponse.json(
          { error: "Repository does not belong to your company. Forbidden." },
          { status: 403 },
        );
      }

      if (!repo.opted_in) {
        return NextResponse.json(
          { error: "Repository is not opted in to the network." },
          { status: 400 },
        );
      }
    } else {
      if (!repo_owner || !repo_name) {
        return NextResponse.json(
          { error: "Either repository_id or repo_owner and repo_name are required" },
          { status: 400 },
        );
      }

      if (repo_owner.trim().toLowerCase() !== userCompany) {
        return NextResponse.json(
          { error: "Repository does not belong to your company. Forbidden." },
          { status: 403 },
        );
      }

      const githubRepoId = `${repo_owner.trim()}/${repo_name.trim()}`;
      const { data: existingRepo } = await dbClient
        .from("repositories")
        .select("id, owner, opted_in")
        .eq("github_repo_id", githubRepoId)
        .maybeSingle();

      if (existingRepo) {
        if (!existingRepo.opted_in) {
          return NextResponse.json(
            { error: "Repository is not opted in to the network." },
            { status: 400 },
          );
        }
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

    // 4. Atomic task creation with escrow: canonical path
    if (typeof dbClient.rpc === "function") {
      const { data: rpcData, error: rpcError } = await dbClient.rpc("atomic_create_task_with_escrow", {
        p_business_id: session.userId,
        p_repository_id: targetRepoId,
        p_title: title.trim(),
        p_issue_url: issue_url?.trim() || null,
        p_reward_amount: reward,
        p_reward_currency: reward_currency || "INR",
        p_experience_level: difficulty || "standard",
        p_tags: tags || (technology ? [technology.trim()] : null),
        p_description: description?.trim() || null,
      });

      if (!rpcError && rpcData) {
        if (rpcData.ok || rpcData.success) {
          return NextResponse.json({ task: rpcData.task, task_id: rpcData.task_id }, { status: 201 });
        }
        const isForbidden = rpcData.error && String(rpcData.error).toLowerCase().includes("forbidden");
        return NextResponse.json(
          { error: rpcData.error || "Failed to create task" },
          { status: isForbidden ? 403 : 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to create task: database operation unavailable" },
      { status: 500 },
    );
  } catch (err) {
    console.error("[POST /api/tasks]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
