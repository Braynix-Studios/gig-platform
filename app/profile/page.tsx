import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getFullProfile,
  getWalletTransactions,
  getContributionsByUser,
  getClaimedTasksByUser,
} from "@/lib/db-operations";
import { createServerClientWithCookies, supabaseAdmin } from "@/lib/supabaseClient";
import ProfileView from "@/components/profile/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();

  if (!session || !session.userId) {
    redirect("/auth");
  }

  const supabase = await createServerClientWithCookies();
  const dbClient = supabaseAdmin ?? supabase;

  const [profile, transactions, contributions, claimedTasks] = await Promise.all([
    getFullProfile(session.userId, dbClient),
    getWalletTransactions(session.userId, dbClient),
    getContributionsByUser(session.userId, dbClient),
    getClaimedTasksByUser(session.userId, dbClient),
  ]);

  return (
    <ProfileView
      initialProfile={profile}
      transactions={transactions}
      contributions={contributions}
      claimedTasks={claimedTasks}
      role={session.role === "business" ? "business" : "developer"}
    />
  );
}
