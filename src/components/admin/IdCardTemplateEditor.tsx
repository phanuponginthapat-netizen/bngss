import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  IdCard, Palette, Image, Upload, Save, Eye,
  GraduationCap, User, Phone, Calendar, Droplets, QrCode, MapPin, Printer
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { IdCardFront, IdCardBack } from "@/components/IdCardRenderer";
import type { IdCardSettings } from "@/hooks/useIdCardSettings";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";

interface CardSettings {
  school_name: string;
  school_name_en: string;
  school_address: string;
  school_phone: string;
  header_color_from: string;
  header_color_to: string;
  text_color: string;
  logo_url: string;
  logo_url_2: string;
  logo_url_3: string;
  bg_image_url: string;
  body_bg_image_url: string;
  accent_color: string;
  card_subtitle: string;
  show_qr: string;
  qr_type: string;
  show_blood_type: string;
  show_dob: string;
  show_emergency_contact: string;
  show_line_qr: string;
  card_border_radius: string;
  back_note: string;
}

const DEFAULT_SETTINGS: CardSettings = {
  school_name: "โรงเรียนสมาร์ทสคูล",
  school_name_en: "Smart School",
  school_address: "",
  school_phone: "",
  header_color_from: "#1e40af",
  header_color_to: "#3b82f6",
  text_color: "#ffffff",
  logo_url: "",
  logo_url_2: "",
  logo_url_3: "",
  bg_image_url: "",
  body_bg_image_url: "",
  accent_color: "#1e40af",
  card_subtitle: "บัตรประจำตัวนักเรียน",
  show_qr: "true",
  qr_type: "sdq",
  show_blood_type: "true",
  show_dob: "true",
  show_emergency_contact: "true",
  show_line_qr: "true",
  card_border_radius: "12",
  back_note: "บัตรนี้เป็นสมบัติของโรงเรียน หากพบกรุณาส่งคืน",
};

const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof CardSettings)[];

