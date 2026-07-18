import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { GraduationCap, User, Calendar, Droplets, Phone, MapPin } from "lucide-react";
import { LineLinkQR } from "@/components/LineLinkQR";
import type { IdCardSettings } from "@/hooks/useIdCardSettings";
import AutoFitText from "@/components/AutoFitText";
import { useResolvedImageUrl } from "@/lib/storageUrl";

interface CardPersonData {
  name: string;
  code: string;
  className?: string;
  positionTitle?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  bloodType?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  phone?: string;
  qrValue?: string;
}

interface IdCardFrontProps {
  cs: IdCardSettings;
  person: CardPersonData;
  width?: number;
  className?: string;
  id?: string;
}

const TH_MONTHS_SHORT = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const formatThaiDob = (s?: string) => {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  const monthName = TH_MONTHS_SHORT[parseInt(mo, 10)] || mo;
  return `${parseInt(d, 10)} ${monthName} ${parseInt(y, 10) + 543}`;
};

const SmartCardName = ({ name }: { name: string }) => {
  const containerRef = useRef<HTMLParagraphElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [forceSurnameBreak, setForceSurnameBreak] = useState(false);

  const parts = useMemo(() => name.split(" ").filter(Boolean), [name]);
  const firstName = parts[0] ?? "";
  const surname = parts.slice(1).join(" ");

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;

    if (!container || !measure || parts.length < 2) {
      setForceSurnameBreak(false);
      return;
    }

    const updateBreakMode = () => {
      const availableWidth = container.clientWidth;
      const fullNameWidth = measure.scrollWidth;
      setForceSurnameBreak(fullNameWidth > availableWidth);
    };

    updateBreakMode();

    const observer = new ResizeObserver(updateBreakMode);
    observer.observe(container);

    return () => observer.disconnect();
  }, [name, parts.length]);

  return (
    <>
      <span
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute opacity-0 whitespace-nowrap"
        style={{ insetInlineStart: 0, insetBlockStart: 0 }}
      >
        {name}
      </span>
      <p
        ref={containerRef}
        className="font-bold text-foreground w-full text-[12px]"
        style={{
          lineHeight: "1.4",
          paddingBlock: "1px",
          whiteSpace: forceSurnameBreak ? "normal" : "nowrap",
          overflow: "hidden",
          textOverflow: forceSurnameBreak ? "clip" : "ellipsis",
        }}
      >
        {forceSurnameBreak ? (
          <>
            <span className="block truncate" style={{ lineHeight: "1.4" }}>{firstName}</span>
            <span className="block truncate" style={{ lineHeight: "1.4" }}>{surname}</span>
          </>
        ) : (
          name
        )}
      </p>
    </>
  );
};

// ขนาดอ้างอิงของบัตร — ทุก font/spacing ในบัตรอิงตามค่านี้ แล้ว scale ตาม width
const CARD_BASE_WIDTH = 240;
const CARD_BASE_HEIGHT = (CARD_BASE_WIDTH * 86) / 54;

