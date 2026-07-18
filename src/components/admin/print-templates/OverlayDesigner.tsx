import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, MoveDiagonal } from "lucide-react";
import { tokenThaiLabel } from "@/lib/print-template-tokens";

// A field placed on the background, units in mm.
export interface OverlayField {
  id: string;
  x: number; // mm from left
  y: number; // mm from top
  w: number; // mm
  h: number; // mm
  fontSize: number; // px
  fontFamily: string; // ฟอนต์เฉพาะฟิลด์ (แก้ได้แม้เป็นฟิลด์ต้นแบบ)
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  token: string; // e.g. {{student.full_name}}
}

interface Props {
  backgroundUrl: string;
  paper: "A4" | "A5" | "A6" | "letter";
  orientation: "portrait" | "landscape";
  /** Parse existing body_html on mount; emit updated body_html on change. */
  bodyHtml: string;
  onChange: (bodyHtml: string, fields: OverlayField[]) => void;
  variableSuggestions?: string[];
}

const PAPER_MM: Record<string, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  A6: [105, 148],
  letter: [216, 279],
};

const FONT_OPTIONS = [
  "Sarabun",
  "IBM Plex Sans Thai", "Prompt", "Kanit", "Mitr", "Noto Sans Thai",
  "Arial", "Times New Roman",
];

