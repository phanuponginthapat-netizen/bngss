import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { submitWPA } from "@/lib/wpa";
export default function WpaPage(){
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">ประเมิน วPA</h1>
      <Card><CardHeader><CardTitle>ส่งผลงาน + ประเมิน</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input type="file" multiple className="text-sm" />
          <Button onClick={()=> submitWPA("me",[]).then(()=>alert("ส่ง วPA แล้ว"))}>ส่ง วPA</Button>
          <p className="text-xs text-muted-foreground">ผอ. จะเห็นไฟล์และกดประเมินออนไลน์ได้ทันที</p>
        </CardContent>
      </Card>
    </div>
  );
}
