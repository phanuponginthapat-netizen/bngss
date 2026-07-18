import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle } from "lucide-react";

interface Props {
  /** รหัสนักเรียน / รหัสบุคลากร */
  code: string;
  /** วันเกิด (รูปแบบใดก็ได้ — webhook normalize ให้) */
  dob?: string | null;
  size?: number;
  fgColor?: string;
  label?: string;
}

/**
 * QR สำหรับเพิ่ม LINE OA ของโรงเรียน + เชื่อมบัญชีอัตโนมัติ
 * เมื่อสแกน → เปิด LINE OA พร้อม pre-fill ข้อความ "เชื่อม {code} {dob}"
 * ผู้ใช้แค่กด "ส่ง" — webhook (line-webhook) จะจับและเชื่อมบัญชีอัตโนมัติ
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
      <div className="flex items-start gap-2 rounded border border-dashed border-warning/60 bg-warning-soft p-2 dark:bg-warning/30 dark:border-warning/60">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-warning mt-0.5" />
        <div className="text-[9px] leading-tight text-warning dark:text-warning">
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

  // LINE add-friend deeplink — opens "เพิ่มเพื่อน" page for the OA.
  // (oaMessage URL only works for users who already added the OA, so it
  //  couldn't be used to add the LINE in the first place.)
  const id = basicId.trim().replace(/^@+/, "");
  const url = `https://line.me/R/ti/p/%40${encodeURIComponent(id)}`;

  return (
    <div className="flex items-center gap-2">
      <div className="p-1 bg-white rounded border border-border/50 shrink-0">
        <QRCodeSVG value={url} size={size} fgColor={fgColor} level="M" />
      </div>
      <div className="text-[9px] leading-tight text-muted-foreground">
        <p className="font-semibold" style={{ color: fgColor }}>เพิ่ม LINE โรงเรียน</p>
        <p>{label || "สแกนเพื่อเพิ่มเพื่อน"}</p>
        <p>และเชื่อมบัญชีอัตโนมัติ</p>
      </div>
    </div>
  );
}
