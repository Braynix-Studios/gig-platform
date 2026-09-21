import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Graceful server-side redirect for /profile:
 * Directs users to their corresponding dashboard profile tab without maintaining
 * a duplicate standalone profile page.
 */
export default async function ProfilePage() {
  const session = await getSession();

  if (!session || !session.userId) {
    redirect("/auth");
  }

  if (session.role === "business") {
    redirect("/dashboard/business?tab=profile");
  }

  redirect("/dashboard/developer?tab=profile");
}
