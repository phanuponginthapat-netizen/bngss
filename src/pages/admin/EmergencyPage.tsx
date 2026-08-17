import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { saveErrorMessage } from "@/lib/saveError";

const EmergencyPage = () => {
  const { lang } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState("info");

  const { data: records = [] } = useQuery({ queryKey: ["emergency_broadcasts"], queryFn: async () => { const { data } = await supabase.from("emergency_broadcasts").select("*").order("created_at", { ascending: false }); return data || []; } });

  const handleAdd = async () => {
    if (!title || !message) return;
    const { error } = await supabase.from("emergency_broadcasts").insert({ title, message, severity } as any);
    if (error) { toast.error(saveErrorMessage(error)); return; }
    toast.success(lang === "th" ? "ส่งประกาศสำเร็จ" : "Broadcast sent");
    qc.invalidateQueries({ queryKey: ["emergency_broadcasts"] });
    setOpen(false); setTitle(""); setMessage("");
  };

  const handleDelete = async (id: string) => { await supabase.from("emergency_broadcasts").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["emergency_broadcasts"] }); };

  const sevColors: Record<string, string> = { info: "bg-blue-100 text-blue-800", warning: "bg-yellow-100 text-yellow-800", critical: "bg-red-100 text-red-800" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-destructive" />{lang === "th" ? "ประกาศฉุกเฉิน" : "Emergency Broadcast"}</h1>
          <p className="text-sm text-muted-foreground">{lang === "th" ? "ส่งประกาศฉุกเฉินถึงทุกคน" : "Send emergency alerts to everyone"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button variant="destructive"><Plus className="w-4 h-4 mr-2" />{lang === "th" ? "ส่งประกาศ" : "Send Alert"}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{lang === "th" ? "ส่งประกาศฉุกเฉิน" : "Send Emergency Alert"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>{lang === "th" ? "หัวข้อ" : "Title"}</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div><Label>{lang === "th" ? "ข้อความ" : "Message"}</Label><Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} /></div>
              <div><Label>{lang === "th" ? "ระดับ" : "Severity"}</Label>
                <Select value={severity} onValueChange={setSeverity}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="info">{lang === "th" ? "แจ้งเตือน" : "Info"}</SelectItem><SelectItem value="warning">{lang === "th" ? "เตือนภัย" : "Warning"}</SelectItem><SelectItem value="critical">{lang === "th" ? "วิกฤต" : "Critical"}</SelectItem></SelectContent></Select></div>
              <Button variant="destructive" onClick={handleAdd} className="w-full">{lang === "th" ? "ส่งประกาศ" : "Send"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{lang === "th" ? "เวลา" : "Time"}</TableHead>
            <TableHead>{lang === "th" ? "หัวข้อ" : "Title"}</TableHead>
            <TableHead>{lang === "th" ? "ข้อความ" : "Message"}</TableHead>
            <TableHead>{lang === "th" ? "ระดับ" : "Severity"}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {records.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{new Date(r.sent_at).toLocaleString("th-TH")}</TableCell>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.message}</TableCell>
                <TableCell><Badge className={sevColors[r.severity] || ""}>{r.severity}</Badge></TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button></TableCell>
              </TableRow>
            ))}
            {records.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{lang === "th" ? "ไม่มีข้อมูล" : "No data"}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
};

export default EmergencyPage;
