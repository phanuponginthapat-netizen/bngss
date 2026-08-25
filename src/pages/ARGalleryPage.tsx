import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, ScanLine, Search, Eye, MapPin, Image as ImageIcon, Video, Box, FolderOpen } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import ArImage from "@/components/ar/ArImage";
import { extractArCode } from "@/lib/arCode";

interface ArItem {
  id: string; code: string; title: string; description: string | null;
  media_type: string; media_url: string; poster_url: string | null;
  subject: string | null; grade_level: string | null; tags: string[] | null; view_count: number;
}

interface ArProject {
  id: string; slug: string; title: string; description: string | null;
  cover_url: string | null; location: string | null; item_count: number;
}

const icon = (t: string) => (t === "model3d" ? Box : t === "image" ? ImageIcon : Video);

export { extractArCode };

export default function ARGalleryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ArItem[]>([]);
  const [projects, setProjects] = useState<ArProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    document.title = "คลังสื่อ AR แหล่งเรียนรู้ | สแกน QR ดูภาพ วิดีโอ และโมเดล 3 มิติ";
    (async () => {
      const [list, projs] = await Promise.all([
        (supabase.rpc as any)("list_public_ar_experiences", { _limit: 120 }),
        (supabase.rpc as any)("list_public_ar_projects", { _limit: 60 }),
      ]);
      setItems(Array.isArray(list.data) ? list.data : []);
      setProjects(Array.isArray(projs.data) ? projs.data : []);
      setLoading(false);
    })();
  }, []);

  const k = q.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!k) return items;
    return items.filter((i) =>
      [i.title, i.description, i.subject, i.grade_level, i.code, ...(i.tags || [])]
        .filter(Boolean).join(" ").toLowerCase().includes(k));
  }, [items, k]);

  const filteredProjects = useMemo(() => {
    if (!k) return projects;
    return projects.filter((p) =>
      [p.title, p.description, p.location, p.slug].filter(Boolean).join(" ").toLowerCase().includes(k));
  }, [projects, k]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="max-w-5xl mx-auto p-4 space-y-6">
        <header className="text-center space-y-2 pt-4">
          <Boxes className="h-10 w-10 mx-auto text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">คลังสื่อ AR แหล่งเรียนรู้</h1>
          <p className="text-sm text-muted-foreground">สแกน QR Code ที่ป้ายเพื่อดูภาพ วิดีโอ หรือโมเดล 3 มิติแบบ AR ได้ทันที ไม่ต้องเข้าสู่ระบบ</p>
        </header>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหางาน ชื่อสื่อ วิชา หรือรหัส" className="pl-9" />
          </div>
          <Button onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4 mr-2" />สแกน QR</Button>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-10">กำลังโหลด...</p>
        ) : (
          <>
            {filteredProjects.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-semibold flex items-center gap-2"><FolderOpen className="h-5 w-5 text-primary" />งาน / นิทรรศการ</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredProjects.map((p) => (
                    <Link key={p.id} to={`/ar/p/${p.slug}`}>
                      <Card className="h-full hover:shadow-lg transition-shadow overflow-hidden">
                        <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
                          {p.cover_url ? (
                            <ArImage src={p.cover_url} alt={p.title} className="w-full h-full object-cover" />
                          ) : (
                            <FolderOpen className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                        <CardContent className="p-3 space-y-1">
                          <h3 className="font-semibold line-clamp-2">{p.title}</h3>
                          {p.location && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{p.location}</p>
                          )}
                          <Badge variant="secondary">{p.item_count} ป้าย</Badge>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Boxes className="h-5 w-5 text-primary" />สื่อทั้งหมด</h2>
              {filtered.length === 0 ? (
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
                              <ArImage src={thumb} alt={i.title} className="w-full h-full object-cover" />
                            ) : (
                              <Icon className="h-10 w-10 text-muted-foreground" />
                            )}
                          </div>
                          <CardContent className="p-3 space-y-2">
                            <h3 className="font-semibold line-clamp-2">{i.title}</h3>
                            <div className="flex flex-wrap gap-2 items-center">
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
            </section>
          </>
        )}
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="สแกน QR สื่อ AR"
        onScan={(raw) => {
          const c = extractArCode(raw);
          setScanOpen(false);
          if (c.code) navigate(c.type === "project" ? `/ar/p/${c.code}` : `/ar/${c.code}`);
        }}
      />
    </div>
  );
}
