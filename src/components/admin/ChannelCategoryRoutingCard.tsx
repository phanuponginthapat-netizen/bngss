import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, MessageSquare, Route } from "lucide-react";
import { toast } from "sonner";

type Channel = "gchat" | "line";
type Category =
  | "critical" | "score" | "health" | "ict" | "attendance"
  | "behavior" | "homework" | "eform" | "leave" | "news" | "other";

const CATEGORIES: { key: Category; label: string; hint?: string }[] = [
  { key: "critical", label: "เหตุฉุกเฉิน / Critical", hint: "ประกาศฉุกเฉิน, severity=critical" },
  { key: "score", label: "คะแนน / เกรด", hint: "grade, score, assessment" },
  { key: "health", label: "สุขภาพ", hint: "health, vaccine, measurement" },
  { key: "ict", label: "ICT / พัสดุ", hint: "ict, loan, asset" },
  { key: "attendance", label: "การเช็คชื่อ / สแกนหน้า" },
  { key: "behavior", label: "พฤติกรรม" },
  { key: "homework", label: "การบ้าน" },
  { key: "eform", label: "E-Form / เอกสาร" },
  { key: "leave", label: "ใบลา" },
  { key: "news", label: "ข่าวประกาศ" },
  { key: "other", label: "อื่นๆ" },
];

type Routing = Record<Channel, Record<Category, boolean>>;

const DEFAULT_ROUTING: Routing = {
  gchat: Object.fromEntries(CATEGORIES.map((c) => [c.key, true])) as Record<Category, boolean>,
  line:  Object.fromEntries(CATEGORIES.map((c) => [c.key, true])) as Record<Category, boolean>,
};

export default function ChannelCategoryRoutingCard() {
  const [routing, setRouting] = useState<Routing>(DEFAULT_ROUTING);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "channel_category_routing")
        .maybeSingle();
      const v = data?.setting_value as any;
      if (v && typeof v === "object") {
        setRouting({
          gchat: { ...DEFAULT_ROUTING.gchat, ...(v.gchat || {}) },
          line:  { ...DEFAULT_ROUTING.line,  ...(v.line  || {}) },
        });
      }
      setLoading(false);
    })();
  }, []);

  const toggle = (ch: Channel, cat: Category, v: boolean) => {
    setRouting((r) => ({ ...r, [ch]: { ...r[ch], [cat]: v } }));
  };

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("school_settings")
      .upsert(
        { setting_key: "channel_category_routing", setting_value: routing as any },
        { onConflict: "setting_key" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("บันทึกการจัดเส้นทางแจ้งเตือนแล้ว");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Route className="w-5 h-5 text-primary" /> ควบคุมการแจ้งเตือน Google Chat / LINE OA ต่อหมวด
        </CardTitle>
        <CardDescription>
          ปิดหมวดใดใน Google Chat หรือ LINE OA ระบบจะข้ามการส่งช่องนั้นทั้งหมดสำหรับหมวดนั้น (การแจ้งเตือนในระบบและ Push บนมือถือไม่ได้รับผลกระทบ)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />กำลังโหลด...</div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_90px_90px] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
              <div>หมวด</div>
              <div className="flex items-center gap-1 justify-center"><MessageSquare className="w-3.5 h-3.5" /> G.Chat</div>
              <div className="flex items-center gap-1 justify-center"><MessageCircle className="w-3.5 h-3.5" /> LINE</div>
            </div>
            {CATEGORIES.map((c) => (
              <div key={c.key} className="grid grid-cols-[1fr_90px_90px] gap-3 px-3 py-2 items-center rounded-lg hover:bg-muted/40">
                <div>
                  <div className="text-sm font-medium">{c.label}</div>
                  {c.hint && <div className="text-[11px] text-muted-foreground">{c.hint}</div>}
                </div>
                <div className="flex justify-center">
                  <Switch checked={routing.gchat[c.key] !== false} onCheckedChange={(v) => toggle("gchat", c.key, v)} />
                </div>
                <div className="flex justify-center">
                  <Switch checked={routing.line[c.key] !== false} onCheckedChange={(v) => toggle("line", c.key, v)} />
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-3">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                บันทึก
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
