import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, ScanLine, Search, Eye, Image as ImageIcon, Video, Box } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface ArItem {
  id: string; code: string; title: string; description: string | null;
  media_type: string; media_url: string; poster_url: string | null;
  subject: string | null; grade_level: string | null; tags: string[] | null; view_count: number;
}

const icon = (t: string) => (t === "model3d" ? Box : t === "image" ? ImageIcon : Video);

/** ดึงรหัสสื่อจากข้อความ QR (รองรับทั้ง URL เต็มและรหัสล้วน) */
export const extractArCode = (raw: string) => {
  const s = (raw || "").trim();
  if (!s) return "";
  const m = s.match(/\/ar\/([A-Za-z0-9_-]+)/);
  if (m?.[1]) return m[1];
  return s.replace(/^.*\//, "");
};

export default function ARGalleryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ArItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    document.title = "คลังสื่อ AR แหล่งเรียนรู้ | สแกน QR ดูภาพ วิดีโอ และโมเดล 3 มิติ";
    (async () => {
      const { data } = await (supabase.rpc as any)("list_public_ar_experiences", { _limit: 120 });
      setItems(Array.isArray(data) ? data : []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return items;
    return items.filter((i) =>
      [i.title, i.description, i.subject, i.grade_level, i.code, ...(i.tags || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(k));
  }, [items, q]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-5xl mx-auto p-4 space-y-5">
        <header className="text-center space-y-2 pt-4">
          <Boxes className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">คลังสื่อ AR แหล่งเรียนรู้</h1>
          <p className="text-sm text-muted-foreground">สแกน QR Code เพื่อดูภาพ วิดีโอ หรือโมเดล 3 มิติแบบ AR ได้ทันที ไม่ต้องเข้าสู่ระบบ</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อสื่อ วิชา ระดับชั้น หรือรหัส" className="pl-9" />
          </div>
          <Button onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4 mr-2" />สแกน QR</Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10">กำลังโหลด...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-10">ยังไม่มีสื่อ AR ที่เผยแพร่</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((i) => {
              const Icon = icon(i.media_type);
              const thumb = i.poster_url || (i.media_type === "image" ? i.media_url : null);
              return (
                <Link key={i.id} to={`/ar/${i.code}`}>
                  <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                    <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                      {thumb ? (
                        <img src={thumb} alt={i.title} loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <Icon className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                    <CardContent className="p-3 space-y-2">
                      <h2 className="font-semibold line-clamp-2">{i.title}</h2>
                      <div className="flex flex-wrap gap-1">
                        {i.subject && <Badge variant="outline">{i.subject}</Badge>}
                        {i.grade_level && <Badge variant="outline">{i.grade_level}</Badge>}
                        <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{i.view_count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="สแกน QR สื่อ AR"
        onScan={(raw) => {
          const code = extractArCode(raw);
          setScanOpen(false);
          if (code) navigate(`/ar/${code}`);
        }}
      />
    </div>
  );
}
