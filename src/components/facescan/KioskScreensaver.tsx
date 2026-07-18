import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useCmsValues } from "@/hooks/useCmsSettings";
import { useWakeWord } from "@/hooks/useWakeWord";
import { Sparkles, Megaphone, Calendar, Mic } from "lucide-react";
import { BE_OFFSET } from "@/lib/dateBE";

interface Props {
  onWake: () => void;
  onHelloAi?: (source?: "voice" | "button") => void;
  helloAiEnabled?: boolean;
  reasonLabel?: string; // "นอกช่วงเวลาสแกน" / "พักหน้าจอ"
  wakeWordEnabled?: boolean; // ปลุกด้วยคำว่า "สวัสดี AI" (สำหรับเครื่องในตู้)
  helloAiOpen?: boolean; // ปิด wake word ตอนกำลังคุยกับ AI (ใช้ไมค์ร่วมกัน)
}

const thaiDate = (d: Date) => {
  const days = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์"];
  const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  return `วัน${days[d.getDay()]}ที่ ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + BE_OFFSET}`;
};

const KioskScreensaver = ({ onWake, onHelloAi, helloAiEnabled, reasonLabel, wakeWordEnabled, helloAiOpen }: Props) => {
  const { schoolName, schoolLogo } = useSystemSettings();
  const cms = useCmsValues(["school_name_en", "school_motto", "footer_school_name"]);
  const [now, setNow] = useState(new Date());
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ดึงข่าว/กิจกรรมล่าสุด (Publish) — ประชาสัมพันธ์ให้แขกที่มาชม
  const { data: news = [] } = useQuery({
    queryKey: ["kiosk-screensaver-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("id, title, category, cover_image_url, published_at, content")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(8);
      return (data || []) as any[];
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const slides = useMemo(() => {
    const s: Array<{ kind: "welcome" | "news"; title?: string; subtitle?: string; image?: string; category?: string }> = [
      {
        kind: "welcome",
        title: schoolName || cms.footer_school_name || "โรงเรียน",
        subtitle: cms.school_motto || cms.school_name_en || "ยินดีต้อนรับทุกท่าน",
      },
    ];
    for (const n of news) {
      s.push({
        kind: "news",
        title: n.title,
        subtitle: n.category,
        image: n.cover_image_url,
        category: n.category,
      });
    }
    return s;
  }, [news, schoolName, cms]);

  // เปลี่ยนสไลด์ทุก 8 วิ — ช้าพอให้อ่านได้ ประหยัด CPU
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setSlideIdx((i) => (i + 1) % slides.length), 8000);
    return () => clearInterval(t);
  }, [slides.length]);

  const current = slides[slideIdx] || slides[0];

  // Wake-word: "สวัสดี AI" — เปิดใช้เฉพาะตอนที่ Hello AI ให้ใช้งานได้และยังไม่ได้เปิดหน้าคุย
  const wakeActive = !!(wakeWordEnabled && helloAiEnabled && onHelloAi && !helloAiOpen);
  useWakeWord({
    enabled: wakeActive,
    onWake: () => { onHelloAi?.("voice"); },
  });


  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white overflow-hidden cursor-pointer"
      onClick={onWake}
      onTouchStart={onWake}
      onKeyDown={onWake}
      role="button"
      tabIndex={0}
      aria-label="แตะเพื่อปลุกเครื่อง"
    >
      {/* Background image (news) — dimmed */}
      {current?.image && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity duration-1000"
          style={{ backgroundImage: `url(${current.image})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      {/* Top: school logo + name */}
      <div className="absolute top-0 inset-x-0 p-6 flex items-center gap-4">
        {schoolLogo ? (
          <img src={schoolLogo} alt="logo" className="w-16 h-16 object-contain drop-shadow-2xl" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
            <Sparkles className="w-8 h-8" />
          </div>
        )}
        <div className="leading-tight">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{schoolName || cms.footer_school_name}</h1>
          {cms.school_name_en && <p className="text-xs md:text-sm opacity-70">{cms.school_name_en}</p>}
        </div>
        {reasonLabel && (
          <span className="ml-auto text-xs bg-white/10 border border-white/20 rounded-full px-3 py-1 backdrop-blur">
            {reasonLabel}
          </span>
        )}
      </div>

      {/* Center: big clock */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
        <p className="text-8xl md:text-[10rem] font-bold tabular-nums drop-shadow-2xl leading-none">
          {now.toLocaleTimeString("en-GB", { hour12: false, hour: "2-digit", minute: "2-digit" })}
        </p>
        <p className="text-lg md:text-2xl opacity-80">{thaiDate(now)}</p>
      </div>

      {/* Bottom: slide content (news / welcome) */}
      <div className="absolute bottom-0 inset-x-0 p-6 md:p-10">
        <div className="max-w-4xl mx-auto bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 p-5 md:p-6 shadow-2xl transition-all duration-500">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-300 mb-2">
            {current?.kind === "news" ? <Megaphone className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            {current?.kind === "news" ? (current.category || "ข่าวประชาสัมพันธ์") : "ยินดีต้อนรับ"}
          </div>
          <h2 className="text-2xl md:text-4xl font-bold leading-snug line-clamp-3">
            {current?.title}
          </h2>
          {current?.subtitle && current.kind === "welcome" && (
            <p className="mt-2 text-base md:text-lg opacity-80">{current.subtitle}</p>
          )}
          {/* Slide dots */}
          {slides.length > 1 && (
            <div className="flex gap-1.5 mt-4">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === slideIdx ? "w-8 bg-white" : "w-2 bg-white/30"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col md:flex-row items-center justify-center gap-3 text-sm opacity-70">
          <span>แตะที่ใดก็ได้เพื่อเริ่มสแกน</span>
          {wakeActive && (
            <span className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-3 py-1 rounded-full text-xs">
              <Mic className="w-3.5 h-3.5 animate-pulse" />
              หรือพูดว่า “สวัสดี AI”
            </span>
          )}
          {helloAiEnabled && onHelloAi && (
            <button
              onClick={(e) => { e.stopPropagation(); onHelloAi("button"); }}
              className="pointer-events-auto flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white px-5 py-2.5 rounded-full font-semibold shadow-lg border border-white/20"
            >
              <Sparkles className="w-4 h-4" />
              พูดคุยกับ Hello AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KioskScreensaver;
