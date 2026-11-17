import type { ReactNode } from "react";

/** Keep existing role-specific content; only standardize its presentation. */
export default function DashboardIntroGrid({ children }: { children: ReactNode }) {
  return <div data-dashboard-intro className="dashboard-intro-merged w-full overflow-hidden rounded-lg bg-primary shadow-elevated [&_h1]:text-2xl [&_h1]:sm:text-3xl [&_h1]:whitespace-normal [&_h1]:break-words [&_h1]:tracking-normal [&_.relative.z-10>div.flex]:flex-wrap [&_.relative.z-10>div.flex]:gap-3">
    {children}
  </div>;
}