import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies, supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { getRepositories, Repository } from "@/lib/db-operations";

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = supabaseAdmin ?? supabase;

    const { data: user } = await dbClient
      .from("users")
      .select("company, username, github_handle")
      .eq("id", session.userId)
      .maybeSingle();

    const company = user?.company ?? null;
    const ownerName = company || user?.github_handle || user?.username || null;

    let repos: Repository[] = [];
    if (ownerName) {
      repos = await getRepositories({ owner: ownerName }, dbClient);
    }
    if (repos.length === 0) {
      // Fallback: return any opted-in public repositories available to work with
      repos = await getRepositories({ optedInOnly: true, limit: 15 }, dbClient);
    }

    return NextResponse.json({ repositories: repos });
  } catch (err) {
    console.error("[GET /api/repositories]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbClient = supabaseAdmin ?? supabase;

    const { data: user } = await dbClient
      .from("users")
      .select("company, username, github_handle")
      .eq("id", session.userId)
      .maybeSingle();

    const body = await request.json();
    const { name, owner, url, description } = body;

    if (!name || !owner) {
      return NextResponse.json({ error: "Repository name and owner are required" }, { status: 400 });
    }

    const repoOwner = owner.trim();
    const repoName = name.trim();
    const githubRepoId = `${repoOwner}/${repoName}`;
    const repoUrl = url?.trim() || `https://github.com/${githubRepoId}`;

    const { data: repo, error } = await dbClient
      .from("repositories")
      .upsert(
        {
          github_repo_id: githubRepoId,
          name: repoName,
          owner: repoOwner,
          url: repoUrl,
          description: description || null,
          opted_in: true,
          opted_in_at: new Date().toISOString(),
        },
        { onConflict: "github_repo_id" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ repository: repo }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/repositories]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
