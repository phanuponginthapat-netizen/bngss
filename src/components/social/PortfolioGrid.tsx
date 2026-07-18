import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pin, Trash2 } from "lucide-react";
import MediaRenderer from "./MediaRenderer";
import type { MediaType } from "@/lib/media";

interface Portfolio {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string | null;
  media_type: MediaType;
  media_url: string;
  display_mode: "preview" | "download" | "embed";
  is_pinned: boolean;
  file_name: string | null;
  created_at: string;
}

export default function PortfolioGrid({
  userId,
  ownerView = false,
}: {
  userId: string;
  ownerView?: boolean;
}) {
  const [items, setItems] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("portfolio_items")
      .select("*")
      .eq("user_id", userId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });
    setItems((data || []) as Portfolio[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel(`portfolio-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "portfolio_items", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [userId]);

  const togglePin = async (it: Portfolio) => {
    await supabase.from("portfolio_items").update({ is_pinned: !it.is_pinned }).eq("id", it.id);
  };
  const remove = async (it: Portfolio) => {
    if (!confirm("ลบผลงานนี้?")) return;
    await supabase.from("portfolio_items").delete().eq("id", it.id);
  };

  if (loading) return <div className="text-center text-muted-foreground py-8">กำลังโหลด...</div>;
  if (items.length === 0)
    return <Card><CardContent className="p-8 text-center text-muted-foreground">ยังไม่มีผลงาน</CardContent></Card>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {items.map((it) => (
        <Card key={it.id} className="overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold flex items-center gap-2">
                  {it.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
                  {it.title}
                </h3>
                {it.category && <Badge variant="secondary" className="mt-1">{it.category}</Badge>}
              </div>
              {ownerView && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => togglePin(it)} title="ปักหมุด">
                    <Pin className={`w-4 h-4 ${it.is_pinned ? "text-amber-500 fill-amber-500" : ""}`} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(it)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
            {it.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{it.description}</p>}
            <MediaRenderer
              mediaType={it.media_type}
              mediaUrl={it.media_url}
              displayMode={it.display_mode}
              fileName={it.file_name}
              title={it.title}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
