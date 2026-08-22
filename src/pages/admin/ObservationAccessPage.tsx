import { useCallback, useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Eye,
  Copy,
  Plus,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface ObserverToken {
  id: string;
  token: string;
  observer_name: string;
  observer_role: string;
  expires_at: string;
  max_uses: number;
  use_count: number;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export default function ObservationAccessPage() {
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const [tokens, setTokens] = useState<ObserverToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("ศึกษานิเทศก์");
  const [newHours, setNewHours] = useState("24");
  const [newNote, setNewNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ObserverToken | null>(null);
  const [showQR, setShowQR] = useState(false);

  const fetchTokens = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("observer_tokens" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setTokens((data as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const createToken = async () => {
    if (!newName.trim()) { toast.error(L("กรุณากรอกชื่อผู้สังเกตการณ์", "Enter observer name")); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("observer-token", {
        body: { action: "create", observer_name: newName.trim(), observer_role: newRole, expires_hours: parseInt(newHours) || 24, note: newNote || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(L("สร้าง Token สำเร็จ", "Token created"));
      setShowCreate(false);
      setNewName(""); setNewNote("");
      fetchTokens();
      // Show the new token
      if (data?.token) {
        setSelectedToken({ ...data, id: "new", token: data.token, observer_name: newName, observer_role: newRole, expires_at: data.expires_at, max_uses: 1, use_count: 0, is_active: true, note: newNote, created_at: new Date().toISOString() });
        setShowQR(true);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error");
    } finally { setCreating(false); }
  };

  const revokeToken = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("observer-token", { body: { action: "revoke", token_id: id } });
      if (error) throw error;
      toast.success(L("เพิกถอนแล้ว", "Revoked"));
      fetchTokens();
    } catch (e: any) { toast.error(e?.message || "Error"); }
  };

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(L("คัดลอกแล้ว", "Copied")); }
    catch { toast.error(L("คัดลอกไม่สำเร็จ", "Copy failed")); }
  };

  const loginUrl = useMemo(() => {
    if (!selectedToken) return "";
    return `${window.location.origin}/auth?token=${selectedToken.token}`;
  }, [selectedToken]);

  const shareText = useMemo(() => {
    if (!selectedToken) return "";
    return [
      L("🔎 บัญชีสำหรับผู้สังเกตการณ์ระบบ", "System Observer Access"),
      L(`ชื่อ: ${selectedToken.observer_name}`, `Name: ${selectedToken.observer_name}`),
      L(`ตำแหน่ง: ${selectedToken.observer_role}`, `Role: ${selectedToken.observer_role}`),
      `URL: ${loginUrl}`,
      `Token: ${selectedToken.token}`,
      "",
      L("หมายเหตุ: บัญชีนี้อ่านอย่างเดียว (Read-only) มีอายุ 24 ชม.", "Note: Read-only account, expires in 24h"),
    ].join("\n");
  }, [selectedToken, lang]);

  const isExpired = (expires_at: string) => new Date(expires_at) < new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> {L("บัญชีผู้สังเกตการณ์ (ศน.)", "Observer Access")}</CardTitle>
          <CardDescription>{L("สร้าง Token ชั่วคราวสำหรับผู้สังเกตการณ์ — แทนบัญชีร่วม", "Create temporary tokens for observers — replaces shared account")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> {L("สร้าง Token ใหม่", "New Token")}</Button>
            <Button variant="outline" onClick={fetchTokens}>{L("รีเฟรช", "Refresh")}</Button>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50"><tr>
                <th className="p-2 text-left">{L("ชื่อ", "Name")}</th>
                <th className="p-2 text-left">{L("ตำแหน่ง", "Role")}</th>
                <th className="p-2 text-left">{L("Token", "Token")}</th>
                <th className="p-2 text-left">{L("อายุ", "Expires")}</th>
                <th className="p-2 text-center">{L("ใช้แล้ว", "Used")}</th>
                <th className="p-2 text-center">{L("สถานะ", "Status")}</th>
                <th className="p-2 text-center">{L("จัดการ", "Actions")}</th>
              </tr></thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-2 font-medium">{t.observer_name}</td>
                    <td className="p-2">{t.observer_role}</td>
                    <td className="p-2 font-mono text-xs">{t.token.slice(0, 8)}...</td>
                    <td className="p-2 text-xs">{new Date(t.expires_at).toLocaleString("th-TH")}</td>
                    <td className="p-2 text-center">{t.use_count}/{t.max_uses}</td>
                    <td className="p-2 text-center">
                      {!t.is_active ? <Badge variant="destructive">{L("เพิกถอน", "Revoked")}</Badge>
                        : isExpired(t.expires_at) ? <Badge variant="secondary">{L("หมดอายุ", "Expired")}</Badge>
                          : <Badge variant="default" className="bg-green-600">{L("ใช้งานได้", "Active")}</Badge>}
                    </td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedToken(t); setShowQR(true); }}><QrCode className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => copy(t.token, "Token")}><Copy className="h-4 w-4" /></Button>
                        {t.is_active && !isExpired(t.expires_at) && (
                          <Button size="icon" variant="ghost" onClick={() => revokeToken(t.id)}><ShieldOff className="h-4 w-4 text-red-500" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {tokens.length === 0 && !loading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{L("ยังไม่มี Token", "No tokens yet")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{L("ความปลอดภัย", "Security")}</AlertTitle>
            <AlertDescription>
              {L("Token แต่ละตัวมีอายุจำกัด (default 24 ชม.) และใช้ได้จำนวนจำกัด — แทนบัญชีร่วม observer@school.com เดิม", "Each token is time-limited (default 24h) with limited uses — replaces the old shared observer account")}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>{L("สร้าง Token ผู้สังเกตการณ์", "Create Observer Token")}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>{L("ชื่อผู้สังเกกการณ์", "Observer Name")}</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น นางสมศรี ใจดี" /></div>
            <div><Label>{L("ตำแหน่ง", "Role")}</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ศึกษานิเทศก์">{L("ศึกษานิเทศก์", "Education Supervisor")}</SelectItem>
                  <SelectItem value="ผู้ประเมินภายนอก">{L("ผู้ประเมินภายนอก", "External Evaluator")}</SelectItem>
                  <SelectItem value="ครูพี่เลี้ยง">{L("ครูพี่เลี้ยง", "Mentor Teacher")}</SelectItem>
                  <SelectItem value="ผู้บริหาร">{L("ผู้บริหาร", "Administrator")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{L("อายุ Token (ชั่วโมง)", "Token Lifetime (hours)")}</Label>
              <Select value={newHours} onValueChange={setNewHours}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 {L("ชั่วโมง", "hour")}</SelectItem>
                  <SelectItem value="4">4 {L("ชั่วโมง", "hours")}</SelectItem>
                  <SelectItem value="8">8 {L("ชั่วโมง", "hours")}</SelectItem>
                  <SelectItem value="24">24 {L("ชั่วโมง", "hours")}</SelectItem>
                  <SelectItem value="72">3 {L("วัน", "days")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{L("หมายเหตุ (ไม่บังคับ)", "Note (optional)")}</Label><Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{L("ยกเลิก", "Cancel")}</Button>
            <Button onClick={createToken} disabled={creating}>{creating ? "..." : L("สร้าง Token", "Create Token")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR / Share Dialog */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{L("แชร์ให้ผู้สังเกตการณ์", "Share with Observer")}</DialogTitle></DialogHeader>
          {selectedToken && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <QRCodeSVG value={loginUrl} size={200} />
                <p className="text-sm text-muted-foreground">{L("สแกนเพื่อเข้าสู่ระบบ", "Scan to login")}</p>
              </div>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{L("ชื่อ", "Name")}</span><span className="font-medium">{selectedToken.observer_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{L("ตำแหน่ง", "Role")}</span><span>{selectedToken.observer_role}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{L("อายุจนถึง", "Expires")}</span><span>{new Date(selectedToken.expires_at).toLocaleString("th-TH")}</span></div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{L("ข้อความแชร์", "Share Text")}</Label>
                <Textarea value={shareText} readOnly rows={6} className="text-xs font-mono" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => copy(shareText, L("ข้อความ", "text"))}><Copy className="h-3 w-3 mr-1" /> {L("คัดลอกข้อความ", "Copy Text")}</Button>
                  <Button size="sm" variant="outline" onClick={() => copy(loginUrl, "URL")}><KeyRound className="h-3 w-3 mr-1" /> {L("คัดลอก URL", "Copy URL")}</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
