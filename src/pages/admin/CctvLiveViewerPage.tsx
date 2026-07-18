import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Video, Play, Square, RefreshCw, Camera as CameraIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Camera {
  id: string;
  name: string;
  location: string | null;
  hls_url: string | null;
  snapshot_url: string | null;
  is_active: boolean;
}

function CameraTile({ cam }: { cam: Camera }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = () => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
    setPlaying(false);
  };

  const start = () => {
    setError(null);
    const url = cam.hls_url;
    const video = videoRef.current;
    if (!url || !video) {
      setError("ยังไม่ได้ตั้งค่า HLS URL");
      return;
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError("เชื่อมต่อสตรีมไม่สำเร็จ");
          stop();
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      setError("เบราว์เซอร์ไม่รองรับ HLS");
      return;
    }
    setPlaying(true);
  };

  useEffect(() => () => stop(), []);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CameraIcon className="h-4 w-4" />
            {cam.name}
          </CardTitle>
          <Badge variant={cam.is_active ? "default" : "secondary"}>
            {cam.is_active ? "Active" : "Off"}
          </Badge>
        </div>
        {cam.location && (
          <p className="text-xs text-muted-foreground">{cam.location}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="relative aspect-video bg-black rounded-md overflow-hidden">
          <video
            ref={videoRef}
            controls
            muted
            playsInline
            className="w-full h-full object-contain"
            poster={cam.snapshot_url ?? undefined}
          />
          {!playing && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm pointer-events-none">
              กดเล่นเพื่อเริ่มสตรีม
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-danger text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {!playing ? (
            <Button size="sm" onClick={start} disabled={!cam.hls_url}>
              <Play className="h-4 w-4 mr-1" /> เล่น
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={stop}>
              <Square className="h-4 w-4 mr-1" /> หยุด
            </Button>
          )}
          {cam.snapshot_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(cam.snapshot_url!, "_blank")}
            >
              ภาพนิ่ง
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CctvLiveViewerPage() {
  const [cams, setCams] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cctv_cameras")
      .select("id, name, location, hls_url, snapshot_url, is_active")
      .eq("is_active", true)
      .order("name");
    if (error) toast.error(error.message);
    setCams((data ?? []) as Camera[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-6 w-6" />
          <div>
            <h1 className="text-xl font-semibold">CCTV Live Viewer</h1>
            <p className="text-sm text-muted-foreground">
              ดูภาพสดจากกล้องที่ตั้งค่า HLS URL ไว้
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4 mr-1" /> รีเฟรช
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : cams.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            ยังไม่มีกล้องที่เปิดใช้งาน — เพิ่มได้ที่หน้า "กล้องวงจรปิด CCTV"
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {cams.map((c) => (
            <CameraTile key={c.id} cam={c} />
          ))}
        </div>
      )}
    </div>
  );
}
