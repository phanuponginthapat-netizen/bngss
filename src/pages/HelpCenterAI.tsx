import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { askFreeAI } from "@/lib/freeAI";
export default function HelpCenterAI(){
  const [q,setQ]=useState(""); const [a,setA]=useState(""); const [loading,setLoading]=useState(false);
  const ask=async()=>{
    if(!q.trim()) return;
    setLoading(true); setA("กำลังคิด...");
    try{ const ans=await askFreeAI(q, p=> setA(p)); setA(ans); } catch(e:any){ setA("ขออภัย ลองใหม่: "+(e?.message||e)); } finally{ setLoading(false); }
  };
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">ศูนย์ช่วยเหลือ AI 24 ชม.</h1>
      <Card><CardHeader><CardTitle>ถามอะไรก็ได้</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="พิมพ์คำถาม เช่น ทำ ปพ.5 ยังไง" /><Button onClick={ask} disabled={loading}>{loading?"กำลังโหลด AI...":"ถาม (ฟรี ไม่ใช้ API)"}</Button></div>
          {a && <div className="p-3 bg-muted rounded text-sm whitespace-pre-wrap">{a}</div>}
          <p className="text-xs text-muted-foreground">AI ฟรีรันในเครื่อง (ครั้งแรกโหลด ~300MB) — ครั้งต่อไปใช้ได้เลยแม้ไม่มีเน็ต</p>
        </CardContent>
      </Card>
    </div>
  );
}
