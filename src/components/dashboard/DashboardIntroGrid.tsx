import type { ReactNode } from "react";
import { useMascotSettings } from "@/hooks/useMascotSettings";

/** Keep existing role-specific content; only standardize its presentation. */
export default function DashboardIntroGrid({ children }: { children: ReactNode }) {
  const mascot = useMascotSettings();
  return <div data-dashboard-intro className="dashboard-intro-merged relative isolate w-full overflow-hidden rounded-lg bg-background shadow-elevated">
    <div aria-hidden className="intro-scene pointer-events-none absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${mascot.backgroundUrl})` }} />
    <div aria-hidden className="intro-tint pointer-events-none absolute inset-0 -z-10 bg-background/80" />
    <div className="intro-row grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-2 sm:gap-4">{children}</div>
  </div>;
}