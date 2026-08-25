import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, Boxes, ScanLine } from "lucide-react";
import ArMediaViewer from "@/components/ar/ArMediaViewer";

interface ArItem {
  id: string; code: string; title: string; description: string | null;
  media_type: string; media_url: string; poster_url: string | null;
  subject: string | null; grade_level: string | null; tags: string[] | null;
  view_count: number;
  marker_label: string | null;
  project_slug: string | null;
  project_title: string | null;
}

const typeLabel: Record<string, string> = {
  image: "ภาพ", video: "วิดีโอ", youtube: "วิดีโอ YouTube", model3d: "โมเดล 3 มิติ / AR",
};

export default function ARViewPage() {
  const { code } = useParams<{ code: string }>();
  const [item, setItem] = useState<ArItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!code) return;
      setLoading(true);
      const { data } = await (supabase.rpc as any)("get_public_ar_experience", { _code: code });
      const row = Array.isArray(data) ? data[0] : data;
      setItem(row || null);
      setLoading(false);
      if (row) { try { await (supabase.rpc as any)("bump_ar_view", { _code: code }); } catch {} }
    };
    load();
  }, [code]);

  useEffect(() => {
    if (item?.title) document.title = `${item.title} | สื่อ AR แหล่งเรียนรู้`;
  }, [item?.title]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Boxes className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">ไม่พบสื่อ AR นี้</h1>
            <p className="text-sm text-muted-foreground">รหัส “{code}” อาจถูกปิดการเผยแพร่หรือถูกลบแล้ว</p>
            <Button asChild variant="outline"><Link to="/ar"><ArrowLeft className="h-4 w-4 mr-2" />คลังสื่อ AR</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm"><Link to={item.project_slug ? `/ar/p/${item.project_slug}` : "/ar"}><ArrowLeft className="h-4 w-4 mr-2" />{item.project_title || "คลังสื่อ AR"}</Link></Button>
          <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{item.view_count} ครั้ง</Badge>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <ArMediaViewer mediaType={item.media_type} mediaUrl={item.media_url} posterUrl={item.poster_url} title={item.title} />
            <div className="space-y-2">
              {item.marker_label && <p className="text-sm text-muted-foreground">{item.marker_label}</p>}
              <h1 className="text-2xl font-bold">{item.title}</h1>
              <div className="flex flex-wrap gap-2">
                <Badge>{typeLabel[item.media_type] || item.media_type}</Badge>
                {item.subject && <Badge variant="outline">{item.subject}</Badge>}
                {item.grade_level && <Badge variant="outline">{item.grade_level}</Badge>}
                {(item.tags || []).map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
              {item.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>}
              {item.media_type === "model3d" && (
                <p className="text-xs text-muted-foreground">
                  เปิดบนมือถือแล้วกดปุ่ม AR มุมขวาล่างของโมเดล เพื่อวางวัตถุ 3 มิติในห้องเรียนจริง
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild variant="outline" size="sm"><Link to="/ar"><ScanLine className="h-4 w-4 mr-2" />สแกน QR อื่น</Link></Button>
        </div>
      </div>
    </div>
  );
}
