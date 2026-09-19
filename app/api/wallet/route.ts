import { NextResponse } from "next/server";
import { createServerClientWithCookies } from "@/lib/supabaseClient";
import { getSession } from "@/lib/session";
import { getWalletByUser, getWalletTransactions } from "@/lib/db-operations";

function formatINR(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absAmount);
  return `₹${formatted}`;
}

export async function GET() {
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

    const userId = session.userId;

    // Get wallet
    const wallet = await getWalletByUser(userId);
    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet not found" },
        { status: 404 },
      );
    }

    // Get transactions (reuse the wallet id — avoids a second wallets read)
    const walletTransactions = await getWalletTransactions(userId, null, wallet.id);

    // Map to DevTransaction format
    const transactions = walletTransactions
      .map((tx) => {
        // Determine type and status mapping
        const type: "credit" | "debit" = tx.type === "WITHDRAWAL" ? "debit" : "credit";
        const status: "Completed" | "Pending" = tx.status === "COMPLETED" ? "Completed" : "Pending";

        // For description, we need to derive something.
        // Since we don't have description in wallet_transactions, we can use a placeholder.
        // Ideally, we would join with tasks or contributions to get a meaningful description.
        // For now, we'll set a generic description based on type.
        let description = "";
        if (tx.type === "TASK_REWARD") {
          description = "Bounty Disbursal"; // Placeholder
        } else if (tx.type === "WITHDRAWAL") {
          description = "UPI Withdrawal to Bank";
        } else {
          description = "Wallet Transaction";
        }

        // If we have task_id, we could fetch task details, but that would be additional queries.
        // We'll leave description as is for now.

        return {
          id: tx.id,
          date: tx.created_at ? tx.created_at.split("T")[0] : "", // YYYY-MM-DD
          description,
          amount: formatINR(tx.amount),
          type,
          status,
        };
      })
      // Sort by date descending (newest first)
      .sort((a, b) => (b.date > a.date ? 1 : -1));

    // Format balance
    const balance = formatINR(wallet.available_balance);

    return NextResponse.json({
      balance,
      transactions,
    });
  } catch (error) {
    console.error("Wallet API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}