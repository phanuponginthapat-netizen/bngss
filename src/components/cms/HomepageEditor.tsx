import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import {
  Upload, Plus, Trash2, GripVertical,
  PanelTop, Image as ImageIcon, BarChart3, LayoutGrid, Megaphone, PanelBottom, Code2, ArrowUpDown,
  User as UserIcon, Link2, Film, Bell
} from "lucide-react";
import RichTextEditor from "./RichTextEditor";
import FullHtmlEditor from "./FullHtmlEditor";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SECTION_DEFS: { key: string; label: string }[] = [
  { key: "stats", label: "แถบสถิติ (Stats Bar)" },
  { key: "banner", label: "ภาพประชาสัมพันธ์ (Banner Carousel)" },
  { key: "director", label: "สารจากผู้บริหาร (Director)" },
  { key: "quicklinks", label: "บริการด่วน (Quick Links)" },
  { key: "content", label: "เนื้อหาหน้าแรก (Rich Content)" },
  { key: "page_content", label: "เนื้อหาจากหน้า CMS (home page)" },
  { key: "features", label: "จุดเด่น / บริการ (Features)" },
  { key: "gallery", label: "อัลบั้มภาพ (Gallery)" },
  { key: "videos", label: "วิดีโอ (Videos)" },
  { key: "cta", label: "ส่วนเรียกร้อง (CTA)" },
  { key: "news", label: "ข่าวสารและประกาศ" },
  { key: "social", label: "Social Wall (Facebook)" },
  { key: "embed", label: "โค้ดฝังเพิ่มเติม (Embed)" },
];
const DEFAULT_ORDER = SECTION_DEFS.map(s => s.key);

