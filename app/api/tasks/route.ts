import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { getRepositories, getUserById } from "@/lib/db-operations";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json({ error: "Supabase is not configured" }, { status: 500 });
    }

    const session = await getSession();
    if (!session || session.role !== "business") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repository_id, title, description, difficulty, technology, reward_amount, reward_currency, issue_url } = body;

    if (!repository_id || !title) {
      return NextResponse.json({ error: "repository_id and title are required" }, { status: 400 });
    }

    // Verify the business owns the repository
    const user = await getUserById(session.userId, supabase);
    if (!user?.company) {
      return NextResponse.json({ error: "No company associated with this account" }, { status: 403 });
    }

    const repositories = await getRepositories({ owner: user.company }, supabase);
    const repo = repositories.find((r) => r.id === repository_id);
    if (!repo) {
      return NextResponse.json({ error: "Repository not found or access denied" }, { status: 403 });
    }

    // BUG-004 FIX: Deduct sponsor escrow balance upfront when creating task
    if (reward_amount && reward_amount > 0) {
      const { debitWallet } = await import('@/lib/db-operations');
      const debitResult = await debitWallet({
        userId: session.userId,
        amount: reward_amount,
        currency: reward_currency || "INR"
      }, supabase);
      
      if (!debitResult.ok) {
        return NextResponse.json({ error: `Insufficient escrow balance: ${debitResult.error}` }, { status: 400 });
      }
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        repository_id,
        title,
        description: description || null,
        issue_url: issue_url || null,
        difficulty: difficulty || "medium",
        technology: technology || null,
        status: "open",
        reward_amount: reward_amount || null,
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
