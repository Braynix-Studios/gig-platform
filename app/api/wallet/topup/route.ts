import { NextRequest, NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { creditTopup, getWalletByUser } from "@/lib/db-operations";

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

    const body = await request.json();
    const amount = Number(body.amount);
    const currency = body.currency || "INR";

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "A valid positive coin amount is required" }, { status: 400 });
    }

    // Top up the user's wallet with GIG Coins
    const result = await creditTopup({
      userId: session.userId,
      amount,
      currency,
    }, supabase);

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Topup failed" }, { status: 500 });
    }

    const wallet = await getWalletByUser(session.userId, supabase);

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance ?? wallet?.available_balance,
      message: `Successfully purchased ${amount} GIG Coins!`,
    });
  } catch (err) {
    console.error("[POST /api/wallet/topup]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
