import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2, Save, Shield, LogIn } from "lucide-react";
import { toast } from "sonner";

type TimeRule = {
  name: string;
  domains: string;      // stored as comma/newline list — normalized to array on save
  days: number[];       // 0=Sun ... 6=Sat
  start: string;        // "HH:MM"
  end: string;          // "HH:MM"
};

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const PRESETS: { label: string; rule: Partial<TimeRule> }[] = [
  {
    label: "โซเชียลช่วงเรียน (จ-ศ 08:00-15:30)",
    rule: {
      name: "โซเชียลช่วงเรียน",
      domains: "facebook.com, tiktok.com, instagram.com, x.com, twitter.com, threads.net, snapchat.com",
      days: [1, 2, 3, 4, 5],
      start: "08:00",
      end: "15:30",
    },
  },
  {
    label: "เกม/สตรีมช่วงเรียน (จ-ศ 08:00-15:30)",
    rule: {
      name: "เกม/สตรีมช่วงเรียน",
      domains: "twitch.tv, roblox.com, epicgames.com, steampowered.com, garena.co.th, netflix.com, disneyplus.com",
      days: [1, 2, 3, 4, 5],
      start: "08:00",
      end: "15:30",
    },
  },
];

const emptyRule = (): TimeRule => ({
  name: "",
  domains: "",
  days: [1, 2, 3, 4, 5],
  start: "08:00",
  end: "15:30",
});

