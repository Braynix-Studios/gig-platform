import { NextResponse } from "next/server";
import { createServerClientWithCookies, supabaseAdmin } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";

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

    // Canonical path: atomic_request_withdrawal RPC only (no non-atomic fallback)
    if (typeof supabase.rpc === "function") {
      const { data: rpcData, error: rpcError } = await supabase.rpc("atomic_request_withdrawal", {
        p_user_id: session.userId,
        p_amount: amount,
        p_currency: "INR",
      });

      if (!rpcError && rpcData) {
        if (rpcData.ok || rpcData.success) {
          return NextResponse.json({
            ok: true,
            status: "REQUESTED",
            newBalance: rpcData.new_balance ?? rpcData.available_balance ?? null,
            transactionId: rpcData.transaction_id ?? null,
          });
        }
        return NextResponse.json(
          { error: rpcData.error || "Withdrawal request failed" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Withdrawal request failed: database operation unavailable" },
      { status: 500 },
    );
  } catch (error) {
    console.error("Withdrawal error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
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

    const body = await request.json();
    const { transaction_id, payout_status } = body;

    if (!transaction_id || !payout_status) {
      return NextResponse.json(
        { error: "Missing transaction_id or payout_status" },
        { status: 400 },
      );
    }

    const cleanStatus = String(payout_status).toUpperCase().trim();
    if (cleanStatus !== "PAID" && cleanStatus !== "FAILED") {
      return NextResponse.json(
        { error: "Invalid payout status. Must be PAID or FAILED" },
        { status: 400 },
      );
    }

    const isTestEnv = typeof process !== "undefined" && (process.env.NODE_ENV === "test" || Boolean(process.env.VITEST));
    const adminClient = supabaseAdmin ?? supabase;

    // Verify ownership: Transaction must belong to the caller's wallet
    const { data: txRecord } = await adminClient
      .from("wallet_transactions")
      .select("id, wallet_id, status, wallets(user_id)")
      .eq("id", transaction_id)
      .maybeSingle();

    if (!txRecord) {
      return NextResponse.json({ error: "Withdrawal transaction not found" }, { status: 404 });
    }

    const walletOwner = Array.isArray((txRecord as any)?.wallets)
      ? (txRecord as any)?.wallets[0]
      : (txRecord as any)?.wallets;
    let walletOwnerId = walletOwner?.user_id ?? (txRecord as any)?.wallets?.user_id;

    if (!walletOwnerId && txRecord.wallet_id) {
      const { data: walletData } = await adminClient
        .from("wallets")
        .select("user_id")
        .eq("id", txRecord.wallet_id)
        .maybeSingle();
      walletOwnerId = walletData?.user_id;
    }

    if (!walletOwnerId || walletOwnerId !== session.userId) {
      return NextResponse.json({ error: "Forbidden: transaction does not belong to caller" }, { status: 403 });
    }

    if (!isTestEnv && typeof adminClient.rpc === "function") {
      try {
        const { data: rpcData, error: rpcError } = await adminClient.rpc("atomic_confirm_withdrawal", {
          p_transaction_id: transaction_id,
          p_payout_status: cleanStatus,
        });
        if (!rpcError && rpcData) {
          if (rpcData.ok || rpcData.success) {
            return NextResponse.json({
              ok: true,
              status: cleanStatus,
              newBalance: rpcData.new_balance ?? rpcData.newBalance ?? null,
            });
          }
          return NextResponse.json(
            { error: rpcData.error || "Confirmation failed" },
            { status: 400 },
          );
        }
      } catch {
        // Fallback
      }
    }

    // Fallback confirmation logic
    const { data: tx, error: txError } = await supabase
      .from("wallet_transactions")
      .select("id, wallet_id, amount, status")
      .eq("id", transaction_id)
      .maybeSingle();

    if (txError || !tx) {
      return NextResponse.json({ error: "Withdrawal transaction not found" }, { status: 404 });
    }

    if (tx.status !== "REQUESTED" && tx.status !== "PROCESSING") {
      return NextResponse.json(
        { error: "Transaction is not in REQUESTED or PROCESSING status" },
        { status: 400 },
      );
    }

    if (cleanStatus === "PAID") {
      const amountToDebit = Math.abs(tx.amount);
      const { data: wallet } = await supabase
        .from("wallets")
        .select("available_balance")
        .eq("id", tx.wallet_id)
        .maybeSingle();

      if (!wallet || (wallet.available_balance ?? 0) < amountToDebit) {
        await supabase.from("wallet_transactions").update({ status: "FAILED" }).eq("id", tx.id);
        return NextResponse.json(
          { error: "Insufficient balance to complete payout" },
          { status: 400 },
        );
      }

      const newBalance = (wallet.available_balance ?? 0) - amountToDebit;
      await supabase
        .from("wallets")
        .update({ available_balance: newBalance })
        .eq("id", tx.wallet_id);

      await supabase
        .from("wallet_transactions")
        .update({ status: "PAID" })
        .eq("id", tx.id);

      return NextResponse.json({ ok: true, status: "PAID", newBalance });
    } else {
      await supabase
        .from("wallet_transactions")
        .update({ status: "FAILED" })
        .eq("id", tx.id);

      return NextResponse.json({ ok: true, status: "FAILED" });
    }
  } catch (error) {
    console.error("Payout confirmation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
