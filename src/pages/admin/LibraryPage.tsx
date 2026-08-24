import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BookOpen, Plus, ScanBarcode, Undo2, AlertTriangle, Calendar } from "lucide-react";
import { StudentSpiderDialog } from "@/components/student/StudentSpiderDialog";

export default function LibraryPage() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [barcode, setBarcode] = useState("");
  const [borrowBookId, setBorrowBookId] = useState("");
  const [borrowStudentId, setBorrowStudentId] = useState("");
  const [spiderId, setSpiderId] = useState<string | null>(null);

  const { data: books = [] } = useQuery({
    queryKey: ["library-books"],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_books").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: loans = [] } = useQuery({
    queryKey: ["library-loans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("library_loans").select("*, library_books(title, barcode), students(first_name, last_name, student_code)").order("loaned_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: students = [] } = useQuery({
    queryKey: ["students-mini"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, first_name, last_name, student_code").limit(200);
      return (data as any[]) || [];
    },
  });

  const activeLoans = loans.filter((l: any) => l.status === "borrowed");
  const overdue = activeLoans.filter((l: any) => l.due_at && new Date(l.due_at) < new Date());

  const addBook = async () => {
    if (!title.trim()) return toast.error("กรอกชื่อหนังสือ");
    const { error } = await supabase.from("library_books").insert({ title: title.trim(), barcode: barcode.trim() || null } as any);
    if (error) toast.error(error.message);
    else { toast.success("เพิ่มหนังสือแล้ว"); setTitle(""); setBarcode(""); setAddOpen(false); qc.invalidateQueries({ queryKey: ["library-books"] }); }
  };
  const borrow = async () => {
    if (!borrowBookId || !borrowStudentId) return toast.error("เลือกหนังสือและนักเรียน");
    const due = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { error } = await supabase.from("library_loans").insert({ book_id: borrowBookId, student_id: borrowStudentId, due_at: due, status: "borrowed" } as any);
    if (error) toast.error(error.message);
    else { toast.success("ยืมสำเร็จ กำหนดคืน 7 วัน"); setBorrowOpen(false); qc.invalidateQueries({ queryKey: ["library-loans"] }); }
  };
  const returnBook = async (id: string) => {
    const { error } = await supabase.from("library_loans").update({ returned_at: new Date().toISOString(), status: "returned" } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("คืนแล้ว"); qc.invalidateQueries({ queryKey: ["library-loans"] }); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-primary" /> ห้องสมุด ยืม-คืน</h1>
        <div className="flex gap-2">
          <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> เพิ่มหนังสือ</Button>
          <Button variant="outline" onClick={() => setBorrowOpen(true)}><ScanBarcode className="w-4 h-4 mr-1" /> ยืม</Button>
          <Button variant="secondary" onClick={() => toast.info("RFID self-check: วางหนังสือบนแท่น → อ่านอัตโนมัติ")}><ScanBarcode className="w-4 h-4 mr-1" /> RFID สแกน</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">หนังสือทั้งหมด</p><p className="text-3xl font-bold">{books.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">กำลังยืม</p><p className="text-3xl font-bold text-amber-600">{activeLoans.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">เกินกำหนด</p><p className="text-3xl font-bold text-red-600">{overdue.length}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">รายการหนังสือ</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>ชื่อ</TableHead><TableHead>บาร์โค้ด</TableHead><TableHead>สถานะ</TableHead></TableRow></TableHeader>
            <TableBody>
              {books.map((b: any) => {
                const isBorrowed = activeLoans.some((l: any) => l.book_id === b.id);
                return <TableRow key={b.id}><TableCell>{b.title}</TableCell><TableCell className="font-mono text-xs">{b.barcode || "-"}</TableCell><TableCell>{isBorrowed ? <Badge variant="secondary">ยืมอยู่</Badge> : <Badge variant="outline" className="text-emerald-600">ว่าง</Badge>}</TableCell></TableRow>;
              })}
              {books.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">ยังไม่มีหนังสือ</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-4 h-4" /> ประวัติยืม-คืน {overdue.length > 0 && <Badge variant="destructive" className="ml-2"><AlertTriangle className="w-3 h-3 mr-1" /> เกินกำหนด {overdue.length}</Badge>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>หนังสือ</TableHead><TableHead>นักเรียน</TableHead><TableHead>ยืมเมื่อ</TableHead><TableHead>กำหนดคืน</TableHead><TableHead>สถานะ</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {loans.map((l: any) => {
                const isOverdue = l.status === "borrowed" && l.due_at && new Date(l.due_at) < new Date();
                return (
                  <TableRow key={l.id} className={isOverdue ? "bg-red-50" : ""}>
                    <TableCell>{l.library_books?.title || l.book_id.slice(0, 8)}</TableCell>
                    <TableCell><button onClick={() => setSpiderId(l.student_id)} className="text-primary hover:underline">{l.students ? `${l.students.first_name} ${l.students.last_name} (${l.students.student_code})` : l.student_id.slice(0, 8)}</button></TableCell>
                    <TableCell className="text-xs">{new Date(l.loaned_at).toLocaleDateString("th-TH")}</TableCell>
                    <TableCell className="text-xs">{l.due_at ? new Date(l.due_at).toLocaleDateString("th-TH") : "-"}</TableCell>
                    <TableCell>{l.status === "borrowed" ? <Badge variant={isOverdue ? "destructive" : "secondary"}>{isOverdue ? "เกินกำหนด" : "ยืมอยู่"}</Badge> : <Badge variant="outline">คืนแล้ว</Badge>}</TableCell>
                    <TableCell>{l.status === "borrowed" && <Button size="sm" variant="outline" onClick={() => returnBook(l.id)}><Undo2 className="w-3 h-3 mr-1" /> คืน</Button>}</TableCell>
                  </TableRow>
                );
              })}
              {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">ยังไม่มีประวัติ</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มหนังสือ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ชื่อหนังสือ *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น Harry Potter" /></div>
            <div><Label>บาร์โค้ด</Label><Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="สแกนบาร์โค้ด" /></div>
          </div>
          <DialogFooter><Button onClick={addBook}>บันทึก</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <StudentSpiderDialog studentId={spiderId} open={!!spiderId} onOpenChange={(v) => { if (!v) setSpiderId(null); }} />
      <Dialog open={borrowOpen} onOpenChange={setBorrowOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>ยืมหนังสือ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>หนังสือ</Label>
              <Select value={borrowBookId} onValueChange={setBorrowBookId}><SelectTrigger><SelectValue placeholder="เลือกหนังสือ" /></SelectTrigger><SelectContent>{books.filter((b: any) => !activeLoans.some((l: any) => l.book_id === b.id)).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title} {b.barcode ? `(${b.barcode})` : ""}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label>นักเรียน</Label>
              <Select value={borrowStudentId} onValueChange={setBorrowStudentId}><SelectTrigger><SelectValue placeholder="เลือกนักเรียน" /></SelectTrigger><SelectContent>{students.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.student_code})</SelectItem>)}</SelectContent></Select>
            </div>
            <p className="text-xs text-muted-foreground">กำหนดคืน 7 วัน นับจากวันนี้</p>
          </div>
          <DialogFooter><Button onClick={borrow}>ยืนยันยืม</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
