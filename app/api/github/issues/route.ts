import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  } | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json({ error: "owner and repo query params are required" }, { status: 400 });
    }

    const githubToken = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "gig-platform-sync",
    };

    if (githubToken) {
      headers["Authorization"] = `Bearer ${githubToken}`;
    }

    const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=30`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return NextResponse.json(
        { error: `GitHub API error: ${ghRes.statusText}`, details: errText },
        { status: ghRes.status },
      );
    }

    const data = await ghRes.json();
    // GitHub's issues endpoint returns pull requests as well; filter them out
    const issues = (Array.isArray(data) ? data : [])
      .filter((item) => !item.pull_request)
      .map((item) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        body: item.body ?? null,
        html_url: item.html_url,
        state: item.state,
        labels: (item.labels || []).map((l: { name: string; color: string }) => ({
          name: l.name,
          color: l.color,
        })),
        created_at: item.created_at,
        user: item.user
          ? {
              login: item.user.login,
              avatar_url: item.user.avatar_url,
            }
          : null,
      }));

    return NextResponse.json({ issues });
  } catch (err) {
    console.error("[GET /api/github/issues]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
