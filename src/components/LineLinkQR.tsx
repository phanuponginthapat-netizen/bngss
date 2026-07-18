import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

interface Props {
  /** รหัสนักเรียน / รหัสบุคลากร */
  code: string;
  /** วันเกิด (ISO YYYY-MM-DD หรือรูปแบบอื่น) */
  dob?: string | null;
  size?: number;
  fgColor?: string;
  label?: string;
}

/** แปลง ISO YYYY-MM-DD (ค.ศ.) → DDMMYYYY (พ.ศ.) ตามที่ webhook `เชื่อม` รองรับ */
function toThaiBEDdMmYyyy(dob?: string | null): string | null {
  if (!dob) return null;
  const m = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (!y || !mo || !d) return null;
  const be = y < 2400 ? y + 543 : y;
  return `${String(d).padStart(2, "0")}${String(mo).padStart(2, "0")}${be}`;
}

/**
 * QR สำหรับเชื่อมบัญชี LINE OA อัตโนมัติ
 * ใช้ oaMessage deep link ที่ pre-fill ข้อความ "เชื่อม {code} {dob-พ.ศ.}"
 * - ถ้าผู้ใช้ยังไม่เป็นเพื่อน LINE จะให้เพิ่มเพื่อนก่อน แล้วเปิดแชทพร้อมข้อความ
 * - ถ้าเป็นเพื่อนแล้วจะเปิดแชทพร้อมข้อความให้กด "ส่ง" ทันที
 * ผู้ใช้แค่กดส่ง → webhook (line-webhook) จะเชื่อมบัญชีให้อัตโนมัติ
 *
 * ต้องตั้งค่า school_settings.line_oa_basic_id (รวม @ เช่น @abc1234x)
 */
export function LineLinkQR({ code, dob, size = 84, fgColor = "#06C755", label }: Props) {
  const { data: basicId, isLoading } = useQuery({
    queryKey: ["line_oa_basic_id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "line_oa_basic_id")
        .maybeSingle();
      if (error) {
        console.error("[LineLinkQR] fetch error:", error);
        return "";
      }
      return (data?.setting_value || "").trim();
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="bg-muted/40 rounded border border-border/50 shrink-0 animate-pulse"
          style={{ width: size + 8, height: size + 8 }}
        />
        <div className="text-[9px] leading-tight text-muted-foreground">
          <p>กำลังโหลด QR LINE...</p>
        </div>
      </div>
    );
  }

  if (!basicId) {
    return (
      <div className="flex items-start gap-2 rounded border border-dashed border-amber-400/60 bg-amber-50 p-2 dark:bg-amber-950/30 dark:border-amber-700/60">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
        <div className="text-[9px] leading-tight text-amber-800 dark:text-amber-200">
          <p className="font-semibold">ยังไม่ได้ตั้งค่า LINE OA ID</p>
          <p>ไปที่ ตั้งค่า → LINE → กรอก LINE OA Basic ID (เช่น @abc1234x)</p>
        </div>
      </div>
    );
  }

  if (!code) {
    return (
      <div className="text-[9px] leading-tight text-muted-foreground italic">
        ต้องมีรหัสประจำตัวเพื่อสร้าง QR LINE
      </div>
    );
  }

  const id = basicId.trim().replace(/^@+/, "");
  const beDob = toThaiBEDdMmYyyy(dob);

  // oaMessage deep link — เปิดแชท OA พร้อม pre-fill ข้อความ "เชื่อม [code] [dob]"
  // ถ้ายังไม่เป็นเพื่อน LINE จะให้เพิ่มเพื่อนก่อนอัตโนมัติ
  // ถ้าไม่มี DOB (บุคลากรที่ไม่มีวันเกิดในระบบ) → fallback เป็น add-friend ธรรมดา
  const url = beDob
    ? `https://line.me/R/oaMessage/%40${encodeURIComponent(id)}/?${encodeURIComponent(`เชื่อม ${code} ${beDob}`)}`
    : `https://line.me/R/ti/p/%40${encodeURIComponent(id)}`;

  return (
    <div className="flex items-center gap-2">
      <div className="p-1 bg-white rounded border border-border/50 shrink-0">
        <QRCodeSVG value={url} size={size} fgColor={fgColor} level="M" />
      </div>
      <div className="text-[9px] leading-tight text-muted-foreground">
        <p className="font-semibold" style={{ color: fgColor }}>เพิ่ม LINE โรงเรียน</p>
        <p>{label || (beDob ? "สแกน → กดส่งข้อความ" : "สแกนเพื่อเพิ่มเพื่อน")}</p>
        <p>{beDob ? "เชื่อมบัญชีอัตโนมัติ" : "แล้วพิมพ์คำสั่งเชื่อม"}</p>
      </div>
    </div>
  );
}
