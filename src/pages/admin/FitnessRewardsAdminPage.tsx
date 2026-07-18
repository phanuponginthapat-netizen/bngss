import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Gift, Plus, Edit, Trash2, Check, X, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirmAction";
import { useAuthSession } from "@/hooks/useAuthSession";
import { PhotoUploadField } from "@/components/ui/photo-upload-field";

type Reward = {
  id: string; name: string; description: string | null; image_url: string | null;
  cost_points: number; stock: number; is_active: boolean;
};
type Redemption = {
  id: string; user_id: string; reward_id: string; cost_points: number; status: string;
  note: string | null; created_at: string; delivered_at: string | null;
  reward?: { name: string };
  user?: { first_name: string | null; last_name: string | null; nickname: string | null };
};

const empty: Partial<Reward> = { name: "", description: "", image_url: "", cost_points: 50, stock: 10, is_active: true };

export default function FitnessRewardsAdminPage() {
  const { session } = useAuthSession();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const [r, rd] = await Promise.all([
      supabase.from("fitness_rewards").select("*").order("created_at", { ascending: false }),
      supabase.from("fitness_redemptions")
        .select("*,reward:fitness_rewards(name),user:profiles!fitness_redemptions_user_id_fkey(first_name,last_name,nickname)")
        .order("created_at", { ascending: false }).limit(100),
    ]);
    setRewards((r.data || []) as any);
    // fallback if profiles fk relation doesn't auto-detect
    if (rd.error) {
      const { data } = await supabase.from("fitness_redemptions").select("*,reward:fitness_rewards(name)").order("created_at", { ascending: false }).limit(100);
      const ids = Array.from(new Set((data || []).map((x: any) => x.user_id)));
      const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,nickname").in("id", ids);
      const pmap = new Map((profs || []).map((p: any) => [p.id, p]));
      setRedemptions(((data || []) as any).map((r: any) => ({ ...r, user: pmap.get(r.user_id) })));
    } else {
      setRedemptions((rd.data || []) as any);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const ch = supabase.channel("fitness-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "fitness_redemptions" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "fitness_rewards" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    if (!editing?.name || !editing.cost_points) { toast.error("กรอกชื่อและแต้ม"); return; }
    const payload = {
      name: editing.name, description: editing.description || null, image_url: editing.image_url || null,
      cost_points: Number(editing.cost_points), stock: Number(editing.stock || 0), is_active: editing.is_active ?? true,
    };
    const { error } = editing.id
      ? await supabase.from("fitness_rewards").update(payload).eq("id", editing.id)
      : await supabase.from("fitness_rewards").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("บันทึกแล้ว");
    setOpen(false); setEditing(null); load();
  };

  const del = async (rw: Reward) => {
    if (!(await confirmDelete(`ลบของรางวัล "${rw.name}"?`))) return;
    const { error } = await supabase.from("fitness_rewards").delete().eq("id", rw.id);
    if (error) { toast.error(error.message); return; }
    toast.success("ลบแล้ว"); load();
  };

  const updateStatus = async (r: Redemption, status: "delivered" | "cancelled") => {
    const patch: any = { status };
    if (status === "delivered") { patch.delivered_at = new Date().toISOString(); patch.delivered_by = session?.user.id; }
    const { error } = await supabase.from("fitness_redemptions").update(patch).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    // refund points + stock when cancelling
    if (status === "cancelled" && r.status !== "cancelled") {
      await supabase.from("fitness_points_ledger").insert({
        user_id: r.user_id, points: r.cost_points,
        reason: `คืนแต้ม (ยกเลิก): ${r.reward?.name || "รางวัล"}`,
        source_type: "redemption_refund", source_id: r.id,
      });
      await supabase.rpc("increment_reward_stock" as any, { _id: r.reward_id }).then(() => {}, () => {
        // fallback manual
        supabase.from("fitness_rewards").select("stock").eq("id", r.reward_id).single().then(({ data }) => {
          if (data) supabase.from("fitness_rewards").update({ stock: (data.stock || 0) + 1 }).eq("id", r.reward_id);
        });
      });
    }
    toast.success(status === "delivered" ? "ยืนยันส่งมอบแล้ว" : "ยกเลิกและคืนแต้มแล้ว");
    load();
  };

  const userName = (u?: Redemption["user"]) => u ? [u.first_name, u.last_name].filter(Boolean).join(" ") + (u.nickname ? ` (${u.nickname})` : "") : "—";
  const pending = redemptions.filter(r => r.status === "pending");

  return (
    <div className="container max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-pink-500 flex items-center justify-center shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">จัดการรางวัลฟิตเนส</h1>
          <p className="text-sm text-muted-foreground">เพิ่ม/แก้ของรางวัล และยืนยันการส่งมอบให้นักเรียน</p>
        </div>
      </div>

      <Tabs defaultValue="redemptions">
        <TabsList>
          <TabsTrigger value="redemptions">
            <Gift className="w-4 h-4 mr-1.5" />คำขอแลก {pending.length > 0 && <Badge className="ml-1.5 h-5">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rewards"><Trophy className="w-4 h-4 mr-1.5" />คลังของรางวัล</TabsTrigger>
        </TabsList>

        <TabsContent value="redemptions" className="space-y-2">
          {redemptions.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีคำขอแลกของ</CardContent></Card>
          ) : redemptions.map(r => (
            <Card key={r.id}>
              <CardContent className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{r.reward?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {userName(r.user)} • {r.cost_points} แต้ม • {new Date(r.created_at).toLocaleString("th-TH", { hour12: false })}
                  </div>
                  {r.note && <div className="text-xs mt-1 italic">"{r.note}"</div>}
                </div>
                <Badge variant={r.status === "delivered" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"}>
                  {r.status === "delivered" ? "ส่งแล้ว" : r.status === "cancelled" ? "ยกเลิก" : "รอส่งมอบ"}
                </Badge>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStatus(r, "delivered")}><Check className="w-4 h-4 mr-1" />ส่งมอบ</Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r, "cancelled")}><X className="w-4 h-4 mr-1" />ยกเลิก</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rewards" className="space-y-3">
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(empty)}><Plus className="w-4 h-4 mr-1" />เพิ่มของรางวัล</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing?.id ? "แก้ไข" : "เพิ่ม"}ของรางวัล</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>ชื่อ *</Label><Input value={editing?.name || ""} onChange={e => setEditing({ ...editing!, name: e.target.value })} /></div>
                  <div><Label>คำอธิบาย</Label><Textarea value={editing?.description || ""} onChange={e => setEditing({ ...editing!, description: e.target.value })} rows={2} /></div>
                  <div><Label>รูปภาพของรางวัล</Label><PhotoUploadField value={editing?.image_url || ""} onChange={(url) => setEditing({ ...editing!, image_url: url || "" })} bucket="cms-images" folder="fitness-rewards" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>ราคา (แต้ม) *</Label><Input type="number" min={1} value={editing?.cost_points ?? ""} onChange={e => setEditing({ ...editing!, cost_points: Number(e.target.value) })} /></div>
                    <div><Label>สต็อก</Label><Input type="number" min={0} value={editing?.stock ?? ""} onChange={e => setEditing({ ...editing!, stock: Number(e.target.value) })} /></div>
                  </div>
                  <div className="flex items-center gap-2"><Switch checked={editing?.is_active ?? true} onCheckedChange={v => setEditing({ ...editing!, is_active: v })} /><Label>เปิดให้แลก</Label></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button><Button onClick={save}>บันทึก</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rewards.length === 0 && <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีของรางวัล กดปุ่ม "เพิ่มของรางวัล" เพื่อเริ่ม</CardContent></Card>}
            {rewards.map(rw => (
              <Card key={rw.id} className={!rw.is_active ? "opacity-60" : ""}>
                <CardContent className="p-3 flex flex-col">
                  {rw.image_url ? (
                    <img src={rw.image_url} alt={rw.name} className="w-full h-32 object-cover rounded-lg mb-2" />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center text-5xl mb-2">🎁</div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{rw.name}</div>
                      {rw.description && <div className="text-xs text-muted-foreground line-clamp-2">{rw.description}</div>}
                    </div>
                    {!rw.is_active && <Badge variant="outline" className="text-[10px]">ปิด</Badge>}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <Badge variant="secondary">{rw.cost_points} แต้ม</Badge>
                    <span className="text-muted-foreground">สต็อก {rw.stock}</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(rw); setOpen(true); }}><Edit className="w-3.5 h-3.5 mr-1" />แก้ไข</Button>
                    <Button size="sm" variant="ghost" onClick={() => del(rw)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
