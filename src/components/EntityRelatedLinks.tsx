import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Network } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface RelatedLink {
  label: string;
  url: string;
  icon: LucideIcon;
  color?: string;
  description?: string;
}

/**
 * Shared "spider-web" related-modules card.
 * Place it on entity pages (Student profile, Personnel profile, Asset detail, …)
 * to give users one-click access to every related module for that entity.
 */
export function EntityRelatedLinks({
  title = "เชื่อมโยงโมดูลที่เกี่ยวข้อง",
  links,
}: {
  title?: string;
  links: RelatedLink[];
}) {
  if (!links.length) return null;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {links.map((l) => (
            <Link
              key={l.url}
              to={l.url}
              className="group flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-accent hover:border-primary/40 transition-all"
            >
              <div className={`w-8 h-8 rounded-md bg-muted flex items-center justify-center ${l.color ?? "text-primary"} group-hover:scale-110 transition`}>
                <l.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{l.label}</p>
                {l.description && (
                  <p className="text-[10px] text-muted-foreground truncate">{l.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default EntityRelatedLinks;