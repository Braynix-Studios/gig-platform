import { CardSkeleton } from "@/components/skeletons";

// Root fallback for route transitions without a closer loading boundary.
export default function RootLoading() {
  return (
    <div
      style={{
        minHeight: "60dvh",
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