// Wrapper ทำให้ font + spacing เท่ากันทุกที่ (editor / profile / print)
const ScaledCard = ({
  width,
  className,
  id,
  children,
}: {
  width: number;
  className?: string;
  id?: string;
  children: ReactNode;
}) => {
  const scale = width / CARD_BASE_WIDTH;
  const outerHeight = CARD_BASE_HEIGHT * scale;
  return (
    <div
      id={id}
      className={className}
      style={{ width, height: outerHeight, position: "relative" }}
    >
      <div
        style={{
          width: CARD_BASE_WIDTH,
          height: CARD_BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const IdCardFront = ({ cs, person, width = 360, className = "", id }: IdCardFrontProps) => {
  const radius = `${cs.card_border_radius}px`;
  const avatarUrl = useResolvedImageUrl(person.avatarUrl);

  return (
    <ScaledCard width={width} id={id} className={className}>
    <div
      className={`shadow-2xl overflow-hidden bg-white flex flex-col`}
      style={{ width: CARD_BASE_WIDTH, height: CARD_BASE_HEIGHT, borderRadius: radius, border: `2px solid ${cs.accent_color}20` }}
    >
      {/* Header */}
      <div
        className="px-3 py-2 relative"
        style={{
          background: cs.bg_image_url
            ? "transparent"
            : `linear-gradient(135deg, ${cs.header_color_from}, ${cs.header_color_to})`,
          color: cs.text_color,
        }}
      >
        {cs.bg_image_url && (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${cs.bg_image_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        )}
        <div className="relative z-10 flex items-center gap-3">
          {cs.logo_url ? (
            <img src={cs.logo_url} alt="Logo" className="w-11 h-11 object-contain" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">
              <GraduationCap className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <AutoFitText as="h3" maxFontSize={11} minFontSize={8} maxLines={2} className="font-bold">
              {cs.school_name}
            </AutoFitText>
            {cs.school_name_en && (
              <AutoFitText maxFontSize={9} minFontSize={7} maxLines={1} className="opacity-80">
                {cs.school_name_en}
              </AutoFitText>
            )}
            <AutoFitText maxFontSize={9} minFontSize={7} maxLines={1} className="opacity-70">
              {cs.card_subtitle}
            </AutoFitText>
          </div>
        </div>
        {(cs.logo_url_2 || cs.logo_url_3) && (
          <div className="absolute z-20 flex items-center gap-1" style={{ top: 3, right: 4 }}>
            {cs.logo_url_2 && (
              <img
                src={cs.logo_url_2}
                alt="Logo 2"
                className="object-contain shrink-0 print:!h-[14px] print:!w-auto"
                style={{ height: 14, width: "auto", maxWidth: "none" }}
              />
            )}
            {cs.logo_url_3 && (
              <img
                src={cs.logo_url_3}
                alt="Logo 3"
                className="object-contain shrink-0 print:!h-[14px] print:!w-auto"
                style={{ height: 14, width: "auto", maxWidth: "none" }}
              />
            )}
          </div>
        )}
      </div>


      {/* Body wrapper (with optional background image, never covers header) */}
      <div className="relative flex-1 flex flex-col min-h-0">
        {cs.body_bg_image_url && (
          <>
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `url(${cs.body_bg_image_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden
            />
            {/* white overlay เพื่อให้ข้อความอ่านง่าย */}
            <div className="absolute inset-0 pointer-events-none bg-white/70" aria-hidden />
          </>
        )}

        {/* Body */}
        <div className="relative z-10 px-3 py-2 flex gap-2 flex-1 min-h-0 items-start">
          <div className="shrink-0 flex">
            <div
              className="w-[88px] h-[118px] rounded-lg overflow-hidden border-2 shadow-md flex items-center justify-center shrink-0"
              style={{ borderColor: cs.accent_color, background: `linear-gradient(135deg, ${cs.accent_color}20, ${cs.accent_color}05)` }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={person.name}
                  loading="eager"
                  decoding="sync"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-8 h-8" style={{ color: cs.accent_color }} />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-start gap-1">
            <div className="min-w-0">
              <p className="text-[9px] text-muted-foreground leading-none mb-0.5">ชื่อ-สกุล</p>
              {(() => {
                const cleaned = person.name
                  .replace(/\\n/g, " ")
                  .replace(/^(ด\.ช\.|ด\.ญ\.|นาย|นางสาว|นาง|น\.ส\.|เด็กชาย|เด็กหญิง)\s*/u, "")
                  .replace(/\s+/g, " ")
                  .trim();
                // แยกชื่อ/นามสกุล แล้วบังคับขึ้นบรรทัดใหม่ระหว่างชื่อกับนามสกุล
                const parts = cleaned.split(" ");
                const firstName = parts[0] || "";
                const lastName = parts.slice(1).join(" ");
                return (
                  <p
                    className="font-bold text-foreground"
                    style={{
                      fontSize: "15px",
                      lineHeight: 1.24,
                      paddingTop: "2px",
                      paddingBottom: "1px",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {firstName}
                    {lastName && <><br />{lastName}</>}
                  </p>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 min-w-0">
              {person.code && (
                <div className="min-w-0">
                  <p className="text-[9px] leading-tight mb-0.5" style={{ color: "#555" }}>รหัส</p>
                  <p className="font-semibold font-mono" style={{ fontSize: 11, lineHeight: 1.5, color: "#000", whiteSpace: "nowrap", overflow: "visible" }}>
                    {person.code}
                  </p>
                </div>
              )}
              {person.className && (
                <div className="min-w-0">
                  <p className="text-[9px] leading-tight mb-0.5" style={{ color: "#555" }}>ชั้น</p>
                  <p className="font-bold" style={{ fontSize: 11, lineHeight: 1.5, color: "#000", whiteSpace: "nowrap", overflow: "visible" }}>
                    {person.className}
                  </p>
                </div>
              )}
              {person.positionTitle && (
                <div className="min-w-0 col-span-2">
                  <p className="text-[9px] text-muted-foreground leading-none mb-0.5">ตำแหน่ง</p>
                  <AutoFitText maxFontSize={11} minFontSize={8} maxLines={2} className="font-semibold text-foreground leading-tight">
                    {person.positionTitle}
                  </AutoFitText>
                </div>
              )}
            </div>
            {cs.show_dob && person.dateOfBirth && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground leading-none mt-0.5">
                <Calendar className="w-3 h-3" /> <span>{formatThaiDob(person.dateOfBirth)}</span>
              </div>
            )}
            {cs.show_blood_type && person.bloodType && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground leading-none">
                <Droplets className="w-3 h-3 text-destructive" /> <span>หมู่เลือด {person.bloodType}</span>
              </div>
            )}
          </div>
        </div>

        {/* QR Footer */}
        {cs.show_qr && person.qrValue && (
          <div className="relative z-10 px-2 pb-2 pt-1 flex flex-col items-center gap-0.5 border-t border-border/50 mt-auto">
            <div className="p-1 bg-white rounded border border-border/50">
              <QRCodeSVG
                value={person.qrValue}
                size={Math.round(CARD_BASE_WIDTH * 0.52)}
                fgColor="#000000"
                bgColor="#ffffff"
                level="H"
              />
            </div>
            <div className="text-[7px] text-muted-foreground leading-tight text-center">
              <p>สแกนเพื่อระบุตัวตน · ID: <span className="font-mono" style={{ color: cs.accent_color }}>{person.code || "—"}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
    </ScaledCard>
  );
};

interface IdCardBackProps {
  cs: IdCardSettings;
  person: CardPersonData;
  width?: number;
  className?: string;
  id?: string;
}

export const IdCardBack = ({ cs, person, width = 360, className = "", id }: IdCardBackProps) => {
  const radius = `${cs.card_border_radius}px`;

  return (
    <ScaledCard width={width} id={id} className={className}>
    <div
      className={`shadow-2xl overflow-hidden bg-white`}
      style={{ width: CARD_BASE_WIDTH, height: CARD_BASE_HEIGHT, borderRadius: radius, border: `2px solid ${cs.accent_color}20` }}
    >
      <div
        className="px-3 py-2 text-center"
        style={{
          background: `linear-gradient(135deg, ${cs.header_color_from}15, ${cs.header_color_to}15)`,
          borderBottom: `2px solid ${cs.accent_color}20`,
        }}
      >
        <h3 className="font-bold text-xs text-foreground">ข้อมูลติดต่อ</h3>
      </div>
      <div className="px-3 py-2 space-y-1.5 text-xs">
        {cs.show_emergency_contact && person.emergencyContact && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: cs.accent_color }} />
            <span className="text-xs">ผู้ปกครอง: {person.emergencyContact} {person.emergencyPhone || ""}</span>
          </div>
        )}
        {person.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: cs.accent_color }} />
            <span className="text-xs">โทร: {person.phone}</span>
          </div>
        )}
        {cs.school_address && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: cs.accent_color }} />
            <span className="text-xs">{cs.school_address}</span>
          </div>
        )}
        {cs.school_phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: cs.accent_color }} />
            <span className="text-xs">โรงเรียน: {cs.school_phone}</span>
          </div>
        )}

        {/* LINE add-friend + auto-link QR */}
        {cs.show_line_qr && (
          <div className="pt-2 border-t border-dashed border-border">
            <LineLinkQR code={person.code} dob={person.dateOfBirth} size={Math.round(CARD_BASE_WIDTH * 0.42)} fgColor={cs.accent_color} />
          </div>
        )}

        <div className="pt-1.5 mt-0.5 border-t border-dashed border-border">
          <div className="text-center space-y-0.5">
            <div className="w-20 mx-auto border-b border-dotted border-foreground/30 pb-4"></div>
            <p className="text-[9px] text-muted-foreground">ลงชื่อ ผู้อำนวยการโรงเรียน</p>
          </div>
        </div>

        {cs.back_note && (
          <p
            className="text-muted-foreground text-center pt-1 italic text-[10px] leading-snug mx-auto"
            style={{ wordBreak: "break-word", overflowWrap: "anywhere", whiteSpace: "normal", maxWidth: "100%" }}
          >
            {cs.back_note}
          </p>
        )}
      </div>
    </div>
    </ScaledCard>
  );
};
