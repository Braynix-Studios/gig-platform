import DeveloperDashboard, {
  type DeveloperDashboardData,
} from "@/components/dashboard/DeveloperDashboard";
import { getSession } from "@/lib/session";
import { getDeveloperDashboard, getIssuePoolData } from "@/lib/dashboard-data";
import type { IssuePoolData } from "@/lib/dashboard-data";
import { redirect } from "next/navigation";

function currency(amount: number): string {
  return `\u20b9${amount.toLocaleString("en-IN")}`;
}

function mapDashboardData(
  raw: Awaited<ReturnType<typeof getDeveloperDashboard>>,
): DeveloperDashboardData {
  const displayName = raw.displayName || "Developer";
  const handle = raw.handle || displayName;
  const stats = raw.stats ?? undefined;

  const tasks =
    raw.claimedTasks && raw.claimedTasks.length > 0
      ? raw.claimedTasks.map(({ task, claim }) => {
          const expiresAt = claim.expires_at ? new Date(claim.expires_at) : null;
          const hoursLeft = expiresAt
            ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000))
            : null;
          return {
            id: claim.id,
            title: task?.title || "Claimed task",
            repo:
              task?.issue_url?.replace(/^https?:\/\/github\.com\//, "") || "gig/repo",
            status: ("Locked" as const),
            assignee: displayName,
            lockedAmount: task?.reward_amount ? currency(task.reward_amount) : "—",
            lockExpiry: hoursLeft !== null ? `${hoursLeft}h remaining` : "48h",
            claimStatus: claim.status,
          };
        })
      : [];

  const submissions =
    raw.submissions && raw.submissions.length > 0
      ? raw.submissions.map((sub) => ({
          id: sub.id,
          taskId: sub.task_id,
          prUrl: sub.pr_url,
          prNumber: sub.pr_number,
          prStatus: sub.pr_status,
          submittedAt: sub.submitted_at,
        }))
      : [];

  const transactions =
    raw.transactions && raw.transactions.length > 0
      ? raw.transactions.map((txn) => ({
          id: txn.id,
          date: txn.created_at ? new Date(txn.created_at).toISOString().slice(0, 10) : "",
          description: `${txn.type} · ${txn.status}`,
          amount: currency(txn.amount),
          type: txn.amount >= 0 ? ("credit" as const) : ("debit" as const),
          status: txn.status === "CREDITED" ? ("Completed" as const) : ("Pending" as const),
        }))
      : [];

  const verifiedPRs =
    raw.contributions && raw.contributions.length > 0
      ? raw.contributions.map((c) => ({
          id: c.id,
          repo: c.task_id,
          title: `Verified contribution · ${c.status}`,
          mergedAt: c.merged_at ? new Date(c.merged_at).toISOString().slice(0, 10) : "",
          linesChanged: "+— / −—",
        }))
      : [];

  return {
    displayName,
    handle,
    githubHandle: raw.githubHandle,
    stats: stats ?? {
      reputationScore: "—",
      reputationBadge: "NEW",
      reputationFooter: "0–100 Weighted Score",
      verifiedContributions: "0",
      contributionsFooter: "No verified contributions yet",
      lockedTasks: "0",
      lockedFooter: "No locked escrow yet",
      walletBalance: "₹0",
      walletFooter: "Ready for instant UPI bank withdrawal (Min ₹500)",
    },
    tasks,
    submissions,
    transactions,
    badges: [],
    verifiedPRs,
    walletTxCount: transactions.length,
    // Profile fields for editing
    username: raw.user?.username || "",
    avatar_url: raw.user?.avatar_url ?? null,
    github_handle: raw.user?.github_handle ?? null,
    bio: raw.user?.bio ?? null,
    company: raw.user?.company ?? null,
    location: raw.user?.location ?? null,
    followers_count: raw.user?.followers_count ?? null,
    public_repos_count: raw.user?.public_repos_count ?? null
  };
}

export default async function DeveloperDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth");
  }
  if (session.role !== "developer") {
    redirect("/dashboard/business");
  }

  let data: DeveloperDashboardData | undefined;
  let issuePool: IssuePoolData | undefined;

  if (session?.userId) {
    // Independent sources: fetch in parallel. allSettled (not all) preserves
    // the graceful-degradation behavior below — one failing source must not
    // blank the other.
    const [dashRes, poolRes] = await Promise.allSettled([
      getDeveloperDashboard(session.userId),
      getIssuePoolData("developer", session.userId),
    ]);
    if (dashRes.status === "fulfilled") {
      try {
        const raw = dashRes.value;
        // Only render live data when a real profile exists in the DB;
        // otherwise fall back to the demo dashboard so the prototype stays alive.
        if (raw.profile?.user) {
          data = mapDashboardData(raw);
        }
      } catch {
        data = undefined;
      }
    } else {
      data = undefined;
    }
    issuePool = poolRes.status === "fulfilled" ? poolRes.value : undefined;
  }

  return <DeveloperDashboard data={data} issuePool={issuePool} />;
}