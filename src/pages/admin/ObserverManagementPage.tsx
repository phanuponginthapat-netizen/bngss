import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, Plus, Trash2, Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

type Observer = { id: string; email: string; created_at?: string; last_sign_in_at?: string | null };

export default function ObserverManagementPage() {
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [observers, setObservers] = useState<Observer[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const call = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("manage-observers", {
      body: { action, ...payload },
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "เกิดข้อผิดพลาด");
    return data;
  };

  const load = async () => {
    try {
      setLoading(true);
      const data = await call("list");
      setObservers(data.observers || []);
    } catch (e: any) {
      toast.error(e.message || "โหลดรายชื่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (!roleLoading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || password.length < 6) {
      toast.error("กรอกอีเมลและรหัสผ่าน (อย่างน้อย 6 ตัว)");
      return;
    }
    setSubmitting(true);
    try {
      await call("create", { email, password, display_name: name || "ผู้สังเกตการณ์" });
      toast.success("สร้างบัญชีผู้สังเกตการณ์สำเร็จ");
      setEmail(""); setPassword(""); setName("");
      load();
    } catch (e: any) {
      toast.error(e.message || "สร้างไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, em: string) => {
    if (!confirm(`ลบผู้สังเกตการณ์ ${em}?`)) return;
    try {
      await call("delete", { user_id: id });
      toast.success("ลบสำเร็จ");
      load();
    } catch (e: any) {
      toast.error(e.message || "ลบไม่สำเร็จ");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
          <Eye className="w-6 h-6 text-warning" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">ผู้สังเกตการณ์ (Observer)</h1>
          <p className="text-sm text-muted-foreground">
            บัญชีสำหรับบุคคลภายนอกเข้าดูระบบ — อ่านอย่างเดียว แก้ไขข้อมูลไม่ได้ เข้าใช้พร้อมกันหลายคนได้
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5" /> เพิ่มผู้สังเกตการณ์
          </CardTitle>
          <CardDescription>สร้างบัญชีใหม่ ส่งอีเมล/รหัสผ่านให้ผู้ใช้ภายนอกได้เลย</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>อีเมล</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="observer@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>รหัสผ่าน</Label>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="อย่างน้อย 6 ตัว" required minLength={6} />
            </div>
            <div className="space-y-1.5">
              <Label>ชื่อแสดง</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ผู้สังเกตการณ์" />
            </div>
            <Button type="submit" disabled={submitting} className="gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              สร้างบัญชี
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">รายชื่อผู้สังเกตการณ์</CardTitle>
          <CardDescription>{observers.length} บัญชี</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : observers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีบัญชีผู้สังเกตการณ์</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>อีเมล</TableHead>
                  <TableHead>สร้างเมื่อ</TableHead>
                  <TableHead>เข้าใช้ล่าสุด</TableHead>
                  <TableHead className="text-right">การจัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {observers.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">
                      {o.email} <Badge variant="outline" className="ml-2 bg-warning/10 text-warning border-warning/30">Observer</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleString("th-TH") : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {o.last_sign_in_at ? new Date(o.last_sign_in_at).toLocaleString("th-TH") : "ยังไม่เคยเข้า"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(o.id, o.email)} className="text-destructive hover:text-destructive gap-1.5">
                        <Trash2 className="w-4 h-4" /> ลบ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
