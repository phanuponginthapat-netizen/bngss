import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ImageUploadField } from "@/components/garbage/ImageUploadField";
import { useUserRole } from "@/hooks/useUserRole";
import { swal } from "@/lib/swal";

type Item = { id: string; name: string; unit: string; points_per_unit: number; is_active: boolean; description?: string; image_url?: string };
type Reward = { id: string; name: string; points_cost: number; stock: number; is_active: boolean; description?: string; image_url?: string };

function ItemEditor({ open, onClose, item, onSaved }: { open: boolean; onClose: () => void; item: Item | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Item>>({ name: "", unit: "kg", points_per_unit: 0, is_active: true });
  useEffect(() => { setForm(item || { name: "", unit: "kg", points_per_unit: 0, is_active: true }); }, [item, open]);

  const save = async () => {
    if (!form.name || !form.unit || form.points_per_unit == null) return toast.error("กรอกข้อมูลให้ครบ");
    const payload = { name: form.name, unit: form.unit, points_per_unit: Number(form.points_per_unit), is_active: form.is_active ?? true, description: form.description || null, image_url: form.image_url || null };
    const { error } = item?.id
      ? await supabase.from("garbage_items").update(payload).eq("id", item.id)
      : await supabase.from("garbage_items").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("บันทึกแล้ว"); onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? "แก้ไขประเภทขยะ" : "เพิ่มประเภทขยะ"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>รูปภาพ</Label><ImageUploadField value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url || undefined })} folder="items" /></div>
          <div><Label>ชื่อขยะ</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น ขวดพลาสติก" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>หน่วย</Label><Input value={form.unit || ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg / ชิ้น" /></div>
            <div><Label>แต้มต่อหน่วย</Label><Input type="number" step="0.01" value={form.points_per_unit ?? 0} onChange={(e) => setForm({ ...form, points_per_unit: Number(e.target.value) })} /></div>
          </div>
          <div><Label>คำอธิบาย</Label><Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>ใช้งาน</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RewardEditor({ open, onClose, reward, onSaved }: { open: boolean; onClose: () => void; reward: Reward | null; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Reward>>({ name: "", points_cost: 10, stock: 0, is_active: true });
  useEffect(() => { setForm(reward || { name: "", points_cost: 10, stock: 0, is_active: true }); }, [reward, open]);

  const save = async () => {
    if (!form.name || !form.points_cost) return toast.error("กรอกข้อมูลให้ครบ");
    const payload = { name: form.name, points_cost: Number(form.points_cost), stock: Number(form.stock || 0), is_active: form.is_active ?? true, description: form.description || null, image_url: form.image_url || null };
    const { error } = reward?.id
      ? await supabase.from("garbage_rewards").update(payload).eq("id", reward.id)
      : await supabase.from("garbage_rewards").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("บันทึกแล้ว"); onSaved(); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{reward ? "แก้ไขรางวัล" : "เพิ่มรางวัล"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>รูปภาพ</Label><ImageUploadField value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url || undefined })} folder="rewards" /></div>
          <div><Label>ชื่อสินค้า</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>แต้มที่ใช้แลก</Label><Input type="number" value={form.points_cost ?? 0} onChange={(e) => setForm({ ...form, points_cost: Number(e.target.value) })} /></div>
            <div><Label>สต๊อก</Label><Input type="number" value={form.stock ?? 0} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} /></div>
          </div>
          <div><Label>คำอธิบาย</Label><Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>ใช้งาน</Label></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GarbageItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editReward, setEditReward] = useState<Reward | null>(null);
  const [openItem, setOpenItem] = useState(false);
  const [openReward, setOpenReward] = useState(false);
  const { role } = useUserRole();
  const canEdit = role === "admin" || role === "director" || role === "teacher";

  const load = async () => {
    const [{ data: i }, { data: r }] = await Promise.all([
      supabase.from("garbage_items").select("*").order("created_at", { ascending: false }),
      supabase.from("garbage_rewards").select("*").order("created_at", { ascending: false }),
    ]);
    setItems((i as any) || []); setRewards((r as any) || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (table: "garbage_items" | "garbage_rewards", id: string) => {
    if (!(await swal.confirm({ title: "ลบรายการนี้?", danger: true }))) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("ลบแล้ว"); load();
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{canEdit ? "จัดการอัตราแลกเปลี่ยน & รางวัล" : "อัตราแลกเปลี่ยนขยะ & ของรางวัล"}</h1>
      {!canEdit && <p className="text-sm text-muted-foreground">ดูอัตราแลกเปลี่ยนแต้มและรางวัลที่สามารถแลกได้</p>}
      <Tabs defaultValue="items">
        <TabsList><TabsTrigger value="items">ประเภทขยะ</TabsTrigger><TabsTrigger value="rewards">สินค้ารางวัล</TabsTrigger></TabsList>

        <TabsContent value="items">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>ประเภทขยะและอัตราแลกเปลี่ยน</CardTitle>
              {canEdit && <Button onClick={() => { setEditItem(null); setOpenItem(true); }}><Plus className="w-4 h-4 mr-1" />เพิ่ม</Button>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead className="w-16">รูป</TableHead><TableHead>ชื่อ</TableHead><TableHead>หน่วย</TableHead><TableHead className="text-right">แต้ม/หน่วย</TableHead><TableHead>สถานะ</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.image_url ? <img src={i.image_url} className="w-12 h-12 rounded object-cover" alt="" /> : <div className="w-12 h-12 rounded bg-muted" />}</TableCell>
                      <TableCell>{i.name}</TableCell><TableCell>{i.unit}</TableCell><TableCell className="text-right">{i.points_per_unit}</TableCell>
                      <TableCell>{i.is_active ? "ใช้งาน" : "ปิด"}</TableCell>
                      {canEdit && <TableCell className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" aria-label="แก้ไขรายการขยะ" onClick={() => { setEditItem(i); setOpenItem(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="ลบรายการขยะ" onClick={() => remove("garbage_items", i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>}
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rewards">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>สินค้ารางวัล</CardTitle>
              {canEdit && <Button onClick={() => { setEditReward(null); setOpenReward(true); }}><Plus className="w-4 h-4 mr-1" />เพิ่ม</Button>}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead className="w-16">รูป</TableHead><TableHead>ชื่อ</TableHead><TableHead className="text-right">แต้ม</TableHead><TableHead className="text-right">สต๊อก</TableHead><TableHead>สถานะ</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
                <TableBody>
                  {rewards.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.image_url ? <img src={r.image_url} className="w-12 h-12 rounded object-cover" alt="" /> : <div className="w-12 h-12 rounded bg-muted" />}</TableCell>
                      <TableCell>{r.name}</TableCell><TableCell className="text-right">{r.points_cost}</TableCell><TableCell className="text-right">{r.stock}</TableCell>
                      <TableCell>{r.is_active ? "ใช้งาน" : "ปิด"}</TableCell>
                      {canEdit && <TableCell className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" aria-label="แก้ไขของรางวัล" onClick={() => { setEditReward(r); setOpenReward(true); }}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label="ลบของรางวัล" onClick={() => remove("garbage_rewards", r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </TableCell>}
                    </TableRow>
                  ))}
                  {rewards.length === 0 && <TableRow><TableCell colSpan={canEdit ? 6 : 5} className="text-center text-muted-foreground">ยังไม่มีรายการ</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit && <ItemEditor open={openItem} onClose={() => setOpenItem(false)} item={editItem} onSaved={load} />}
      {canEdit && <RewardEditor open={openReward} onClose={() => setOpenReward(false)} reward={editReward} onSaved={load} />}
    </div>
  );
}