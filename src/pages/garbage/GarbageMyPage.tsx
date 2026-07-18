import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Coins, Recycle, Gift, Sparkles, History, TrendingUp, QrCode } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, addDays } from "date-fns";
import { th } from "date-fns/locale";
import { StatCard } from "@/components/shared";

type Mode = "daily" | "monthly" | "term";

export default function GarbageMyPage() {
  const { user, isReady } = useAuthSession();
  const [holderId, setHolderId] = useState<string | null>(null);
  const [holderKind, setHolderKind] = useState<"student" | "personnel" | null>(null);
  const [holderInfo, setHolderInfo] = useState<{ name: string; code: string; sub: string } | null>(null);
  const [points, setPoints] = useState(0);
  const [mode, setMode] = useState<Mode>("monthly");
  const [deposits, setDeposits] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    if (mode === "daily") return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), label: "7 วันล่าสุด" };
    if (mode === "monthly") return { from: startOfMonth(now), to: endOfMonth(now), label: format(now, "MMMM yyyy", { locale: th }) };
    // term: simple — last 6 months
    return { from: subDays(now, 180), to: now, label: "ภาคเรียนปัจจุบัน" };
  }, [mode]);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      if (!user) { setLoading(false); return; }
      const { data: s } = await supabase
        .from("students")
        .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (s) {
        setHolderKind("student"); setHolderId(s.id);
        setHolderInfo({
          name: `${(s as any).prefix || ""}${s.first_name} ${s.last_name}`.trim(),
          code: s.student_code,
          sub: (s as any).classrooms?.name || "-",
        });
        const { data: p } = await supabase.from("garbage_student_points").select("total_points").eq("student_id", s.id).maybeSingle();
        setPoints((p as any)?.total_points || 0);
        return;
      }
      // ไม่ใช่นักเรียน → ลองบุคลากร
      const { data: pr } = await supabase
        .from("personnel")
        .select("id, employee_code, prefix, first_name, last_name, position")
        .eq("user_id", user.id)
        .maybeSingle();
      if (pr) {
        setHolderKind("personnel"); setHolderId(pr.id);
        setHolderInfo({
          name: `${(pr as any).prefix || ""}${pr.first_name} ${pr.last_name}`.trim(),
          code: (pr as any).employee_code || "-",
          sub: (pr as any).position || "-",
        });
        const { data: p } = await supabase.from("garbage_personnel_points").select("total_points").eq("personnel_id", pr.id).maybeSingle();
        setPoints((p as any)?.total_points || 0);
        return;
      }
      setLoading(false);
    })();
  }, [isReady, user?.id]);

  useEffect(() => {
    if (!holderId || !holderKind) return;
    (async () => {
      setLoading(true);
      const fromIso = range.from.toISOString();
      const toIso = range.to.toISOString();
      const filterCol = holderKind === "student" ? "student_id" : "personnel_id";
      const [{ data: D }, { data: R }] = await Promise.all([
        supabase.from("garbage_deposits")
          .select("created_at, quantity, points_earned, garbage_items(name, unit)")
          .eq(filterCol, holderId).gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }),
        supabase.from("garbage_redemptions")
          .select("created_at, quantity, points_used, garbage_rewards(name)")
          .eq(filterCol, holderId).gte("created_at", fromIso).lte("created_at", toIso)
          .order("created_at", { ascending: false }),
      ]);
      setDeposits((D as any[]) || []);
      setRedemptions((R as any[]) || []);
      setLoading(false);
    })();
  }, [holderId, holderKind, range.from, range.to]);

  const summary = useMemo(() => ({
    deposits: deposits.length,
    redeem: redemptions.length,
    pointsIn: deposits.reduce((s, d) => s + Number(d.points_earned || 0), 0),
    pointsOut: redemptions.reduce((s, d) => s + Number(d.points_used || 0), 0),
    totalKg: deposits.reduce((s, d) => s + Number(d.quantity || 0), 0),
  }), [deposits, redemptions]);

  // chart by day
  const chartData = useMemo(() => {
    const map = new Map<string, { label: string; points: number }>();
    for (let cur = new Date(range.from); cur <= range.to; cur = addDays(cur, 1)) {
      const k = format(cur, "dd/MM");
      map.set(k, { label: k, points: 0 });
    }
    deposits.forEach((d) => {
      const k = format(new Date(d.created_at), "dd/MM");
      const cur = map.get(k); if (cur) cur.points += Number(d.points_earned || 0);
    });
    return Array.from(map.values());
  }, [deposits, range.from, range.to]);

  if (!holderInfo) {
    return (
      <div className="container mx-auto p-6">
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          {loading ? "กำลังโหลด..." : "ไม่พบข้อมูลผู้ใช้ของคุณในระบบธนาคารขยะ — กรุณาติดต่อผู้ดูแลระบบ"}
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs opacity-80 uppercase tracking-wider">ธนาคารขยะของฉัน</div>
            <div className="text-2xl font-bold mt-1">{holderInfo.name}</div>
            <div className="text-sm opacity-90">รหัส {holderInfo.code} • {holderInfo.sub}</div>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 bg-white/20 hover:bg-white/30 text-white border-0"
              onClick={() => setQrOpen(true)}
            >
              <QrCode className="w-4 h-4 mr-1" /> แสดง QR ของฉัน
            </Button>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">แต้มสะสม</div>
            <div className="text-4xl font-bold flex items-center gap-2 justify-end"><Coins className="w-8 h-8" />{points.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="w-5 h-5" /> QR รหัสประจำตัว</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="bg-white p-4 rounded-xl shadow-md">
              <QRCodeSVG value={holderInfo.code} size={220} level="H" includeMargin={false} />
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{holderInfo.name}</div>
              <div className="text-sm text-muted-foreground">รหัส {holderInfo.code}</div>
              <div className="text-xs text-muted-foreground mt-1">{holderInfo.sub}</div>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              ให้เจ้าหน้าที่สแกน QR นี้ที่เคาน์เตอร์ธนาคารขยะ
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-end">
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList>
            <TabsTrigger value="daily">รายวัน</TabsTrigger>
            <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
            <TabsTrigger value="term">รายเทอม</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="ครั้งที่ฝาก" value={summary.deposits} icon={Recycle} tone="success" />
        <StatCard label="ครั้งที่แลก" value={summary.redeem} icon={Gift} tone="warning" />
        <StatCard label="แต้มเข้า" value={`+${summary.pointsIn}`} icon={Sparkles} tone="success" />
        <StatCard label="แต้มออก" value={`-${summary.pointsOut}`} icon={Coins} tone="destructive" />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500" />แนวโน้มแต้ม ({range.label})</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="points" fill="#10b981" radius={[6,6,0,0]} name="แต้ม" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Recycle className="w-4 h-4 text-emerald-500" />ประวัติการฝาก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead>ขยะ</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">แต้ม</TableHead></TableRow></TableHeader>
              <TableBody>
                {deposits.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">ไม่มีรายการ</TableCell></TableRow>
                ) : deposits.slice(0, 50).map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM HH:mm:ss", { locale: th })}</TableCell>
                    <TableCell className="text-sm">{d.garbage_items?.name}</TableCell>
                    <TableCell className="text-right text-sm">{d.quantity} {d.garbage_items?.unit}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">+{d.points_earned}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Gift className="w-4 h-4 text-amber-500" />ประวัติการแลก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>วันที่</TableHead><TableHead>รางวัล</TableHead><TableHead className="text-right">จำนวน</TableHead><TableHead className="text-right">แต้ม</TableHead></TableRow></TableHeader>
              <TableBody>
                {redemptions.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">ไม่มีรายการ</TableCell></TableRow>
                ) : redemptions.slice(0, 50).map((d, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{format(new Date(d.created_at), "dd MMM HH:mm:ss", { locale: th })}</TableCell>
                    <TableCell className="text-sm">{d.garbage_rewards?.name}</TableCell>
                    <TableCell className="text-right text-sm">{d.quantity}</TableCell>
                    <TableCell className="text-right font-bold text-rose-600">-{d.points_used}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
