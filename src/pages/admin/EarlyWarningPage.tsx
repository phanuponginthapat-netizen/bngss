import { useState } from "react";
import { SimpleCrudPage, statusBadge } from "@/components/generic/SimpleCrudPage";
import { AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function ScanCard() {
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState<{ scanned: number; created: number } | null>(null);

  const runScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("early-warning-scan", {
        body: {},
      });
      if (error) throw error;
      const created = (data as any)?.alerts_created ?? 0;
      const scanned = (data as any)?.scanned ?? 0;
      setLast({ scanned, created });
      toast.success(`สแกนเสร็จสิ้น: ตรวจ ${scanned} คน, แจ้งเตือนใหม่ ${created} รายการ`);
      // Refresh by reload event
      window.dispatchEvent(new Event("focus"));
    } catch (e: any) {
      toast.error(e?.message ?? "สแกนล้มเหลว");
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            สแกนนักเรียนเสี่ยงด้วย AI
          </p>
          <p className="text-xs text-muted-foreground">
            วิเคราะห์การมาเรียน + ผลการเรียนย้อนหลัง 30 วัน และสร้างรายการแจ้งเตือนอัตโนมัติ
          </p>
          {last && (
            <p className="text-xs text-muted-foreground">
              ครั้งล่าสุด: ตรวจ {last.scanned} คน · แจ้งเตือนใหม่ {last.created} รายการ
            </p>
          )}
        </div>
        <Button onClick={runScan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {scanning ? "กำลังสแกน..." : "สแกนตอนนี้"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function EarlyWarningPage() {
  return (
    <SimpleCrudPage
      title="Early Warning — นักเรียนเสี่ยง"
      subtitle="แจ้งเตือนนักเรียนที่มีความเสี่ยง (ขาดเรียน, เกรดต่ำ, พฤติกรรม) พร้อมข้อเสนอแนะ"
      icon={AlertTriangle}
      table="early_warning_alerts"
      searchableFields={["recommendation"]}
      orderBy="generated_at"
      headerExtra={<ScanCard />}
      fields={[
        { name: "student_id", label: "รหัสนักเรียน (UUID)", required: true },
        { name: "alert_type", label: "ประเภทความเสี่ยง", type: "select", required: true,
          options: [
            { value: "attendance", label: "ขาดเรียน" },
            { value: "academic", label: "ผลการเรียน" },
            { value: "behavior", label: "พฤติกรรม" },
            { value: "health", label: "สุขภาพ" },
            { value: "mixed", label: "หลายปัจจัย" },
          ]},
        { name: "severity", label: "ระดับความรุนแรง", type: "select", defaultValue: "medium",
          options: [
            { value: "low", label: "ต่ำ" }, { value: "medium", label: "ปานกลาง" },
            { value: "high", label: "สูง" }, { value: "critical", label: "วิกฤต" },
          ]},
        { name: "risk_score", label: "คะแนนเสี่ยง (0-100)", type: "number" },
        { name: "recommendation", label: "ข้อเสนอแนะการช่วยเหลือ", type: "textarea" },
        { name: "status", label: "สถานะ", type: "select", defaultValue: "open",
          options: [
            { value: "open", label: "เปิด" },
            { value: "acknowledged", label: "รับทราบ" },
            { value: "intervening", label: "กำลังช่วยเหลือ" },
            { value: "resolved", label: "แก้ไขแล้ว" },
            { value: "dismissed", label: "ปิด" },
          ]},
      ]}
      columns={[
        { key: "student_id", label: "นักเรียน" },
        { key: "alert_type", label: "ประเภท" },
        { key: "severity", label: "ระดับ", render: v => statusBadge(v, {
          low: { label: "ต่ำ", variant: "outline" },
          medium: { label: "กลาง", variant: "secondary" },
          high: { label: "สูง", variant: "destructive" },
          critical: { label: "วิกฤต", variant: "destructive" },
        })},
        { key: "risk_score", label: "คะแนน" },
        { key: "status", label: "สถานะ" },
        { key: "generated_at", label: "วันที่แจ้ง", render: v => new Date(v).toLocaleString("th-TH") },
      ]}
    />
  );
}
