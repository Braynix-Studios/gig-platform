import { CardSkeleton } from "@/components/skeletons";

// Shown automatically during navigation to /auth/* routes.
export default function AuthLoading() {
  return (
    <div
      style={{
        minHeight: "calc(100dvh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <CardSkeleton />
    </div>
  );
}
