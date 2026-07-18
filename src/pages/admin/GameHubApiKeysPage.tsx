import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowLeft, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function genKey() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return "ghk_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GameHubApiKeysPage() {
  const qc = useQueryClient();
  const { user } = useAuthSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const { data: keys = [] } = useQuery({
    queryKey: ["game-hub-api-keys"],
    queryFn: async () => {
      const { data } = await supabase.from("game_hub_api_keys").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("ต้องเข้าสู่ระบบ");
      const key = genKey();
      const hash = await sha256Hex(key);
      const prefix = key.slice(0, 10);
      const { error } = await supabase.from("game_hub_api_keys").insert({
        name: name.trim(),
        key_hash: hash,
        key_prefix: prefix,
        created_by: user.id,
      });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      setCreatedKey(key);
      setName("");
      qc.invalidateQueries({ queryKey: ["game-hub-api-keys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("game_hub_api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบแล้ว");
      qc.invalidateQueries({ queryKey: ["game-hub-api-keys"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild><Link to="/dashboard/games/admin"><ArrowLeft className="w-4 h-4 mr-1" />กลับ</Link></Button>
          <h1 className="text-2xl font-bold">API Keys — Game Hub</h1>
        </div>
        <Button onClick={() => { setCreatedKey(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />สร้าง Key ใหม่</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">คู่มือใช้งานสำหรับเกมภายนอก</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>1. เกมภายนอกสแกน QR บัตรนักเรียน แล้วส่งไป <code className="bg-muted px-1 rounded">POST /functions/v1/games-auth</code></p>
          <p>2. รับ <code className="bg-muted px-1 rounded">session_token</code> ที่อายุสั้น พร้อมข้อมูลนักเรียน (ระดับชั้น, ช่วงวัย)</p>
          <p>3. เล่นจบยิงผลกลับที่ <code className="bg-muted px-1 rounded">POST /functions/v1/games-submit</code> พร้อม <code className="bg-muted px-1 rounded">game_id, score, session_token</code></p>
          <p>4. ดึง Ranking จาก <code className="bg-muted px-1 rounded">GET /functions/v1/games-leaderboard?game_id=...&band=...</code></p>
          <p className="text-xs pt-2">ทุก request ต้องใส่ header: <code className="bg-muted px-1 rounded">x-hub-key: &lt;YOUR_KEY&gt;</code></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Keys ทั้งหมด ({keys.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {keys.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">ยังไม่มี key</div>}
          {keys.map((k: any) => (
            <div key={k.id} className="flex items-center gap-3 border rounded-lg p-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{k.name}</div>
                <div className="text-xs text-muted-foreground font-mono">{k.key_prefix}••••••••</div>
              </div>
              {!k.is_active && <Badge variant="outline">ปิด</Badge>}
              <div className="text-xs text-muted-foreground">{k.last_used_at ? `ล่าสุด ${new Date(k.last_used_at).toLocaleString("th-TH")}` : "ยังไม่ถูกใช้"}</div>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm("ลบ key นี้?")) del.mutate(k.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{createdKey ? "คัดลอก Key นี้ทันที" : "สร้าง API Key ใหม่"}</DialogTitle></DialogHeader>
          {!createdKey ? (
            <div className="space-y-3">
              <Label>ชื่อ Key (สำหรับเข้าใจว่าใช้ที่ไหน)</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น Game Hub A - ตู้เกมห้องคอม" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-destructive">⚠️ Key นี้จะแสดงครั้งเดียวเท่านั้น กรุณาบันทึกไว้</p>
              <div className="flex gap-2">
                <Input value={createdKey} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("คัดลอกแล้ว"); }}><Copy className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
          <DialogFooter>
            {!createdKey ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>ยกเลิก</Button>
                <Button disabled={!name || create.isPending} onClick={() => create.mutate()}>สร้าง</Button>
              </>
            ) : (
              <Button onClick={() => setOpen(false)}>ปิด</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
