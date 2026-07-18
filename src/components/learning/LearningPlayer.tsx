import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Maximize2, X, Loader2, ExternalLink } from "lucide-react";
import { buildEntryUrl, toYouTubeEmbed, toVimeoEmbed } from "@/lib/learningProxy";

interface LearningContent {
  id: string;
  title: string;
  kind: string;
  storage_path?: string | null;
  external_url?: string | null;
  entry_file?: string | null;
  visibility: string;
  tracking_enabled?: boolean;
}

interface Props {
  content: LearningContent;
  onClose?: () => void;
  anonymous?: boolean; // public share page
}

const HEARTBEAT_MS = 15_000;

export default function LearningPlayer({ content, onClose, anonymous = false }: Props) {
  const [iframeSrc, setIframeSrc] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  // Build src
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    (async () => {
      try {
        let src = "";
        if (content.kind === "youtube") src = toYouTubeEmbed(content.external_url || "");
        else if (content.kind === "vimeo") src = toVimeoEmbed(content.external_url || "");
        else if (content.kind === "embed") src = content.external_url || "";
        else {
          src = await buildEntryUrl(content.id, content.visibility === "public" || anonymous);
        }
        if (!cancelled) {
          setIframeSrc(src);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setLoadError(e?.message || "โหลดสื่อไม่สำเร็จ");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [content.id, content.kind, content.visibility, content.external_url, anonymous]);

  // Tracking: create view row + heartbeat
  useEffect(() => {
    if (!content.tracking_enabled) return;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        content_id: content.id,
        is_anonymous: !user,
        user_id: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("learning_views")
        .insert(payload)
        .select("id")
        .single();
      if (error || cancelled) return;
      viewIdRef.current = data.id;
      startedAtRef.current = Date.now();

      heartbeatTimer = setInterval(async () => {
        if (!viewIdRef.current) return;
        const dur = Math.floor((Date.now() - startedAtRef.current) / 1000);
        await supabase
          .from("learning_views")
          .update({ last_heartbeat_at: new Date().toISOString(), duration_seconds: dur })
          .eq("id", viewIdRef.current);
      }, HEARTBEAT_MS);
    })();

    const sendFinal = () => {
      if (!viewIdRef.current) return;
      const dur = Math.floor((Date.now() - startedAtRef.current) / 1000);
      // best-effort, non-awaited
      supabase
        .from("learning_views")
        .update({ last_heartbeat_at: new Date().toISOString(), duration_seconds: dur })
        .eq("id", viewIdRef.current)
        .then(() => {});
    };
    window.addEventListener("beforeunload", sendFinal);

    return () => {
      cancelled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      sendFinal();
      window.removeEventListener("beforeunload", sendFinal);
    };
  }, [content.id, content.tracking_enabled]);

  const goFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between gap-3 p-3 border-b bg-card">
        <h2 className="font-semibold text-base truncate flex-1">{content.title}</h2>
        <div className="flex items-center gap-2">
          {iframeSrc && (
            <Button variant="outline" size="sm" asChild>
              <a href={iframeSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1" /> เปิดในแท็บใหม่
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={goFullscreen}>
            <Maximize2 className="w-4 h-4 mr-1" /> เต็มจอ
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="ปิด">
              <X className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      <div ref={containerRef} className="flex-1 bg-black relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mr-2" /> กำลังโหลดสื่อ...
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-white p-4 text-center">
            ❌ {loadError}
          </div>
        )}
        {iframeSrc && !loadError && (
          <iframe
            src={iframeSrc}
            title={content.title}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-pointer-lock allow-popups allow-forms allow-modals allow-presentation allow-same-origin"
            allow="autoplay; fullscreen; gamepad; accelerometer; gyroscope; microphone; camera"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
