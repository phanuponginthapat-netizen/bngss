import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandItem, CommandEmpty, CommandGroup } from "@/components/ui/command";
import BarcodeScanner from "@/components/BarcodeScanner";
import { toast } from "sonner";
import { ScanLine, Coins, User, Recycle, Gift, ImageIcon, Plus, Minus, ShoppingCart, Trash2, Search, GraduationCap, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

type Holder = {
  kind: "student" | "personnel";
  id: string;
  code: string;
  name: string;
  sub?: string; // classroom or department
};
type Item = { id: string; name: string; unit: string; points_per_unit: number; image_url?: string };
type Reward = { id: string; name: string; points_cost: number; stock: number; image_url?: string };
type DepositLine = { item: Item; qty: number };
type RedeemLine = { reward: Reward; qty: number };

function HolderBar({ holder, points, onClear }: { holder: Holder; points: number; onClear: () => void }) {
  const Icon = holder.kind === "student" ? GraduationCap : Briefcase;
  return (
    <Card className="bg-gradient-to-r from-primary/15 to-emerald-500/15 border-primary/30">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center"><Icon className="w-7 h-7 text-primary" /></div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-lg truncate">{holder.name}</div>
          <div className="text-xs text-muted-foreground">
            {holder.kind === "student" ? "นักเรียน" : "บุคลากร"} • รหัส {holder.code} • {holder.sub || "-"}
          </div>
        </div>
        <Badge className="text-base px-3 py-1.5 bg-amber-500 hover:bg-amber-500"><Coins className="w-4 h-4 mr-1" />{points.toLocaleString()}</Badge>
        <Button size="sm" variant="ghost" onClick={onClear}>เปลี่ยน</Button>
      </CardContent>
    </Card>
  );
}

function ProductCard({ image, name, footer, disabled, onClick, selected }: {
  image?: string; name: string; footer: React.ReactNode; disabled?: boolean; onClick: () => void; selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative bg-card border rounded-xl overflow-hidden text-left transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95",
        selected && "ring-2 ring-primary border-primary",
        disabled && "opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0"
      )}
    >
      <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
        {image ? (
          <img loading="lazy" decoding="async" src={image} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        ) : (
          <ImageIcon className="w-12 h-12 text-muted-foreground/40" />
        )}
      </div>
      <div className="p-2 space-y-1">
        <div className="font-medium text-sm truncate">{name}</div>
        {footer}
      </div>
    </button>
  );
}

