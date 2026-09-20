import { BrandLoadingScreen } from "@/components/skeletons";

// Root fallback for route transitions without a closer loading boundary.
// Presents GIG's signature brand loading screen with emerald pulse.
export default function RootLoading() {
  return <BrandLoadingScreen />;
}
