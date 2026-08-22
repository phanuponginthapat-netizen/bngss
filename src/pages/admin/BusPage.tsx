import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bus, Plus, Users, MapPin, LogIn } from "lucide-react";

export default function BusPage(){
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [boardRoute, setBoardRoute] = useState("");
  const [boardStudent, setBoardStudent] = useState("");

  const { data: routes = [] } = useQuery({
    queryKey: ["bus-routes"],
    queryFn: async () => {
      const { data } = await supabase.from("bus_routes").select("*").order("created_at",{ascending:false});
      return (data as any[])||[];
    },
  });
  const { data: boardings = [] } = useQuery({
    queryKey: ["bus-attendance"],
    queryFn: async () => {
      const { data } = await supabase.from("bus_attendance").select("*, students(first_name,last_name,student_code), bus_routes(name)").order("boarded_at",{ascending:false}).limit(100);
      return (data as any[])||[];
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-bus"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, first_name, last_name, student_code").limit(200);
      return (data as any[])||[];
    },
  });

  const addRoute = async () => {
    if(!routeName.trim()) return toast.error("กรอกชื่อสาย");
    const { error } = await supabase.from("bus_routes").insert({ name: routeName.trim() } as any);
    if(error) toast.error(error.message);
    else { toast.success("เพิ่มสายแล้ว"); setRouteName(""); setAddOpen(false); qc.invalidateQueries({queryKey:["bus-routes"]}); }
  };
  const board = async () => {
    if(!boardRoute || !boardStudent) return toast.error("เลือกสายและนักเรียน");
    const { error } = await supabase.from("bus_attendance").insert({ route_id: boardRoute, student_id: boardStudent, status: "boarded" } as any);
    if(error) toast.error(error.message);
    else { toast.success("เช็คชื่อขึ้นรถแล้ว"); setBoardOpen(false); qc.invalidateQueries({queryKey:["bus-attendance"]}); }
  };

  const todayCount = boardings.filter((b:any)=> new Date(b.boarded_at).toDateString()===new Date().toDateString()).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Bus className="w-6 h-6 text-primary" /> รถรับส่ง — GPS + เช็คชื่อ</h1>
        <div className="flex gap-2">
          <Button onClick={()=>setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> เพิ่มสาย</Button>
          <Button variant="outline" onClick={()=>setBoardOpen(true)}><LogIn className="w-4 h-4 mr-1" /> ขึ้นรถ</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">สายรถ</p><p className="text-3xl font-bold">{routes.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">ขึ้นรถวันนี้</p><p className="text-3xl font-bold text-emerald-600">{todayCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">รวมเช็คชื่อ</p><p className="text-3xl font-bold">{boardings.length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="w-4 h-4" /> สายรถ</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ชื่อสาย</TableHead><TableHead>สร้างเมื่อ</TableHead><TableHead>ขึ้นวันนี้</TableHead></TableRow></TableHeader>
            <TableBody>
              {routes.map((r:any)=> {
                const c = boardings.filter((b:any)=> b.route_id===r.id && new Date(b.boarded_at).toDateString()===new Date().toDateString()).length;
                return <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("th-TH")}</TableCell><TableCell><Badge>{c} คน</Badge></TableCell></TableRow>;
              })}
              {routes.length===0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">ยังไม่มีสายรถ</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> เช็คชื่อขึ้น-ลงรถ ล่าสุด</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>สาย</TableHead><TableHead>นักเรียน</TableHead><TableHead>เวลา</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
            <TableBody>
              {boardings.map((b:any)=> (
                <TableRow key={b.id}><TableCell>{b.bus_routes?.name || b.route_id.slice(0,8)}</TableCell><TableCell>{b.students ? `${b.students.first_name} ${b.students.last_name} (${b.students.student_code})` : b.student_id.slice(0,8)}</TableCell><TableCell className="text-xs">{new Date(b.boarded_at).toLocaleString("th-TH")}</TableCell><TableCell><Badge variant="outline" className="text-emerald-600">ขึ้นรถ</Badge></TableCell></TableRow>
              ))}
              {boardings.length===0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">ยังไม่มีเช็คชื่อ</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent><DialogHeader><DialogTitle>เพิ่มสายรถ</DialogTitle></DialogHeader><div><Label>ชื่อสาย *</Label><Input value={routeName} onChange={e=>setRouteName(e.target.value)} placeholder="เช่น สาย A บ้านบึง" /></div><DialogFooter><Button onClick={addRoute}>บันทึก</Button></DialogFooter></DialogContent>
      </Dialog>
      <Dialog open={boardOpen} onOpenChange={setBoardOpen}>
        <DialogContent><DialogHeader><DialogTitle>เช็คชื่อขึ้นรถ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>สายรถ</Label><Select value={boardRoute} onValueChange={setBoardRoute}><SelectTrigger><SelectValue placeholder="เลือกสาย" /></SelectTrigger><SelectContent>{routes.map((r:any)=><SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>นักเรียน</Label><Select value={boardStudent} onValueChange={setBoardStudent}><SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger><SelectContent>{students.map((s:any)=><SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_code})</SelectItem>)}</SelectContent></Select></div>
          </div><DialogFooter><Button onClick={board}>ยืนยันขึ้นรถ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