const IdCardTemplateEditor = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<CardSettings>({ ...DEFAULT_SETTINGS });
  const [saving, setSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logo2InputRef = useRef<HTMLInputElement>(null);
  const logo3InputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const bodyBgInputRef = useRef<HTMLInputElement>(null);

  const { data: stored } = useQuery({
    queryKey: ["id_card_settings_editor_rows"],
    queryFn: async () => {
      const keys = SETTINGS_KEYS.map(k => `id_card_${k}`);
      const { data, error } = await supabase.from("cms_settings").select("key, value").in("key", keys);
      if (error) {
        console.error("Failed to load id_card settings:", error);
        return [];
      }
      return data || [];
    },
  });

  useEffect(() => {
    if (!stored || !Array.isArray(stored) || stored.length === 0) return;
    const next = { ...DEFAULT_SETTINGS };
    stored.forEach((s: any) => {
      if (!s?.key) return;
      const field = s.key.replace("id_card_", "") as keyof CardSettings;
      if (field in next && s.value != null) (next as any)[field] = s.value;
    });
    setSettings(next);
  }, [stored]);

  const handleSave = async () => {
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      for (const key of SETTINGS_KEYS) {
        const dbKey = `id_card_${key}`;
        const value = settings[key] || "";
        const { data: existing } = await supabase.from("cms_settings").select("id").eq("key", dbKey).maybeSingle();
        if (existing) {
          await supabase.from("cms_settings").update({ value } as any).eq("key", dbKey);
        } else {
          await supabase.from("cms_settings").insert({ key: dbKey, value } as any);
        }
      }
      qc.invalidateQueries({ queryKey: ["id_card_settings"] });
      qc.invalidateQueries({ queryKey: ["id_card_settings_editor_rows"] });
      toast.success("บันทึกต้นแบบบัตรสำเร็จ");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาด");
    }
    toast.dismiss(__tid_save_1);
      setSaving(false);
  };

  const uploadImage = async (file: File, type: "logo" | "logo2" | "logo3" | "bg" | "bodybg") => {
    const { compressImage } = await import("@/lib/imageCompress");
    const isLogo = type !== "bg" && type !== "bodybg";
    const compressed = await compressImage(file, { maxWidth: 1024, maxSizeKB: 100, mimeType: isLogo ? "image/png" : "image/jpeg" });
    const fileName = `id-card/${type}_${Date.now()}_${compressed.name}`;
    const result = await uploadPublicFileWithFallback("cms-images", fileName, compressed, { upsert: true });
    const fieldMap: Record<string, keyof CardSettings> = {
      logo: "logo_url",
      logo2: "logo_url_2",
      logo3: "logo_url_3",
      bg: "bg_image_url",
      bodybg: "body_bg_image_url",
    };
    update(fieldMap[type], result.publicUrl);
    toast.success(result.usedFallback ? "เพิ่มรูปสำเร็จ (โหมดสำรอง)" : "อัปโหลดสำเร็จ");
  };

  const update = (field: keyof CardSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const radius = `${settings.card_border_radius || 12}px`;
  const baseUrl = window.location.origin;

  // Convert string-based settings to the shared IdCardSettings type for preview
  const previewCs: IdCardSettings = {
    ...settings,
    show_qr: settings.show_qr === "true",
    show_blood_type: settings.show_blood_type === "true",
    show_dob: settings.show_dob === "true",
    show_emergency_contact: settings.show_emergency_contact === "true",
    show_line_qr: settings.show_line_qr === "true",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <IdCard className="w-5 h-5 text-primary" />
            {lang === "th" ? "ตั้งค่าต้นแบบบัตรประจำตัว" : "ID Card Template Settings"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {lang === "th" ? "กำหนดธีม โลโก้ QR Code และรูปแบบบัตร" : "Configure theme, logo, QR code and card layout"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard/admin/print-center")}>
            <Printer className="w-4 h-4 mr-2" />
            {lang === "th" ? "พิมพ์บัตร & QR" : "Print Cards & QR"}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings */}
        <div className="space-y-4">
          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">ข้อมูล</TabsTrigger>
              <TabsTrigger value="theme" className="flex-1">ธีมสี</TabsTrigger>
              <TabsTrigger value="images" className="flex-1">รูปภาพ</TabsTrigger>
              <TabsTrigger value="options" className="flex-1">ตัวเลือก</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label className="text-xs">ชื่อโรงเรียน (ภาษาไทย)</Label>
                    <Input value={settings.school_name} onChange={e => update("school_name", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ชื่อโรงเรียน (ภาษาอังกฤษ)</Label>
                    <Input value={settings.school_name_en} onChange={e => update("school_name_en", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">คำบรรยายบนบัตร</Label>
                    <Input value={settings.card_subtitle} onChange={e => update("card_subtitle", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">ที่อยู่โรงเรียน (ด้านหลังบัตร)</Label>
                    <Input value={settings.school_address} onChange={e => update("school_address", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">เบอร์โทรโรงเรียน</Label>
                    <Input value={settings.school_phone} onChange={e => update("school_phone", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">หมายเหตุด้านหลังบัตร</Label>
                    <Input value={settings.back_note} onChange={e => update("back_note", e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="theme" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">สีหัวบัตร (จาก)</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={settings.header_color_from} onChange={e => update("header_color_from", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                        <Input value={settings.header_color_from} onChange={e => update("header_color_from", e.target.value)} className="font-mono text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">สีหัวบัตร (ถึง)</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={settings.header_color_to} onChange={e => update("header_color_to", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                        <Input value={settings.header_color_to} onChange={e => update("header_color_to", e.target.value)} className="font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">สีตัวอักษรบนหัวบัตร</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={settings.text_color} onChange={e => update("text_color", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                        <Input value={settings.text_color} onChange={e => update("text_color", e.target.value)} className="font-mono text-xs" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">สีเน้น (Accent)</Label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={settings.accent_color} onChange={e => update("accent_color", e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                        <Input value={settings.accent_color} onChange={e => update("accent_color", e.target.value)} className="font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">ความโค้งมุมบัตร (px)</Label>
                    <Input type="number" min="0" max="24" value={settings.card_border_radius} onChange={e => update("card_border_radius", e.target.value)} className="w-24" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="images" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label className="text-xs mb-2 block">โลโก้โรงเรียน</Label>
                    <div className="flex items-center gap-3">
                      {settings.logo_url ? (
                        <img src={settings.logo_url} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-border bg-white p-1" />
                      ) : (
                        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                          <GraduationCap className="w-6 h-6" />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Button size="sm" variant="outline" onClick={() => logoInputRef.current?.click()}>
                          <Upload className="w-3 h-3 mr-1" /> อัปโหลดโลโก้
                        </Button>
                        {settings.logo_url && (
                          <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => update("logo_url", "")}>ลบ</Button>
                        )}
                      </div>
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "logo"); }} />
                    </div>
                  </div>
                  {(["logo_url_2", "logo_url_3"] as const).map((field, idx) => {
                    const ref = idx === 0 ? logo2InputRef : logo3InputRef;
                    const kind = idx === 0 ? "logo2" : "logo3";
                    const url = settings[field];
                    return (
                      <div key={field}>
                        <Label className="text-xs mb-2 block">โลโก้เพิ่มเติม #{idx + 2} (มุมบนขวา)</Label>
                        <div className="flex items-center gap-3">
                          {url ? (
                            <img src={url} alt={`Logo ${idx + 2}`} className="w-16 h-16 object-contain rounded-lg border border-border bg-white p-1" />
                          ) : (
                            <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                              <Image className="w-6 h-6" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <Button size="sm" variant="outline" onClick={() => ref.current?.click()}>
                              <Upload className="w-3 h-3 mr-1" /> อัปโหลด
                            </Button>
                            {url && (
                              <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => update(field, "")}>ลบ</Button>
                            )}
                          </div>
                          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, kind as any); }} />
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <Label className="text-xs mb-2 block">ภาพพื้นหลังบัตร (ลายน้ำ)</Label>
                    <div className="flex items-center gap-3">
                      {settings.bg_image_url ? (
                        <img src={settings.bg_image_url} alt="BG" className="w-24 h-16 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="w-24 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">ไม่มี</div>
                      )}
                      <div className="space-y-1">
                        <Button size="sm" variant="outline" onClick={() => bgInputRef.current?.click()}>
                          <Upload className="w-3 h-3 mr-1" /> อัปโหลดพื้นหลัง
                        </Button>
                        {settings.bg_image_url && (
                          <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => update("bg_image_url", "")}>ลบ</Button>
                        )}
                      </div>
                      <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "bg"); }} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-2 block">พื้นหลังส่วนล่างของบัตร (ใต้แถบหัว)</Label>
                    <p className="text-[11px] text-muted-foreground mb-2">ใส่ภาพพื้นหลังให้ส่วนล่าง (รูป + ข้อมูล + QR) โดยไม่ทับโลโก้ด้านบน</p>
                    <div className="flex items-center gap-3">
                      {settings.body_bg_image_url ? (
                        <img src={settings.body_bg_image_url} alt="Body BG" className="w-24 h-16 object-cover rounded-lg border border-border" />
                      ) : (
                        <div className="w-24 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-xs">ไม่มี</div>
                      )}
                      <div className="space-y-1">
                        <Button size="sm" variant="outline" onClick={() => bodyBgInputRef.current?.click()}>
                          <Upload className="w-3 h-3 mr-1" /> อัปโหลดพื้นหลังส่วนล่าง
                        </Button>
                        {settings.body_bg_image_url && (
                          <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => update("body_bg_image_url", "")}>ลบ</Button>
                        )}
                      </div>
                      <input ref={bodyBgInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, "bodybg"); }} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">แสดง QR Code</Label>
                    <Switch checked={settings.show_qr === "true"} onCheckedChange={v => update("show_qr", v ? "true" : "false")} />
                  </div>
                  {settings.show_qr === "true" && (
                    <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-xs text-blue-900 dark:text-blue-200 space-y-1">
                      <p className="font-semibold">QR เก็บ "รหัสประจำตัว" เพื่อใช้ทั่วทุกโมดูล</p>
                      <ul className="list-disc list-inside space-y-0.5 opacity-90">
                        <li>เคาน์เตอร์ขยะ — สแกนเพื่อบันทึกแต้ม</li>
                        <li>เช็คชื่อ / พฤติกรรม — สแกนเพื่อระบุนักเรียน</li>
                        <li>LINE ยืนยันตัวตน — รหัส + วันเดือนปีเกิด</li>
                      </ul>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">แสดงวันเกิด</Label>
                    <Switch checked={settings.show_dob === "true"} onCheckedChange={v => update("show_dob", v ? "true" : "false")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">แสดงหมู่เลือด</Label>
                    <Switch checked={settings.show_blood_type === "true"} onCheckedChange={v => update("show_blood_type", v ? "true" : "false")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">แสดงผู้ติดต่อฉุกเฉิน</Label>
                    <Switch checked={settings.show_emergency_contact === "true"} onCheckedChange={v => update("show_emergency_contact", v ? "true" : "false")} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">แสดง QR เพิ่มเพื่อน LINE (หลังบัตร)</Label>
                      <p className="text-[11px] text-muted-foreground">สแกนเพื่อเพิ่ม LINE OA และผูกบัญชีอัตโนมัติ</p>
                    </div>
                    <Switch checked={settings.show_line_qr === "true"} onCheckedChange={v => update("show_line_qr", v ? "true" : "false")} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Eye className="w-4 h-4" /> ตัวอย่างบัตร (Preview)
          </h3>

          <IdCardFront
            cs={previewCs}
            width={240}
            person={{
              name: "ด.ช.สมชาย ใจดี",
              code: "65001",
              className: "ม.3/1",
              dateOfBirth: "15 พ.ค. 2551",
              bloodType: "A",
              qrValue: "0000-PREVIEW",
            }}
            className="mx-auto"
          />
          <p className="text-center text-xs text-muted-foreground">ด้านหน้า (5.4 × 8.6 ซม. · ISO ID-1)</p>

          <IdCardBack
            cs={previewCs}
            width={240}
            person={{
              name: "ด.ช.สมชาย ใจดี",
              code: "65001",
              emergencyContact: "081-234-5678",
              phone: "091-234-5678",
            }}
            className="mx-auto"
          />
          <p className="text-center text-xs text-muted-foreground">ด้านหลัง</p>
        </div>
      </div>
    </div>
  );
};

export default IdCardTemplateEditor;
