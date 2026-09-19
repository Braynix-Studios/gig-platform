import { NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/supabaseAuth";
import { debitWallet } from "@/lib/db-operations";

export async function POST(request: Request) {
  try {
    // Authenticate the user
    const supabase = await createServerClientWithCookies();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured" },
        { status: 500 },
      );
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse JSON body
    const body = await request.json();
    const { amount } = body;

    // Validate amount
    if (typeof amount !== "number" || isNaN(amount)) {
      return NextResponse.json(
        { error: "Amount must be a valid number" },
        { status: 400 },
      );
    }

    if (amount < 500) {
      return NextResponse.json(
        { error: "Minimum withdrawal amount is 500" },
        { status: 400 },
      );
    }

    // Call debitWallet
    const result = await debitWallet({
      userId: session.userId,
      amount: amount,
      currency: "INR", // Default currency as specified
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Withdrawal failed" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
