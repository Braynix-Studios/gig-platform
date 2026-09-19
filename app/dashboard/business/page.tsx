import BusinessDashboardComp from "@/components/dashboard/BusinessDashboard";
import { getBusinessDashboard, getIssuePoolData, getBusinessReviews } from "@/lib/dashboard-data";
import type { BusinessDashboard as BusinessDashboardType } from "@/lib/dashboard-data";
import type { IssuePoolData } from "@/lib/dashboard-data";
import type { SubmissionReview } from "@/lib/db-operations";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BusinessDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/auth");
  }
  if (session.role !== "business") {
    redirect("/dashboard/developer");
  }

  let data: BusinessDashboardType | null = null;
  let issuePool: IssuePoolData | undefined;
  let reviews: SubmissionReview[] = [];
  try {
    const raw = await getBusinessDashboard();
    data = raw ?? null;
    issuePool = session?.userId ? await getIssuePoolData("business", session.userId) : undefined;
    reviews = session?.userId ? await getBusinessReviews(session.userId) : [];
  } catch {
    data = null;
    issuePool = undefined;
    reviews = [];
  }

  if (data && data.backlogTasks.length > 0) {
    return <BusinessDashboardComp data={data} issuePool={issuePool} reviews={reviews} />;
  }

  return <BusinessDashboardComp data={data ?? undefined} issuePool={issuePool} reviews={reviews} />;
}