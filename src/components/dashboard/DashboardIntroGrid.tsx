import type { ReactNode } from "react";

/** Keep existing role-specific content; only standardize its presentation. */
export default function DashboardIntroGrid({ children }: { children: ReactNode }) {
  return <div data-dashboard-intro className="grid grid-cols-1 gap-4 md:grid-cols-2 [&>div]:aspect-square [&>div]:min-h-0 [&>div]:min-w-0 [&>div]:overflow-auto [&>div]:rounded-lg [&>div]:h-auto [&>div]:p-4 [&>div]:sm:p-6 [&_h1]:text-xl [&_h1]:sm:text-2xl [&_h1]:whitespace-normal [&_h1]:break-words [&_h1]:tracking-normal [&_.relative.z-10>div.flex]:flex-wrap [&_.relative.z-10>div.flex]:gap-3">
    {children}
  </div>;
}