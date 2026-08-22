import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Maximize, Minimize } from "lucide-react";

type StreamStatus = "connecting" | "ready" | "error";

interface RtspLivePlayerProps {
  url: string;
  title: string;
}

function getStreamType(url: string): "hls" | "mjpeg" | "rtsp" | "unknown" {
  const lower = url.toLowerCase();
  if (lower.endsWith(".m3u8") || lower.includes("/hls/") || lower.includes("hls")) return "hls";
  if (lower.includes("mjpeg") || lower.endsWith(".mjpg") || lower.endsWith(".mjpeg")) return "mjpeg";
  if (lower.startsWith("rtsp://")) return "rtsp";
  return "unknown";
}

export default function RtspLivePlayer({ url, title }: RtspLivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const streamType = getStreamType(url);

  useEffect(() => {
    if (streamType === "hls" && videoRef.current) {
      let hls: any = null;
      const video = videoRef.current;

      const initHls = async () => {
        try {
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => setStatus("ready"));
            hls.on(Hls.Events.ERROR, (_: any, data: any) => {
              if (data.fatal) setStatus("error");
            });
          } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            video.addEventListener("loadedmetadata", () => setStatus("ready"));
            video.addEventListener("error", () => setStatus("error"));
          } else {
            setStatus("error");
          }
        } catch {
          setStatus("error");
        }
      };

      initHls();
      return () => {
        hls?.destroy();
      };
    }

    if (streamType === "mjpeg" && imgRef.current) {
      const img = imgRef.current;
      img.onload = () => setStatus("ready");
      img.onerror = () => setStatus("error");
      img.src = url;
    }

    if (streamType === "rtsp") {
      setStatus("error");
    }
  }, [url, streamType]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const statusColors: Record<StreamStatus, "default" | "secondary" | "destructive"> = {
    connecting: "secondary",
    ready: "default",
    error: "destructive",
  };

  const statusLabels: Record<StreamStatus, string> = {
    connecting: "Connecting...",
    ready: "Live",
    error: "Error",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={statusColors[status]}>{statusLabels[status]}</Badge>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent ref={containerRef}>
        {streamType === "hls" && (
          <video ref={videoRef} className="w-full rounded-md bg-black aspect-video" controls autoPlay muted playsInline />
        )}
        {streamType === "mjpeg" && (
          <img ref={imgRef} className="w-full rounded-md bg-black aspect-video object-contain" alt={title} />
        )}
        {streamType === "rtsp" && (
          <div className="flex flex-col items-center justify-center aspect-video bg-muted rounded-md gap-3">
            <p className="text-sm text-muted-foreground">Requires WebRTC proxy</p>
            <a
              href="https://github.com/ALEX-WHITMAN/go2rtc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              View go2rtc documentation
            </a>
          </div>
        )}
        {streamType === "unknown" && (
          <div className="flex items-center justify-center aspect-video bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Unsupported stream format</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
