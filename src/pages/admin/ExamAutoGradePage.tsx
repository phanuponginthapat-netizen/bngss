import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { gradeFromBubbles } from "@/lib/examAutoGrade";

export default function ExamAutoGradePage(){
  const [result, setResult] = useState<any>(null);
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">AI ตรวจข้อสอบ — สแกนกระดาษคำตอบ</h1>
      <Card><CardHeader><CardTitle>อัปโหลด/ถ่ายกระดาษคำตอบ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input type="file" accept="image/*" capture="environment" onChange={async e=>{
            const f=e.target.files?.[0]; if(!f) return;
            // mock grading — ในระบบจริงจะใช้ OpenCV ตรวจวงกลม
            const mock={1:"A",2:"B",3:"C"} as any;
            const key={1:"A",2:"B",3:"C"} as any;
            setResult(gradeFromBubbles(mock,key));
          }} />
          {result && <div className="p-3 bg-green-50 rounded">คะแนน {result.score}/{result.total} ({result.percent}%)</div>}
          <Button onClick={()=> setResult(gradeFromBubbles({1:"A"}, {1:"A"}))}>ทดสอบสแกน (mock)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
