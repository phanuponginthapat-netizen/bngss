import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function HelpCenterAI({ embedded = false }: { embedded?: boolean }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setA("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { messages: [{ role: "user", content: `คำถามเรื่องการใช้งานระบบโรงเรียน: ${q.trim()}` }] },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setA((data as any)?.reply || "ขออภัย ยังไม่มีคำตอบ ลองถามใหม่อีกครั้ง");
    } catch (e: any) {
      const msg = String(e?.message || e);
      setA(/401|Unauthorized/i.test(msg) ? "กรุณาเข้าสู่ระบบก่อนใช้ผู้ช่วย AI" : "ผู้ช่วย AI ไม่ว่างชั่วคราว ลองใหม่อีกครั้ง: " + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? "" : "p-6 max-w-3xl mx-auto space-y-4"}>
      <Card>
        <CardHeader><CardTitle>ถามผู้ช่วย AI</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} placeholder="พิมพ์คำถาม เช่น ทำ ปพ.5 ยังไง" />
            <Button onClick={ask} disabled={loading}>{loading ? "กำลังคิด..." : "ถาม"}</Button>
          </div>
          {a && <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">{a}</div>}
          <p className="text-xs text-muted-foreground">ใช้ผู้ช่วย AI ตัวเดียวกับปุ่มแชทในระบบ ตอบได้ทันทีโดยไม่ต้องโหลดอะไรเพิ่ม</p>
        </CardContent>
      </Card>
    </div>
  );
}