export default function BrowserPolicyPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<TimeRule[]>([]);
  const [loginUrl, setLoginUrl] = useState("");
  const [blocklist, setBlocklist] = useState("");
  const [blockMsg, setBlockMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cms_settings")
        .select("key,value")
        .in("key", ["browser_time_rules", "browser_login_url", "browser_blocklist", "browser_block_message"]);
      const m = new Map((data || []).map((r: any) => [r.key, r.value]));
      const raw = m.get("browser_time_rules");
      if (raw) {
        try {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            setRules(
              arr.map((r: any) => ({
                name: String(r.name || ""),
                domains: Array.isArray(r.domains) ? r.domains.join(", ") : String(r.domains || ""),
                days: Array.isArray(r.days) ? r.days.map(Number).filter((n: number) => n >= 0 && n <= 6) : [1, 2, 3, 4, 5],
                start: String(r.start || "08:00"),
                end: String(r.end || "15:30"),
              })),
            );
          }
        } catch { /* ignore */ }
      }
      setLoginUrl(String(m.get("browser_login_url") || ""));
      setBlocklist(String(m.get("browser_blocklist") || ""));
      setBlockMsg(String(m.get("browser_block_message") || ""));
      setLoading(false);
    })();
  }, []);

  const upsert = async (key: string, value: string) => {
    const { error } = await supabase.from("cms_settings").upsert({ key, value } as any, { onConflict: "key" });
    if (error) throw error;
  };

  const save = async () => {
    setSaving(true);
    try {
      const normalized = rules
        .filter((r) => r.name.trim() && r.domains.trim())
        .map((r) => ({
          name: r.name.trim(),
          domains: r.domains
            .split(/[\n,]+/)
            .map((x) => x.trim().toLowerCase())
            .filter(Boolean),
          days: r.days,
          start: r.start,
          end: r.end,
        }));
      await upsert("browser_time_rules", JSON.stringify(normalized));
      await upsert("browser_login_url", loginUrl.trim());
      await upsert("browser_blocklist", blocklist.trim());
      await upsert("browser_block_message", blockMsg.trim());
      toast.success("บันทึกแล้ว · Extension จะรีเฟรช config ภายใน 5 นาที (หรือกด 'รีเฟรช' จาก popup)");
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const addRule = (base?: Partial<TimeRule>) => {
    setRules((r) => [...r, { ...emptyRule(), ...base } as TimeRule]);
  };

  const removeRule = (i: number) => setRules((r) => r.filter((_, idx) => idx !== i));

  const patch = (i: number, p: Partial<TimeRule>) =>
    setRules((r) => r.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  const toggleDay = (i: number, d: number) => {
    const cur = rules[i].days;
    const on = cur.includes(d);
    patch(i, { days: on ? cur.filter((x) => x !== d) : [...cur, d].sort() });
  };

  if (loading) return <div className="p-4 text-sm text-muted-foreground">กำลังโหลด…</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" /> นโยบาย Safe Browser
        </h1>
        <p className="text-sm text-muted-foreground">
          บังคับให้เข้าสู่ระบบก่อนใช้งาน + บล็อกเว็บตามช่วงเวลา (เช่น โซเชียลในเวลาเรียน)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogIn className="w-5 h-5 text-primary" /> Auth Gate — บังคับ login ก่อนใช้งาน</CardTitle>
          <CardDescription>
            Extension จะบล็อกทุกเว็บที่ไม่ใช่โดเมนของโรงเรียน หากยังไม่ login และ redirect ไปหน้าเข้าสู่ระบบพร้อม popup แจ้งเตือน
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>URL หน้าเข้าสู่ระบบ</Label>
            <Input
              placeholder="https://bngss.lovable.app/auth"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              เว้นว่างจะใช้ค่าเริ่มต้น (หน้า /auth ของระบบ)
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> กฎบล็อกตามช่วงเวลา</CardTitle>
              <CardDescription>เพิ่มได้หลายกฎ · เวลาเป็น 24 ชม. · โดเมนคั่นด้วย comma หรือขึ้นบรรทัดใหม่</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button key={p.label} size="sm" variant="outline" onClick={() => addRule(p.rule)}>
                  + {p.label}
                </Button>
              ))}
              <Button size="sm" onClick={() => addRule()} className="gap-1">
                <Plus className="w-4 h-4" /> เพิ่มกฎว่าง
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
              ยังไม่มีกฎ — คลิกปุ่ม preset ด้านบนเพื่อเพิ่มอย่างรวดเร็ว
            </div>
          )}
          {rules.map((r, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary">กฎที่ {i + 1}</Badge>
                <Button size="sm" variant="ghost" onClick={() => removeRule(i)} className="text-destructive gap-1">
                  <Trash2 className="w-4 h-4" /> ลบ
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>ชื่อกฎ</Label>
                  <Input value={r.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="เช่น ห้ามโซเชียลช่วงเรียน" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>เวลาเริ่ม</Label>
                    <Input type="time" value={r.start} onChange={(e) => patch(i, { start: e.target.value })} />
                  </div>
                  <div>
                    <Label>เวลาสิ้นสุด</Label>
                    <Input type="time" value={r.end} onChange={(e) => patch(i, { end: e.target.value })} />
                  </div>
                </div>
              </div>
              <div>
                <Label>วันในสัปดาห์</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DAY_LABELS.map((lbl, d) => {
                    const on = r.days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i, d)}
                        className={`w-10 h-9 rounded-md text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>โดเมนที่บล็อก (คั่นด้วย , หรือขึ้นบรรทัดใหม่)</Label>
                <textarea
                  value={r.domains}
                  onChange={(e) => patch(i, { domains: e.target.value })}
                  placeholder="facebook.com, tiktok.com, instagram.com"
                  className="mt-1 w-full min-h-[80px] rounded-md border bg-background p-2 text-sm font-mono"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>บล็อกลิสต์ทั่วไป (ตลอดเวลา)</CardTitle>
          <CardDescription>โดเมนที่ห้ามเข้าตลอด (ไม่จำกัดช่วงเวลา)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>โดเมน</Label>
            <textarea
              value={blocklist}
              onChange={(e) => setBlocklist(e.target.value)}
              placeholder="pornhub.com, 18+.com, gambling-site.com"
              className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm font-mono"
            />
          </div>
          <div>
            <Label>ข้อความที่แสดงเมื่อถูกบล็อก</Label>
            <Input value={blockMsg} onChange={(e) => setBlockMsg(e.target.value)} placeholder="เว็บไซต์นี้ไม่อนุญาตให้เข้าถึงตามนโยบายของโรงเรียน" />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button size="lg" onClick={save} disabled={saving} className="gap-2 shadow-lg">
          <Save className="w-4 h-4" /> {saving ? "กำลังบันทึก…" : "บันทึกทั้งหมด"}
        </Button>
      </div>
    </div>
  );
}