function SortableSectionRow({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto" as const,
  };
  return (
    <div ref={setNodeRef} style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card p-3 ${isDragging ? "shadow-lg" : ""}`}>
      <button {...attributes} {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground"
        aria-label="ลากเพื่อจัดลำดับ">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
  );
}

type SettingsMap = Record<string, { id: string; value: string }>;

function SectionOrderEditor({ currentOrder, onChange }: { currentOrder: string[]; onChange: (o: string[]) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = currentOrder.indexOf(active.id as string);
    const newIdx = currentOrder.indexOf(over.id as string);
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(currentOrder, oldIdx, newIdx));
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-primary" /> ลำดับส่วนต่างๆ ในหน้าแรก
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          ลากเพื่อจัดลำดับว่าส่วนใดควรอยู่ก่อนหลัง (เฮดเดอร์อยู่บนสุด, ฟุตเตอร์อยู่ล่างสุดเสมอ)
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={currentOrder} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {currentOrder.map(k => {
                const def = SECTION_DEFS.find(s => s.key === k);
                if (!def) return null;
                return <SortableSectionRow key={k} id={k} label={def.label} />;
              })}
            </div>
          </SortableContext>
        </DndContext>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => onChange(DEFAULT_ORDER)}>
          รีเซ็ตลำดับ
        </Button>
      </CardContent>
    </Card>
  );
}

const HomepageEditor = () => {
  const [settings, setSettings] = useState<SettingsMap>({});
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    const { data } = await supabase.from("cms_settings").select("*");
    if (data) {
      const map: SettingsMap = {};
      data.forEach((s: any) => { map[s.key] = { id: s.id, value: s.value || "" }; });
      setSettings(map);
    }
  };
  useEffect(() => { fetchSettings(); }, []);

  const get = (key: string, fallback = "") => settings[key]?.value || fallback;
  const set = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [key]: { id: prev[key]?.id || "", value }
    }));
  };

  const getJson = (key: string, fallback: any[] = []) => {
    try { return JSON.parse(get(key, "[]")); } catch { return fallback; }
  };
  const setJson = (key: string, value: any) => set(key, JSON.stringify(value));

  const handleSave = async () => {
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    for (const [key, s] of Object.entries(settings)) {
      if (s.id) {
        await supabase.from("cms_settings").update({ value: s.value }).eq("id", s.id);
      } else {
        await supabase.from("cms_settings").insert({ key, value: s.value });
      }
    }
    toast.success("บันทึกหน้าแรกสำเร็จ");
    toast.dismiss(__tid_save_1);
      setSaving(false);
    fetchSettings();
  };

  const uploadImage = async (prefix: string, onUrl: (url: string) => void) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      const { compressImage } = await import("@/lib/imageCompress");
      const compressed = await compressImage(file, { maxWidth: 1920, maxSizeKB: 250 });
      const fileName = `${prefix}_${Date.now()}_${compressed.name}`;
      const result = await uploadPublicFileWithFallback("cms-images", fileName, compressed);
      onUrl(result.publicUrl);
      toast.success(result.usedFallback ? "เพิ่มรูปสำเร็จ (โหมดสำรอง)" : "อัปโหลดสำเร็จ");
    };
    input.click();
  };

  // --- Stats ---
  const defaultStats = [
    { value: "29+", label: "ระบบย่อย" },
    { value: "4", label: "ฝ่ายงาน" },
    { value: "100%", label: "ออนไลน์" },
    { value: "24/7", label: "เข้าถึงได้" },
  ];
  const stats: { value: string; label: string }[] = getJson("homepage_stats", defaultStats);

  const updateStat = (i: number, field: string, val: string) => {
    const arr = [...stats];
    arr[i] = { ...arr[i], [field]: val };
    setJson("homepage_stats", arr);
  };
  const addStat = () => setJson("homepage_stats", [...stats, { value: "", label: "" }]);
  const removeStat = (i: number) => setJson("homepage_stats", stats.filter((_, idx) => idx !== i));

  // --- Features ---
  const defaultFeatures = [
    { icon: "BookOpen", title: "ระบบวิชาการครบวงจร", desc: "จัดการหลักสูตร ลงทะเบียน บันทึกคะแนน ตัดเกรดอัตโนมัติ" },
    { icon: "Users", title: "กิจการนักเรียน", desc: "ระบบเช็กชื่อ พฤติกรรม คัดกรอง เยี่ยมบ้าน ครบจบในที่เดียว" },
    { icon: "Shield", title: "ปลอดภัยและน่าเชื่อถือ", desc: "ระบบรักษาความปลอดภัยข้อมูลระดับสูง แบ่งสิทธิ์ตามบทบาท" },
    { icon: "Clock", title: "บริหารงานบุคคล", desc: "ลงเวลา ลาออนไลน์ ประเมินผล จัดการข้อมูลบุคลากร" },
    { icon: "Award", title: "ใบรับรองดิจิทัล", desc: "ออก ปพ.1 ปพ.2 ใบรับรอง Transcript อัตโนมัติ" },
    { icon: "Heart", title: "สุขภาพและความปลอดภัย", desc: "ห้องพยาบาล วัคซีน ประกาศฉุกเฉิน ดูแลนักเรียนรอบด้าน" },
  ];
  const features: { icon: string; title: string; desc: string }[] = getJson("homepage_features", defaultFeatures);

  const updateFeature = (i: number, field: string, val: string) => {
    const arr = [...features];
    arr[i] = { ...arr[i], [field]: val };
    setJson("homepage_features", arr);
  };
  const addFeature = () => setJson("homepage_features", [...features, { icon: "Star", title: "", desc: "" }]);
  const removeFeature = (i: number) => setJson("homepage_features", features.filter((_, idx) => idx !== i));

  const iconOptions = ["BookOpen", "Users", "Shield", "Clock", "Award", "Heart", "Star", "Zap", "Target", "Lightbulb", "Globe", "Rocket", "CheckCircle", "FileText", "Layers", "Monitor"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">แก้ไขหน้าแรกทั้งหน้า</h3>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
        </Button>
      </div>

      <SectionOrderEditor
        currentOrder={(() => {
          try {
            const saved = JSON.parse(get("homepage_sections_order", "[]"));
            if (Array.isArray(saved) && saved.length > 0) {
              const valid = saved.filter((k: string) => DEFAULT_ORDER.includes(k));
              const missing = DEFAULT_ORDER.filter(k => !valid.includes(k));
              return [...valid, ...missing];
            }
          } catch {}
          return DEFAULT_ORDER;
        })()}
        onChange={(o) => setJson("homepage_sections_order", o)}
      />

      {/* HEADER */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PanelTop className="w-4 h-4 text-primary" /> เฮดเดอร์ (Header)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ชื่อโรงเรียน</Label>
              <Input value={get("school_name")} onChange={e => set("school_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ข้อความปุ่มเข้าสู่ระบบ</Label>
              <Input value={get("header_login_text", "เข้าสู่ระบบ")} onChange={e => set("header_login_text", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>โลโก้โรงเรียน</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {get("school_logo") ? (
                  <img loading="lazy" decoding="async" src={get("school_logo")} alt="Logo" className="w-full h-full object-contain" />
                ) : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <Button size="sm" variant="outline" onClick={() => uploadImage("logo", url => set("school_logo", url))}>
                <Upload className="w-4 h-4 mr-1" /> อัปโหลดโลโก้
              </Button>
              {get("school_logo") && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => set("school_logo", "")}>ลบ</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HERO / BANNER */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> แบนเนอร์ (Hero Banner)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_hero", "true") === "true"}
              onCheckedChange={v => set("show_hero", v ? "true" : "false")}
            />
            <Label>แสดงแบนเนอร์</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>หัวข้อหลัก (Hero Title)</Label>
              <Input value={get("hero_title")} onChange={e => set("hero_title", e.target.value)} placeholder="Smart School System" />
            </div>
            <div className="space-y-1.5">
              <Label>คำบรรยาย (Subtitle)</Label>
              <Input value={get("hero_subtitle")} onChange={e => set("hero_subtitle", e.target.value)} placeholder="ระบบบริหารจัดการโรงเรียนอัจฉริยะ" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ข้อความปุ่มหลัก</Label>
              <Input value={get("hero_cta_primary", "เข้าสู่ระบบ")} onChange={e => set("hero_cta_primary", e.target.value)} placeholder="เว้นว่างถ้าใช้ icon/รูปภาพอย่างเดียว" />
            </div>
            <div className="space-y-1.5">
              <Label>ข้อความปุ่มรอง</Label>
              <Input value={get("hero_cta_secondary", "เกี่ยวกับเรา")} onChange={e => set("hero_cta_secondary", e.target.value)} placeholder="เว้นว่างถ้าใช้ icon/รูปภาพอย่างเดียว" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ลิงก์ปุ่มหลัก</Label>
              <Input value={get("hero_cta_primary_url", "/login")} onChange={e => set("hero_cta_primary_url", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ลิงก์ปุ่มรอง</Label>
              <Input value={get("hero_cta_secondary_url", "/page/about")} onChange={e => set("hero_cta_secondary_url", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Icon ปุ่มหลัก (Lucide)</Label>
              <Input value={get("hero_cta_primary_icon")} onChange={e => set("hero_cta_primary_icon", e.target.value)} placeholder="เช่น log-in, arrow-right" />
            </div>
            <div className="space-y-1.5">
              <Label>Icon ปุ่มรอง (Lucide)</Label>
              <Input value={get("hero_cta_secondary_icon")} onChange={e => set("hero_cta_secondary_icon", e.target.value)} placeholder="เช่น info, book-open" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>รูปภาพปุ่มหลัก (URL)</Label>
              <Input value={get("hero_cta_primary_image")} onChange={e => set("hero_cta_primary_image", e.target.value)} placeholder="https://... (ถ้าใส่จะแทนข้อความ)" />
            </div>
            <div className="space-y-1.5">
              <Label>รูปภาพปุ่มรอง (URL)</Label>
              <Input value={get("hero_cta_secondary_image")} onChange={e => set("hero_cta_secondary_image", e.target.value)} placeholder="https://... (ถ้าใส่จะแทนข้อความ)" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ลำดับการแสดงผล: ถ้าใส่รูปภาพ → ใช้รูปภาพอย่างเดียว, ถ้าใส่ icon → แสดง icon คู่กับข้อความ (ถ้ามี), ถ้าไม่มีทั้งสอง → แสดงข้อความปกติ
          </p>

          {/* Background Color */}
          <div className="space-y-1.5">
            <Label>สีพื้นหลังแบนเนอร์</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={get("hero_bg_color", "#3B82F6")}
                onChange={e => set("hero_bg_color", e.target.value)}
                className="w-12 h-10 rounded border border-border cursor-pointer"
              />
              <Input
                value={get("hero_bg_color", "#3B82F6")}
                onChange={e => set("hero_bg_color", e.target.value)}
                placeholder="#3B82F6"
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">ใช้เมื่อไม่มีภาพพื้นหลัง</span>
              {get("hero_bg_color") && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => set("hero_bg_color", "")}>
                  รีเซ็ต
                </Button>
              )}
            </div>
          </div>

          {/* Background Image */}
          <div className="space-y-1.5">
            <Label>ภาพพื้นหลังแบนเนอร์</Label>
            <div className="flex items-center gap-4">
              <div className="w-40 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {get("hero_background") ? (
                  <img loading="lazy" decoding="async" src={get("hero_background")} alt="BG" className="w-full h-full object-cover" />
                ) : <span className="text-xs text-muted-foreground">ใช้สีพื้นหลัง</span>}
              </div>
              <div className="space-y-2">
                <Button size="sm" variant="outline" onClick={() => uploadImage("hero_bg", url => set("hero_background", url))}>
                  <Upload className="w-4 h-4 mr-1" /> อัปโหลดภาพ
                </Button>
                {get("hero_background") && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => set("hero_background", "")}>ลบภาพ</Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={get("hero_show_logo", "true") === "true"}
              onCheckedChange={v => set("hero_show_logo", v ? "true" : "false")}
            />
            <Label>แสดงไอคอน/โลโก้ในแบนเนอร์</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={get("hero_show_buttons", "true") === "true"}
              onCheckedChange={v => set("hero_show_buttons", v ? "true" : "false")}
            />
            <Label>แสดงปุ่ม CTA</Label>
          </div>

          {/* Layout controls */}
          <div className="pt-3 border-t space-y-3">
            <Label className="text-sm font-semibold">ตำแหน่งและขนาด</Label>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">ความสูงแบนเนอร์</Label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { v: "sm", l: "เตี้ย" },
                    { v: "md", l: "กลาง" },
                    { v: "lg", l: "สูง" },
                    { v: "xl", l: "เต็มจอ" },
                  ].map(o => (
                    <button
                      key={o.v}
                      onClick={() => set("hero_height", o.v)}
                      className={`px-2 py-1.5 text-xs rounded-md border ${
                        get("hero_height", "md") === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ความมืดของภาพ ({get("hero_overlay", "40")}%)</Label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={get("hero_overlay", "40")}
                  onChange={e => set("hero_overlay", e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">การจัดข้อความ (แนวนอน)</Label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { v: "left", l: "ซ้าย" },
                    { v: "center", l: "กลาง" },
                    { v: "right", l: "ขวา" },
                  ].map(o => (
                    <button
                      key={o.v}
                      onClick={() => set("hero_text_align", o.v)}
                      className={`px-2 py-1.5 text-xs rounded-md border ${
                        get("hero_text_align", "center") === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">การจัดข้อความ (แนวตั้ง)</Label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { v: "top", l: "บน" },
                    { v: "middle", l: "กลาง" },
                    { v: "bottom", l: "ล่าง" },
                  ].map(o => (
                    <button
                      key={o.v}
                      onClick={() => set("hero_text_vertical", o.v)}
                      className={`px-2 py-1.5 text-xs rounded-md border ${
                        get("hero_text_vertical", "middle") === o.v
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">ตำแหน่งไอคอน/โลโก้</Label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { v: "above", l: "บนข้อความ" },
                  { v: "below", l: "ใต้ข้อความ" },
                  { v: "left", l: "ซ้ายข้อความ" },
                  { v: "right", l: "ขวาข้อความ" },
                ].map(o => (
                  <button
                    key={o.v}
                    onClick={() => set("hero_icon_position", o.v)}
                    className={`px-2 py-1.5 text-xs rounded-md border ${
                      get("hero_icon_position", "above") === o.v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">สีตัวอักษร</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={get("hero_text_color", "#ffffff")}
                  onChange={e => set("hero_text_color", e.target.value)}
                  className="w-12 h-10 rounded border border-border cursor-pointer"
                />
                <Input
                  value={get("hero_text_color", "#ffffff")}
                  onChange={e => set("hero_text_color", e.target.value)}
                  placeholder="#ffffff"
                  className="w-32"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* STATS */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" /> ตัวเลขสถิติ (Stats Bar)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_stats", "true") === "true"}
              onCheckedChange={v => set("show_stats", v ? "true" : "false")}
            />
            <Label>แสดงแถบสถิติ</Label>
          </div>
          {stats.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input className="w-24" placeholder="ค่า" value={s.value} onChange={e => updateStat(i, "value", e.target.value)} />
              <Input className="flex-1" placeholder="คำอธิบาย" value={s.label} onChange={e => updateStat(i, "label", e.target.value)} />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeStat(i)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addStat}><Plus className="w-4 h-4 mr-1" /> เพิ่มสถิติ</Button>
        </CardContent>
      </Card>

      {/* BANNER CAROUSEL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> ภาพประชาสัมพันธ์ (Banner Carousel)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_banner_carousel", "true") === "true"}
              onCheckedChange={v => set("show_banner_carousel", v ? "true" : "false")}
            />
            <Label>แสดงภาพประชาสัมพันธ์</Label>
          </div>
          <div className="space-y-1.5">
            <Label>ระยะเวลาแสดงแต่ละภาพ (วินาที)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              className="w-32"
              value={get("banner_carousel_interval", "5")}
              onChange={e => set("banner_carousel_interval", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => {
              const key = `banner_carousel_${i}`;
              const captionKey = `banner_carousel_caption_${i}`;
              const linkKey = `banner_carousel_link_${i}`;
              const linkTargetKey = `banner_carousel_link_target_${i}`;
              return (
                <div key={i} className="space-y-2">
                  <Label>ภาพที่ {i + 1}</Label>
                  <div className="w-full h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                    {get(key) ? (
                      <img loading="lazy" decoding="async" src={get(key)} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                    ) : <ImageIcon className="w-8 h-8 text-muted-foreground" />}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => uploadImage(`banner_${i}`, url => set(key, url))}>
                      <Upload className="w-3 h-3 mr-1" /> อัปโหลด
                    </Button>
                    {get(key) && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => set(key, "")}>ลบ</Button>
                    )}
                  </div>
                  <Input
                    placeholder="คำอธิบายภาพ (ไม่บังคับ)"
                    value={get(captionKey)}
                    onChange={e => set(captionKey, e.target.value)}
                  />
                  <Input
                    placeholder="ลิงก์เมื่อคลิก (เช่น /page/about หรือ https://...)"
                    value={get(linkKey)}
                    onChange={e => set(linkKey, e.target.value)}
                  />
                  {get(linkKey) && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={get(linkTargetKey, "_self") === "_blank"}
                        onCheckedChange={v => set(linkTargetKey, v ? "_blank" : "_self")}
                      />
                      <Label className="text-xs text-muted-foreground">เปิดในแท็บใหม่</Label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* HOMEPAGE CONTENT (Rich Text between stats and features) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" /> เนื้อหาหน้าแรก (Content Section)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_homepage_content", "true") === "true"}
              onCheckedChange={v => set("show_homepage_content", v ? "true" : "false")}
            />
            <Label>แสดงเนื้อหา</Label>
          </div>
          <RichTextEditor
            content={get("homepage_content")}
            onChange={html => set("homepage_content", html)}
          />
          <p className="text-xs text-muted-foreground">ใส่ข้อความ รูปภาพ วิดีโอ ได้ตามต้องการ จะแสดงระหว่างแถบสถิติกับส่วน Features</p>
        </CardContent>
      </Card>

      {/* FEATURES */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" /> จุดเด่น / บริการ (Features)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_features", "true") === "true"}
              onCheckedChange={v => set("show_features", v ? "true" : "false")}
            />
            <Label>แสดงส่วน Features</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>หัวข้อ</Label>
              <Input value={get("features_title", "ระบบครบจบในที่เดียว")} onChange={e => set("features_title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย</Label>
              <Input value={get("features_subtitle", "บริหารจัดการโรงเรียนทุกมิติ")} onChange={e => set("features_subtitle", e.target.value)} />
            </div>
          </div>
          {features.map((f, i) => (
            <div key={i} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  className="border border-border rounded-md px-2 py-1 text-sm bg-background"
                  value={f.icon}
                  onChange={e => updateFeature(i, "icon", e.target.value)}
                >
                  {iconOptions.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                </select>
                <Input className="flex-1" placeholder="ชื่อ Feature" value={f.title} onChange={e => updateFeature(i, "title", e.target.value)} />
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => removeFeature(i)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
              <Textarea className="min-h-[60px]" placeholder="คำอธิบาย" value={f.desc} onChange={e => updateFeature(i, "desc", e.target.value)} />
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addFeature}><Plus className="w-4 h-4 mr-1" /> เพิ่ม Feature</Button>
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> ส่วนเรียกร้องการกระทำ (CTA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_cta", "true") === "true"}
              onCheckedChange={v => set("show_cta", v ? "true" : "false")}
            />
            <Label>แสดงส่วน CTA</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>หัวข้อ CTA</Label>
              <Input value={get("cta_title", "พร้อมเริ่มต้นใช้งานแล้วหรือยัง?")} onChange={e => set("cta_title", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>คำอธิบาย CTA</Label>
              <Input value={get("cta_subtitle", "เข้าสู่ระบบเพื่อเริ่มบริหารจัดการโรงเรียนของคุณได้ทันที")} onChange={e => set("cta_subtitle", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ข้อความปุ่ม</Label>
              <Input value={get("cta_button_text", "เข้าสู่ระบบเลย")} onChange={e => set("cta_button_text", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>ลิงก์ปุ่ม</Label>
              <Input value={get("cta_button_url", "/login")} onChange={e => set("cta_button_url", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CUSTOM EMBED CODE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Code2 className="w-4 h-4 text-primary" /> โค้ดฝังเพิ่มเติม (Custom Embed Code)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_custom_embed", "false") === "true"}
              onCheckedChange={v => set("show_custom_embed", v ? "true" : "false")}
            />
            <Label>แสดงส่วนโค้ดฝัง</Label>
          </div>
          <div className="space-y-1.5">
            <Label>โค้ด HTML / JavaScript / iframe (แสดงก่อน Footer)</Label>
            <FullHtmlEditor
              content={get("custom_embed_code")}
              onChange={html => set("custom_embed_code", html)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ใส่โค้ด HTML, CSS, JavaScript, iframe, Google Maps, Facebook Plugin, widget ต่างๆ ได้ตามต้องการ
          </p>
        </CardContent>
      </Card>

      {/* FOOTER */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PanelBottom className="w-4 h-4 text-primary" /> ฟุตเตอร์ (Footer)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Switch
              checked={get("show_footer", "true") === "true"}
              onCheckedChange={v => set("show_footer", v ? "true" : "false")}
            />
            <Label>แสดงฟุตเตอร์</Label>
          </div>
          <div className="space-y-1.5">
            <Label>โลโก้ฟุตเตอร์ (ถ้าไม่ระบุจะใช้โลโก้หลัก)</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/30 overflow-hidden">
                {get("footer_logo") ? (
                  <img loading="lazy" decoding="async" src={get("footer_logo")} alt="Footer Logo" className="w-full h-full object-contain" />
                ) : get("school_logo") ? (
                  <img loading="lazy" decoding="async" src={get("school_logo")} alt="Logo" className="w-full h-full object-contain opacity-50" />
                ) : <ImageIcon className="w-6 h-6 text-muted-foreground" />}
              </div>
              <div className="space-y-2">
                <Button size="sm" variant="outline" onClick={() => uploadImage("footer_logo", url => set("footer_logo", url))}>
                  <Upload className="w-4 h-4 mr-1" /> อัปโหลดโลโก้ฟุตเตอร์
                </Button>
                {get("footer_logo") && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => set("footer_logo", "")}>ลบ</Button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ชื่อโรงเรียนในฟุตเตอร์ (ถ้าไม่ระบุจะใช้ชื่อจากเฮดเดอร์)</Label>
            <Input value={get("footer_school_name")} onChange={e => set("footer_school_name", e.target.value)} placeholder="ใช้ชื่อจากเฮดเดอร์" />
          </div>
          <div className="space-y-1.5">
            <Label>คำอธิบายโรงเรียน (ใต้โลโก้ในฟุตเตอร์)</Label>
            <Textarea
              value={get("footer_description")}
              onChange={e => set("footer_description", e.target.value)}
              placeholder="จะใช้คำบรรยายจาก Hero Subtitle หากไม่ระบุ"
              className="min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>ที่อยู่โรงเรียน</Label>
              <Textarea value={get("school_address")} onChange={e => set("school_address", e.target.value)} className="min-h-[60px]" />
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>เบอร์โทร</Label>
                <Input value={get("school_phone")} onChange={e => set("school_phone", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>อีเมล</Label>
                <Input value={get("school_email")} onChange={e => set("school_email", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ข้อความลิขสิทธิ์ (Copyright)</Label>
            <Input value={get("footer_copyright")} onChange={e => set("footer_copyright", e.target.value)} placeholder="ถ้าไม่ระบุจะใช้ค่าเริ่มต้น" />
          </div>
          <div className="space-y-1.5">
            <Label>ลิงก์โซเชียลมีเดีย (Facebook)</Label>
            <Input value={get("social_facebook")} onChange={e => set("social_facebook", e.target.value)} placeholder="https://facebook.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label>ลิงก์ LINE</Label>
            <Input value={get("social_line")} onChange={e => set("social_line", e.target.value)} placeholder="https://line.me/..." />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-6">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "💾 บันทึกหน้าแรกทั้งหมด"}
        </Button>
      </div>
    </div>
  );
};

export default HomepageEditor;
