import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Boxes, Eye, MapPin, ScanLine, Image as ImageIcon, Video, Box, Camera } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import ArImage from "@/components/ar/ArImage";
import ArImageTracker, { type TrackedItem } from "@/components/ar/ArImageTracker";
import { extractArCode } from "@/lib/arCode";

interface Project {
  id: string; slug: string; title: string; description: string | null;
  cover_url: string | null; location: string | null;
  targets_url: string | null; targets_version: number | null;
}

interface Marker extends TrackedItem {
  id: string; code: string; title: string; marker_label: string | null;
  description: string | null; media_type: string; media_url: string;
  poster_url: string | null; sort_order: number; view_count: number;
}

const icon = (t: string) => (t === "model3d" ? Box : t === "image" ? ImageIcon : Video);

export default function ARProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Marker[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanOpen, setScanOpen] = useState(false);
  const [arOpen, setArOpen] = useState(false);


  useEffect(() => {
    (async () => {
      if (!slug) return;
      setLoading(true);
      const [p, list] = await Promise.all([
        (supabase.rpc as any)("get_public_ar_project", { _slug: slug }),
        (supabase.rpc as any)("list_public_ar_project_items", { _slug: slug }),
      ]);
      const row = Array.isArray(p.data) ? p.data[0] : p.data;
      setProject(row || null);
      setItems(Array.isArray(list.data) ? list.data : []);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (project?.title) document.title = `${project.title} | งาน AR แหล่งเรียนรู้`;
  }, [project?.title]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">กำลังโหลด...</div>;
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Boxes className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">ไม่พบงาน AR นี้</h1>
            <p className="text-sm text-muted-foreground">รหัสงาน “{slug}” อาจถูกปิดการเผยแพร่หรือถูกลบแล้ว</p>
            <Button asChild variant="outline"><Link to="/ar"><ArrowLeft className="h-4 w-4 mr-2" />คลังสื่อ AR</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const trackable = items.filter((i) => i.target_index !== null && i.target_index !== undefined);
  const canTrack = !!project.targets_url && trackable.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {arOpen && project.targets_url && (
        <ArImageTracker
          targetsUrl={project.targets_url}
          items={trackable}
          title={project.title}
          onClose={() => setArOpen(false)}
        />
      )}
      <div className="max-w-4xl mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm"><Link to="/ar"><ArrowLeft className="h-4 w-4 mr-2" />คลังสื่อ AR</Link></Button>
          <Button size="sm" variant="outline" onClick={() => setScanOpen(true)}><ScanLine className="h-4 w-4 mr-2" />สแกน QR งานอื่น</Button>
        </div>

        <Card className="overflow-hidden">
          {project.cover_url && (
            <div className="aspect-[3/1] bg-muted">
              <ArImage src={project.cover_url} alt={project.title} className="w-full h-full object-cover" />
            </div>
          )}
          <CardContent className="p-4 space-y-3">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            {project.location && (
              <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-4 w-4" />{project.location}</p>
            )}
            {project.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>}
            <Badge variant="secondary">{trackable.length} เป้าหมาย AR</Badge>
            <Button size="lg" className="w-full" disabled={!canTrack} onClick={() => setArOpen(true)}>
              <Camera className="h-5 w-5 mr-2" />
              {canTrack ? "เปิดกล้อง AR แล้วส่องที่ป้าย/วัตถุ" : "งานนี้ยังไม่พร้อมสแกน AR"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              ส่องกล้องค้างไว้ที่ป้ายหรือวัตถุ ระบบจะเล่นสื่อทับอัตโนมัติ และหยุดเมื่อเลื่อนกล้องออกจากเฟรม
            </p>
          </CardContent>
        </Card>


        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i, idx) => {
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
                  <CardContent className="p-3 space-y-1">
                    <div className="text-xs text-muted-foreground">ป้ายที่ {idx + 1}{i.marker_label ? ` · ${i.marker_label}` : ""}</div>
                    <h2 className="font-semibold line-clamp-2">{i.title}</h2>
                    <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" />{i.view_count}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {items.length === 0 && (
            <p className="text-center text-muted-foreground py-10 sm:col-span-2 lg:col-span-3">ยังไม่มีป้ายในงานนี้</p>
          )}
        </div>
      </div>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="สแกน QR ป้าย AR"
        onScan={(raw) => {
          const c = extractArCode(raw);
          setScanOpen(false);
          if (c) navigate(c.type === "project" ? `/ar/p/${c.code}` : `/ar/${c.code}`);
        }}
      />
    </div>
  );
}
