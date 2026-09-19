import { redirect } from "next/navigation";
import AuthSplitView from "@/components/AuthSplitView";

export const metadata = {
  title: "Log In — GIG",
  description: "Log in to GIG — Ship real software, earn verified contributions.",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const role = typeof params.role === "string" ? params.role : undefined;

  if (role === "business") redirect("/auth/business");
  if (role === "developer") redirect("/auth/developer");

  return <AuthSplitView error={error} />;
}