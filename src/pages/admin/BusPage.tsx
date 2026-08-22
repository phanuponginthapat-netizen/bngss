import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export default function BusPage(){
  const [onBus, setOnBus]=useState(false);
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">รถรับส่ง — GPS + เช็คชื่อ</h1>
      <Card><CardHeader><CardTitle>สแกนขึ้นรถ</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={()=> setOnBus(!onBus)}>{onBus?"ลงรถ":"ขึ้นรถ"}</Button>
          <div className="h-48 bg-muted rounded flex items-center justify-center text-sm">แผนที่ GPS รถ — {onBus?"อยู่บนรถ":"ยังไม่ขึ้นรถ"}</div>
          <p className="text-xs text-muted-foreground">ผู้ปกครองจะเห็นตำแหน่งเมื่อนักเรียนขึ้นรถแล้ว</p>
        </CardContent>
      </Card>
    </div>
  );
}