export default function GarbageCounterPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [scanOpen, setScanOpen] = useState(false);
  const [holder, setHolder] = useState<Holder | null>(null);
  const [points, setPoints] = useState(0);

  // ผลแสกน: รอยืนยันก่อนเลือก
  const [pendingHolder, setPendingHolder] = useState<Holder | null>(null);
  const [pendingPoints, setPendingPoints] = useState<number | null>(null);

  // search (รวมทั้งนักเรียน + บุคลากร — ระบบแยก role อัตโนมัติ)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Holder[]>([]);
  const [searching, setSearching] = useState(false);

  // deposit
  const [pickedItem, setPickedItem] = useState<Item | null>(null);
  const [qty, setQty] = useState("");
  const [depositCart, setDepositCart] = useState<DepositLine[]>([]);
  const depositTotal = useMemo(() => depositCart.reduce((s, l) => s + Math.round(l.qty * l.item.points_per_unit), 0), [depositCart]);

  // redeem
  const [redeemCart, setRedeemCart] = useState<RedeemLine[]>([]);
  const redeemTotal = useMemo(() => redeemCart.reduce((s, l) => s + l.reward.points_cost * l.qty, 0), [redeemCart]);

  const loadCatalog = async () => {
    const [{ data: i }, { data: r }] = await Promise.all([
      supabase.from("garbage_items").select("*").eq("is_active", true).order("name"),
      supabase.from("garbage_rewards").select("*").eq("is_active", true).order("name"),
    ]);
    setItems((i as any) || []); setRewards((r as any) || []);
  };
  useEffect(() => { loadCatalog(); }, []);

  // === search ===
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 1) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      // ค้นพร้อมกันทั้ง 2 ฝั่ง
      const [studentRes, personnelRes] = await Promise.all([
        supabase
          .from("students")
          .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)")
          .or(`student_code.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(15),
        supabase
          .from("personnel")
          .select("id, employee_code, prefix, first_name, last_name, position")
          .or(`employee_code.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
          .limit(15),
      ]);
      const students: Holder[] = (studentRes.data || []).map((s: any) => ({
        kind: "student", id: s.id, code: s.student_code,
        name: `${s.prefix || ""}${s.first_name} ${s.last_name}`,
        sub: s.classrooms?.name,
      }));
      const personnels: Holder[] = (personnelRes.data || []).map((p: any) => ({
        kind: "personnel", id: p.id, code: p.employee_code || "-",
        name: `${p.prefix || ""}${p.first_name} ${p.last_name}`,
        sub: p.position,
      }));
      setSearchResults([...students, ...personnels]);
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const selectHolder = async (h: Holder) => {
    setHolder(h);
    setDepositCart([]); setRedeemCart([]);
    setSearchQuery(""); setSearchResults([]);
    await refreshPoints(h);
    toast.success("เลือกแล้ว: " + h.name);
  };

  const refreshPoints = async (h: Holder | null = holder) => {
    if (!h) return;
    if (h.kind === "student") {
      const { data } = await supabase.from("garbage_student_points").select("total_points").eq("student_id", h.id).maybeSingle();
      setPoints((data as any)?.total_points || 0);
    } else {
      const { data } = await supabase.from("garbage_personnel_points").select("total_points").eq("personnel_id", h.id).maybeSingle();
      setPoints((data as any)?.total_points || 0);
    }
  };

  // สแกน QR หรือพิมพ์รหัส → ระบบหาให้ทั้งฝั่งนักเรียน + บุคลากร
  const lookupCode = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    // นักเรียนก่อน
    const { data: s } = await supabase
      .from("students")
      .select("id, student_code, prefix, first_name, last_name, classrooms!students_classroom_id_fkey(name)")
      .eq("student_code", cleanCode)
      .maybeSingle();
    if (s) {
      const st: any = s;
      const found: Holder = {
        kind: "student", id: st.id, code: st.student_code,
        name: `${st.prefix || ""}${st.first_name} ${st.last_name}`,
        sub: st.classrooms?.name,
      };
      const { data: pt } = await supabase.from("garbage_student_points").select("total_points").eq("student_id", found.id).maybeSingle();
      setPendingPoints((pt as any)?.total_points || 0);
      setPendingHolder(found);
      return;
    }
    // ลองบุคลากร
    const { data: p } = await supabase
      .from("personnel")
      .select("id, employee_code, prefix, first_name, last_name, position")
      .eq("employee_code", cleanCode)
      .maybeSingle();
    if (p) {
      const pp: any = p;
      const found: Holder = {
        kind: "personnel", id: pp.id, code: pp.employee_code || cleanCode,
        name: `${pp.prefix || ""}${pp.first_name} ${pp.last_name}`,
        sub: pp.position,
      };
      const { data: pt } = await supabase.from("garbage_personnel_points").select("total_points").eq("personnel_id", found.id).maybeSingle();
      setPendingPoints((pt as any)?.total_points || 0);
      setPendingHolder(found);
      return;
    }
    toast.error("ไม่พบรหัส " + cleanCode + " ในระบบ (นักเรียน/บุคลากร)");
  };

  // === deposit cart ===
  const addDeposit = () => {
    if (!pickedItem || !qty || Number(qty) <= 0) return;
    setDepositCart((prev) => [...prev, { item: pickedItem, qty: Number(qty) }]);
    setPickedItem(null); setQty("");
  };

  const removeDepositLine = (idx: number) => setDepositCart((prev) => prev.filter((_, i) => i !== idx));

  const getRecorderName = async (user: any) => {
    if (!user?.id) return user?.email ?? null;
    const { data: p } = await supabase
      .from("profiles")
      .select("first_name, last_name, nickname")
      .eq("id", user.id)
      .maybeSingle();
    const full = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
    return full || p?.nickname || user?.email || null;
  };

  const submitDepositCart = async () => {
    if (!holder || depositCart.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const recorderName = await getRecorderName(user);
    const rows = depositCart.map((l) => ({
      ...(holder.kind === "student" ? { student_id: holder.id } : { personnel_id: holder.id }),
      item_id: l.item.id,
      quantity: l.qty,
      points_earned: Math.round(l.qty * l.item.points_per_unit),
      recorded_by: user?.id, recorded_by_name: recorderName,
    }));
    const { error } = await supabase.from("garbage_deposits").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`บันทึก ${depositCart.length} รายการ +${depositTotal} แต้ม`);
    setDepositCart([]); refreshPoints();
  };


  // === redeem cart ===
  const addToRedeem = (r: Reward) => {
    setRedeemCart((prev) => {
      const ex = prev.find((l) => l.reward.id === r.id);
      if (ex) {
        if (ex.qty + 1 > r.stock) { toast.error("สต๊อกไม่พอ"); return prev; }
        return prev.map((l) => l.reward.id === r.id ? { ...l, qty: l.qty + 1 } : l);
      }
      if (r.stock < 1) { toast.error("สต๊อกหมด"); return prev; }
      return [...prev, { reward: r, qty: 1 }];
    });
  };

  const updateRedeemQty = (id: string, delta: number) => {
    setRedeemCart((prev) => prev.flatMap((l) => {
      if (l.reward.id !== id) return [l];
      const next = l.qty + delta;
      if (next <= 0) return [];
      if (next > l.reward.stock) { toast.error("สต๊อกไม่พอ"); return [l]; }
      return [{ ...l, qty: next }];
    }));
  };

  const submitRedeem = async () => {
    if (!holder || redeemCart.length === 0) return;
    if (redeemTotal > points) return toast.error("แต้มไม่เพียงพอ");
    const { data: { user } } = await supabase.auth.getUser();
    const recorderName = await getRecorderName(user);
    const rows = redeemCart.map((l) => ({
      ...(holder.kind === "student" ? { student_id: holder.id } : { personnel_id: holder.id }),
      reward_id: l.reward.id,
      quantity: l.qty,
      points_used: l.reward.points_cost * l.qty,
      recorded_by: user?.id, recorded_by_name: recorderName,
    }));

    const { error } = await supabase.from("garbage_redemptions").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`แลกเรียบร้อย -${redeemTotal} แต้ม`);
    setRedeemCart([]); refreshPoints(); loadCatalog();
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 max-w-6xl">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Recycle className="text-emerald-500" /> Bank Counter — เคาน์เตอร์ธนาคารขยะ</h1>

      {!holder ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="text-center space-y-2">
              <ScanLine className="w-16 h-16 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground">สแกน QR บัตรหรือพิมพ์รหัส/ชื่อ — ระบบจะค้นทั้งนักเรียนและบุคลากรอัตโนมัติ</p>
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="พิมพ์รหัส/ชื่อ นักเรียนหรือบุคลากร..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && searchQuery.trim()) {
                        e.preventDefault();
                        lookupCode(searchQuery.trim());
                      }
                    }}
                    className="pl-9"
                  />
                </div>
                <Button onClick={() => setScanOpen(true)} variant="outline" className="gap-1">
                  <ScanLine className="w-4 h-4" />สแกน QR
                </Button>
              </div>

              {searchQuery.trim() && (
                <Card>
                  <CardContent className="p-2 max-h-72 overflow-y-auto">
                    {searching ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">กำลังค้นหา...</p>
                    ) : searchResults.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">ไม่พบข้อมูล</p>
                    ) : (
                      <div className="space-y-1">
                        {searchResults.map((h) => (
                          <button
                            key={h.kind + h.id}
                            onClick={() => selectHolder(h)}
                            className="w-full text-left p-2 rounded hover:bg-muted transition-colors flex items-center gap-2"
                          >
                            {h.kind === "student" ? <GraduationCap className="w-4 h-4 text-primary" /> : <Briefcase className="w-4 h-4 text-primary" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{h.name}</div>
                              <div className="text-xs text-muted-foreground truncate">รหัส {h.code} • {h.sub || "-"}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <HolderBar holder={holder} points={points} onClear={() => { setHolder(null); setDepositCart([]); setRedeemCart([]); }} />

          <Tabs defaultValue="deposit">
            <TabsList className="grid grid-cols-1 sm:grid-cols-2 w-full md:w-96">
              <TabsTrigger value="deposit"><Recycle className="w-4 h-4 mr-1" />ฝากขยะ</TabsTrigger>
              <TabsTrigger value="redeem"><Gift className="w-4 h-4 mr-1" />แลกรางวัล</TabsTrigger>
            </TabsList>

            {/* DEPOSIT — POS grid + ตะกร้าหลายรายการ */}
            <TabsContent value="deposit">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {items.length === 0 ? (
                    <Card><CardContent className="p-12 text-center text-muted-foreground">ยังไม่มีประเภทขยะ</CardContent></Card>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {items.map((i) => (
                        <ProductCard
                          key={i.id}
                          image={i.image_url}
                          name={i.name}
                          onClick={() => { setPickedItem(i); setQty(""); }}
                          footer={<div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{i.points_per_unit} แต้ม / {i.unit}</div>}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Deposit Cart */}
                <Card className="lg:sticky lg:top-4 self-start">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 font-bold"><ShoppingCart className="w-5 h-5" />ตะกร้าฝาก ({depositCart.length})</div>
                    {depositCart.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">กดที่ขยะเพื่อเพิ่มเข้าตะกร้า</p>
                    ) : (
                      <>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {depositCart.map((l, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                              {l.item.image_url && <img loading="lazy" decoding="async" src={l.item.image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{l.item.name}</div>
                                <div className="text-xs text-muted-foreground">{l.qty} {l.item.unit} × {l.item.points_per_unit} = <span className="font-bold text-emerald-600">+{Math.round(l.qty * l.item.points_per_unit)}</span></div>
                              </div>
                              <Button size="icon" variant="ghost" aria-label="ลบรายการ" className="h-7 w-7" onClick={() => removeDepositLine(idx)}><Trash2 className="w-3 h-3" /></Button>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">รวมแต้มที่จะได้รับ</span>
                            <Badge className="text-base px-3 py-1 bg-emerald-500 hover:bg-emerald-500">+{depositTotal}</Badge>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setDepositCart([])}><Trash2 className="w-4 h-4" /></Button>
                          <Button className="flex-1" onClick={submitDepositCart}>ยืนยันฝาก</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Deposit dialog: เพิ่มเข้าตะกร้า */}
              <Dialog open={!!pickedItem} onOpenChange={(o) => !o && setPickedItem(null)}>
                <DialogContent>
                  <DialogHeader><DialogTitle>เพิ่ม: {pickedItem?.name}</DialogTitle></DialogHeader>
                  {pickedItem && (
                    <div className="space-y-3">
                      {pickedItem.image_url && <img loading="lazy" decoding="async" src={pickedItem.image_url} className="w-32 h-32 mx-auto rounded-lg object-cover" alt="" />}
                      <div className="text-center text-sm text-muted-foreground">อัตรา {pickedItem.points_per_unit} แต้ม / {pickedItem.unit}</div>
                      <div>
                        <Label>จำนวน ({pickedItem.unit})</Label>
                        <Input type="number" step="0.01" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0.00" autoFocus className="text-2xl text-center h-14"
                          onKeyDown={(e) => e.key === "Enter" && qty && Number(qty) > 0 && addDeposit()} />
                      </div>
                      {qty && Number(qty) > 0 && (
                        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                          <div className="text-xs text-muted-foreground">จะได้รับ</div>
                          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">+{Math.round(Number(qty) * pickedItem.points_per_unit)} แต้ม</div>
                        </div>
                      )}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setPickedItem(null)}>ยกเลิก</Button>
                    <Button onClick={addDeposit} disabled={!qty || Number(qty) <= 0}>เพิ่มเข้าตะกร้า</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* REDEEM */}
            <TabsContent value="redeem">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  {rewards.length === 0 ? (
                    <Card><CardContent className="p-12 text-center text-muted-foreground">ยังไม่มีรางวัล</CardContent></Card>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {rewards.map((r) => {
                        const inCart = redeemCart.find((l) => l.reward.id === r.id);
                        const outOfStock = r.stock <= 0;
                        const tooExpensive = r.points_cost > points;
                        return (
                          <ProductCard
                            key={r.id}
                            image={r.image_url}
                            name={r.name}
                            selected={!!inCart}
                            disabled={outOfStock}
                            onClick={() => addToRedeem(r)}
                            footer={
                              <div className="space-y-0.5">
                                <div className={cn("text-xs font-semibold flex items-center gap-1", tooExpensive ? "text-destructive" : "text-amber-600 dark:text-amber-400")}>
                                  <Coins className="w-3 h-3" />{r.points_cost} แต้ม
                                </div>
                                <div className="text-[10px] text-muted-foreground">เหลือ {r.stock} ชิ้น</div>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <Card className="lg:sticky lg:top-4 self-start">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 font-bold"><ShoppingCart className="w-5 h-5" />ตะกร้าแลก ({redeemCart.length})</div>
                    {redeemCart.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">กดที่รูปสินค้าเพื่อเพิ่ม</p>
                    ) : (
                      <>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {redeemCart.map((l) => (
                            <div key={l.reward.id} className="flex items-center gap-2 p-2 rounded bg-muted/40">
                              {l.reward.image_url && <img loading="lazy" decoding="async" src={l.reward.image_url} className="w-10 h-10 rounded object-cover" alt="" />}
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">{l.reward.name}</div>
                                <div className="text-xs text-muted-foreground">{l.reward.points_cost * l.qty} แต้ม</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button size="icon" variant="outline" aria-label="ลดจำนวน" className="h-7 w-7" onClick={() => updateRedeemQty(l.reward.id, -1)}><Minus className="w-3 h-3" /></Button>
                                <span className="w-6 text-center font-bold">{l.qty}</span>
                                <Button size="icon" variant="outline" aria-label="เพิ่มจำนวน" className="h-7 w-7" onClick={() => updateRedeemQty(l.reward.id, 1)}><Plus className="w-3 h-3" /></Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t pt-3 space-y-2">
                          <div className="flex justify-between text-sm"><span>รวม</span><span className="font-bold">{redeemTotal} แต้ม</span></div>
                          <div className="flex justify-between text-sm"><span>คงเหลือหลังแลก</span><span className={cn("font-bold", redeemTotal > points && "text-destructive")}>{(points - redeemTotal).toLocaleString()} แต้ม</span></div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRedeemCart([])}><Trash2 className="w-4 h-4" /></Button>
                          <Button className="flex-1" onClick={submitRedeem} disabled={redeemTotal > points}>ยืนยันแลก</Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onScan={(code) => { setScanOpen(false); lookupCode(code); }} title="สแกน QR บัตร — นักเรียน หรือ บุคลากร" />

      {/* ยืนยันผลการแสกนก่อนเลือก */}
      <Dialog open={!!pendingHolder} onOpenChange={(o) => { if (!o) { setPendingHolder(null); setPendingPoints(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>ยืนยันผลการแสกน</DialogTitle></DialogHeader>
          {pendingHolder && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border bg-muted/30">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  {pendingHolder.kind === "student"
                    ? <GraduationCap className="w-6 h-6 text-primary" />
                    : <Briefcase className="w-6 h-6 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{pendingHolder.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    รหัส: {pendingHolder.code}
                    {pendingHolder.sub ? ` • ${pendingHolder.sub}` : ""}
                  </div>
                  <Badge variant="secondary" className="mt-1">
                    {pendingHolder.kind === "student" ? "นักเรียน" : "บุคลากร"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="text-sm text-muted-foreground">แต้มสะสมปัจจุบัน</div>
                <div className="text-xl font-bold text-primary flex items-center gap-1">
                  <Coins className="w-5 h-5" /> {pendingPoints ?? 0}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setPendingHolder(null); setPendingPoints(null); }}>
              ยกเลิก / แสกนใหม่
            </Button>
            <Button onClick={() => {
              if (pendingHolder) {
                const h = pendingHolder;
                setPendingHolder(null); setPendingPoints(null);
                selectHolder(h);
              }
            }}>ยืนยัน</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