const parseFields = (html: string): OverlayField[] => {
  const out: OverlayField[] = [];
  const re = /<span[^>]*class=["']pt-field["'][^>]*data-id=["']([^"']+)["'][^>]*style=["']([^"']+)["'][^>]*>([\s\S]*?)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [, id, style, content] = m;
    const get = (k: string, def = 0) => {
      const mm = new RegExp(`${k}\\s*:\\s*([\\d.]+)mm`).exec(style);
      return mm ? Number(mm[1]) : def;
    };
    // รองรับทั้ง px (ใหม่) และ pt (เดิม) — แปลง pt เป็น px อัตโนมัติ
    const fsPx = /font-size\s*:\s*([\d.]+)px/.exec(style);
    const fsPt = /font-size\s*:\s*([\d.]+)pt/.exec(style);
    const fontSize = fsPx ? Number(fsPx[1]) : fsPt ? Math.round(Number(fsPt[1]) * 4 / 3) : 21;
    const ff = /font-family\s*:\s*(['"]?)([^;'"]+)\1/.exec(style);
    const align = /text-align\s*:\s*(left|center|right)/.exec(style);
    const bold = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
    const italic = /font-style\s*:\s*italic/.test(style);
    const underline = /text-decoration\s*:[^;]*underline/.test(style);
    const colorM = /(?<![-\w])color\s*:\s*([^;]+)/.exec(style);
    out.push({
      id,
      x: get("left"),
      y: get("top"),
      w: get("width", 60),
      h: get("height", 8),
      fontSize,
      fontFamily: ff?.[2]?.trim() || "Sarabun",
      align: (align?.[1] as any) || "left",
      bold,
      italic,
      underline,
      color: (colorM?.[1] || "#000").trim(),
      token: content.trim(),
    });
  }
  return out;
};

const serializeFields = (fields: OverlayField[]): string =>
  fields
    .map((f) => {
      const s: string[] = [
        `left:${f.x}mm`,
        `top:${f.y}mm`,
        `width:${f.w}mm`,
        `height:${f.h}mm`,
        `font-size:${f.fontSize}px`,
        `font-family:'${f.fontFamily.replace(/'/g, "")}'`,
        `text-align:${f.align}`,
        `color:${f.color}`,
      ];
      if (f.bold) s.push("font-weight:bold");
      if (f.italic) s.push("font-style:italic");
      if (f.underline) s.push("text-decoration:underline");
      return `<span class="pt-field" data-id="${f.id}" style="${s.join("; ")};">${f.token}</span>`;
    })
    .join("\n");

export default function OverlayDesigner({
  backgroundUrl,
  paper,
  orientation,
  bodyHtml,
  onChange,
  variableSuggestions = [],
}: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [fields, setFields] = useState<OverlayField[]>(() => parseFields(bodyHtml));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: OverlayField } | null>(null);

  const [pw, ph] = useMemo(() => {
    const base = PAPER_MM[paper] || PAPER_MM.A4;
    return orientation === "landscape" ? [base[1], base[0]] : base;
  }, [paper, orientation]);

  // Stage scale: fit width to container (max 800px) preserving aspect
  const [stageWidth, setStageWidth] = useState(640);
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (stageRef.current?.parentElement) {
        const w = Math.min(stageRef.current.parentElement.clientWidth - 8, 800);
        setStageWidth(Math.max(360, w));
      }
    });
    if (stageRef.current?.parentElement) ro.observe(stageRef.current.parentElement);
    return () => ro.disconnect();
  }, []);
  const pxPerMm = stageWidth / pw;
  const stageHeight = ph * pxPerMm;

  // Emit upward whenever fields change
  useEffect(() => {
    onChange(serializeFields(fields), fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const addField = (xMm: number, yMm: number) => {
    const id = `f${Date.now().toString(36)}`;
    const f: OverlayField = {
      id, x: xMm, y: yMm, w: 60, h: 8,
      fontSize: 21, fontFamily: "Sarabun",
      align: "left", bold: false, italic: false, underline: false,
      color: "#000",
      token: "{{field}}",
    };
    setFields((arr) => [...arr, f]);
    setSelectedId(id);
  };

  const onStageClick = (e: React.MouseEvent) => {
    if (drag) return;
    if (e.target !== stageRef.current && (e.target as HTMLElement).dataset?.role !== "bg") return;
    const rect = stageRef.current!.getBoundingClientRect();
    const xMm = (e.clientX - rect.left) / pxPerMm;
    const yMm = (e.clientY - rect.top) / pxPerMm;
    addField(Math.max(0, xMm - 30), Math.max(0, yMm - 4));
  };

  const startDrag = (e: React.PointerEvent, f: OverlayField, mode: "move" | "resize") => {
    e.stopPropagation();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    setSelectedId(f.id);
    setDrag({ id: f.id, mode, startX: e.clientX, startY: e.clientY, orig: { ...f } });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      e.preventDefault();
      const dxMm = (e.clientX - drag.startX) / pxPerMm;
      const dyMm = (e.clientY - drag.startY) / pxPerMm;
      setFields((arr) =>
        arr.map((x) => {
          if (x.id !== drag.id) return x;
          if (drag.mode === "move") {
            return { ...x, x: Math.max(0, drag.orig.x + dxMm), y: Math.max(0, drag.orig.y + dyMm) };
          }
          return { ...x, w: Math.max(10, drag.orig.w + dxMm), h: Math.max(4, drag.orig.h + dyMm) };
        })
      );
    };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, pxPerMm]);

  const selected = fields.find((f) => f.id === selectedId) || null;
  const updateSelected = (patch: Partial<OverlayField>) => {
    if (!selected) return;
    setFields((arr) => arr.map((f) => (f.id === selected.id ? { ...f, ...patch } : f)));
  };
  const removeSelected = () => {
    if (!selected) return;
    setFields((arr) => arr.filter((f) => f.id !== selected.id));
    setSelectedId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
      <div className="border rounded-lg overflow-hidden bg-muted/40">
        <div className="bg-muted px-3 py-1.5 text-xs flex items-center justify-between">
          <span>คลิกบนพื้นหลังเพื่อเพิ่มฟิลด์ · ลากเพื่อย้าย · ลากมุมขวาล่างเพื่อปรับขนาด</span>
          <span className="font-mono">{pw}×{ph}mm</span>
        </div>
        <div className="p-2 overflow-auto" style={{ maxHeight: "70vh" }}>
          <div
            ref={stageRef}
            onClick={onStageClick}
            className="relative mx-auto shadow-md cursor-crosshair select-none"
            data-role="bg"
            style={{
              width: stageWidth,
              height: stageHeight,
              backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
              backgroundSize: "100% 100%",
              backgroundColor: "#fff",
              outline: "1px solid #e5e7eb",
            }}
          >
            {fields.map((f) => {
              const sel = f.id === selectedId;
              return (
                <div
                  key={f.id}
                  onPointerDown={(e) => startDrag(e, f, "move")}
                  className={`absolute group touch-none ${sel ? "ring-2 ring-primary" : "ring-1 ring-blue-400/60"} bg-yellow-50/70 hover:bg-yellow-100/80 cursor-move`}
                  style={{
                    left: f.x * pxPerMm,
                    top: f.y * pxPerMm,
                    width: f.w * pxPerMm,
                    height: Math.max(f.h * pxPerMm, 16),
                    fontSize: Math.max(8, f.fontSize * pxPerMm * 0.26),
                    fontFamily: `'${f.fontFamily}', sans-serif`,
                    textAlign: f.align,
                    fontWeight: f.bold ? 700 : 400,
                    fontStyle: f.italic ? "italic" : "normal",
                    textDecoration: f.underline ? "underline" : "none",
                    color: f.color,
                    overflow: "hidden",
                    lineHeight: 1.2,
                    padding: "0 2px",
                  }}
                  title={f.token}
                >
                  <span className="opacity-80 text-[10px] block truncate">{f.token}</span>
                  <div
                    onPointerDown={(e) => startDrag(e, f, "resize")}
                    className="absolute -right-1 -bottom-1 w-5 h-5 bg-primary rounded-sm cursor-se-resize touch-none flex items-center justify-center"
                  >
                    <MoveDiagonal className="w-3 h-3 text-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inspector */}
      <div className="border rounded-lg p-3 space-y-3 text-sm bg-card">
        <div className="font-medium flex items-center gap-1">
          <Plus className="w-4 h-4" /> เครื่องมือฟิลด์
        </div>
        {!selected && (
          <p className="text-xs text-muted-foreground">คลิกบนหน้ากระดาษเพื่อเพิ่มฟิลด์ใหม่ หรือเลือกฟิลด์ที่มีอยู่</p>
        )}
        {selected && (
          <div className="space-y-2">
            <div>
              <Label className="text-xs">ตัวแปร / ข้อความ</Label>
              <Input value={selected.token} onChange={(e) => updateSelected({ token: e.target.value })} className="font-mono text-xs" />
              {variableSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1 max-h-24 overflow-auto">
                  {variableSuggestions.slice(0, 30).map((v) => (
                    <button
                      key={v}
                      type="button"
                      title={`{{${v}}}`}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/70"
                      onClick={() => updateSelected({ token: `{{${v}}}` })}
                    >
                      {tokenThaiLabel(v)}
                      <span className="ml-1 text-muted-foreground font-mono">{`{{${v}}}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">x (mm)</Label>
                <Input type="number" value={selected.x.toFixed(1)} onChange={(e) => updateSelected({ x: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">y (mm)</Label>
                <Input type="number" value={selected.y.toFixed(1)} onChange={(e) => updateSelected({ y: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">กว้าง (mm)</Label>
                <Input type="number" value={selected.w.toFixed(1)} onChange={(e) => updateSelected({ w: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">สูง (mm)</Label>
                <Input type="number" value={selected.h.toFixed(1)} onChange={(e) => updateSelected({ h: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">ขนาดฟอนต์ (px)</Label>
                <Input type="number" value={selected.fontSize} onChange={(e) => updateSelected({ fontSize: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">จัดวาง</Label>
                <select
                  className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                  value={selected.align}
                  onChange={(e) => updateSelected({ align: e.target.value as any })}
                >
                  <option value="left">ซ้าย</option>
                  <option value="center">กลาง</option>
                  <option value="right">ขวา</option>
                </select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">ฟอนต์ (แก้ได้แม้เป็นฟิลด์ต้นแบบ)</Label>
                <Select value={selected.fontFamily} onValueChange={(v) => updateSelected({ fontFamily: v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">สีตัวอักษร</Label>
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => updateSelected({ color: e.target.value })}
                  className="w-full h-9 rounded border cursor-pointer p-1"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={selected.bold} onChange={(e) => updateSelected({ bold: e.target.checked })} />
                <b>ตัวหนา</b>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={selected.italic} onChange={(e) => updateSelected({ italic: e.target.checked })} />
                <i>ตัวเอียง</i>
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={selected.underline} onChange={(e) => updateSelected({ underline: e.target.checked })} />
                <u>ขีดเส้นใต้</u>
              </label>
            </div>
            <Button variant="destructive" size="sm" className="w-full" onClick={removeSelected}>
              <Trash2 className="w-4 h-4 mr-1" /> ลบฟิลด์
            </Button>
          </div>
        )}
        <div className="pt-2 border-t text-[11px] text-muted-foreground">
          ฟิลด์จะถูกเขียนลงใน Body อัตโนมัติเป็น <code>&lt;span class="pt-field"&gt;</code>
        </div>
      </div>
    </div>
  );
}
