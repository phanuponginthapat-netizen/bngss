import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function HelpCenterAI(){
  const [q,setQ]=useState(""); const [a,setA]=useState("");
  const ask=async()=>{
    if(!q.trim()) return;
    // mock AI — ต่อ Supabase AI ได้ทันที
    setA("คำตอบ AI: สำหรับ '"+q+"' → เปิดที่เมนู ระบบ > คู่มือ หรือพิมพ์ 'ทำ ปพ.5' เพื่อเปิดฟอร์ม");
  };
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">ศูนย์ช่วยเหลือ AI 24 ชม.</h1>
      <Card><CardHeader><CardTitle>ถามอะไรก็ได้</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2"><Input value={q} onChange={e=>setQ(e.target.value)} placeholder="พิมพ์คำถาม เช่น ทำ ปพ.5 ยังไง" /><Button onClick={ask}>ถาม</Button></div>
          {a && <div className="p-3 bg-muted rounded text-sm">{a}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
