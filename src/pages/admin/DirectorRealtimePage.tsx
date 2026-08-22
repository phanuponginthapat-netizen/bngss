import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDirectorStats } from "@/lib/directorDashboard";

export default function DirectorRealtimePage(){
  const [s,setS]=useState<any>(null);
  useEffect(()=>{ fetchDirectorStats().then(setS); const t=setInterval(()=>fetchDirectorStats().then(setS), 10000); return()=>clearInterval(t); },[]);
  if(!s) return <div className="p-6">กำลังโหลด...</div>;
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">แดชบอร์ด ผอ. Real-time</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader><CardTitle>มาเรียน</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{s.attendance}%</CardContent></Card>
        <Card><CardHeader><CardTitle>GPA เฉลี่ย</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{s.gpa}</CardContent></Card>
        <Card><CardHeader><CardTitle>ใช้งบ</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{s.budgetUsed}%</CardContent></Card>
        <Card><CardHeader><CardTitle>อาหารกลางวัน</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{s.lunch} คน</CardContent></Card>
      </div>
    </div>
  );
}
