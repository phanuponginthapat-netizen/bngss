import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Lock, User, Calendar, Users, ScanLine } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { resolvePostLoginRedirect } from "@/lib/postLoginRedirect";

const Login = () => {
  const navigateEarly = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null;
  const postLoginTarget = safeNext ?? "/dashboard";

  // If already signed in, skip the login form entirely.
  useEffect(() => {
    const go = async () => {
      const t = await resolvePostLoginRedirect(postLoginTarget);
      navigateEarly(t, { replace: true });
    };
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) go(); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => { if (session) go(); });
    return () => subscription.unsubscribe();
  }, [navigateEarly, postLoginTarget]);


  // Auto-bootstrap initial admin on first run (idempotent server-side).
  useEffect(() => {
    if (sessionStorage.getItem("bootstrap_admin_checked")) return;
    sessionStorage.setItem("bootstrap_admin_checked", "1");
    supabase.functions.invoke("bootstrap-admin").then(({ data }) => {
      if (data?.created) {
        toast.success(`สร้างบัญชี admin เริ่มต้นแล้ว: ${data.email} / ${data.password}`, { duration: 15000 });
      }
    }).catch(() => {});
  }, []);



  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [pIdentifier, setPIdentifier] = useState("");
  const [pDob, setPDob] = useState("");
  const [pLoading, setPLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [parentScanOpen, setParentScanOpen] = useState(false);
  const [pQrLoading, setPQrLoading] = useState(false);
  const [userScanOpen, setUserScanOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);


  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { appName, schoolName, schoolLogo } = useSystemSettings();

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const idTrim = identifier.trim();

      if (isEmail(idTrim)) {
        const { error } = await supabase.auth.signInWithPassword({
          email: idTrim,
          password,
        });
        if (error) {
          toast.error(lang === "th" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง" : error.message);
        } else {
          import("@/lib/auditLog").then(({ logAudit }) => logAudit({ action: "login", details: { method: "password" } }));
          navigate(await resolvePostLoginRedirect(postLoginTarget), { replace: true });
        }
      } else {
        // เข้าผ่านรหัสนักเรียน/บุคลากร — ใช้ edge function เพื่อหา email จริง + signIn ฝั่ง server
        const { data, error } = await supabase.functions.invoke("code-login", {
          body: { identifier: idTrim, password },
        });
        const code = (data as any)?.error;
        if (error || !data?.success || !data?.access_token) {
          const msg =
            code === "not_found"
              ? lang === "th" ? "ไม่พบรหัสนี้ในระบบ" : "Code not found"
              : code === "invalid_credentials"
              ? lang === "th" ? "รหัสผ่านไม่ถูกต้อง" : "Invalid password"
              : code === "rate_limited"
              ? lang === "th" ? "พยายามบ่อยเกินไป รอสักครู่" : "Too many attempts"
              : lang === "th" ? "เข้าระบบไม่สำเร็จ" : "Login failed";
          toast.error(msg);
          setLoading(false);
          return;
        }
        const { error: setErr } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        });
        if (setErr) {
          toast.error(setErr.message);
        } else {
          import("@/lib/auditLog").then(({ logAudit }) => logAudit({ action: "login", details: { method: "code" } }));
          navigate(await resolvePostLoginRedirect(postLoginTarget), { replace: true });
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
    }

    setLoading(false);
  };

  const handleQrLogin = async (qr: string) => {
    const clean = (qr || "").trim();
    if (!clean) return;
    setUserScanOpen(false);
    setQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-login", { body: { qr: clean } });
      const code = (data as any)?.error;
      if (error || !data?.success || !data?.access_token) {
        const msg =
          code === "not_found"
            ? lang === "th" ? "ไม่พบผู้ใช้ตาม QR นี้" : "User not found for this QR"
            : code === "no_account"
            ? lang === "th" ? "บัตรนี้ยังไม่ได้ผูกบัญชีผู้ใช้ — แจ้งผู้ดูแลระบบเพื่อสร้างบัญชี" : "This ID card has no linked account yet"
            : code === "inactive"
            ? lang === "th" ? "บัญชีถูกระงับ" : "Account inactive"
            : code === "invalid_qr" || code === "invalid_input"
            ? lang === "th" ? "QR ไม่ถูกต้อง" : "Invalid QR code"
            : code === "rate_limited"
            ? lang === "th" ? "พยายามบ่อยเกินไป รอสักครู่" : "Too many attempts"
            : lang === "th" ? "เข้าระบบด้วย QR ไม่สำเร็จ" : "QR login failed";
        toast.error(msg);
        setQrLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) {
        toast.error(setErr.message);
        setQrLoading(false);
        return;
      }
      import("@/lib/auditLog").then(({ logAudit }) => logAudit({ action: "login", details: { method: "qr" } }));
      navigate(await resolvePostLoginRedirect(postLoginTarget), { replace: true });
    } catch (err) {
      toast.error((err as Error).message || "QR login failed");
      setQrLoading(false);
    }
  };



  // ผู้ปกครอง: สแกน QR บัตรนักเรียน → เข้าระบบด้วยบัญชีผู้ปกครองของนักเรียนคนนั้นทันที
  const handleParentQrLogin = async (qr: string) => {
    const clean = (qr || "").trim();
    if (!clean) return;
    setParentScanOpen(false);
    setPQrLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parent-qr-login", { body: { qr: clean } });
      const code = (data as any)?.error;
      if (error || !data?.success || !data?.access_token) {
        const msg =
          code === "not_found"
            ? lang === "th" ? "ไม่พบนักเรียนตาม QR นี้" : "Student not found for this QR"
            : code === "inactive"
            ? lang === "th" ? "บัญชีนักเรียนถูกระงับ" : "Student account inactive"
            : code === "not_a_parent_account"
            ? lang === "th" ? "บัญชีที่ผูกไว้ไม่ใช่บัญชีผู้ปกครอง กรุณาติดต่อผู้ดูแลระบบ" : "Linked account is not a parent account"
            : code === "invalid_qr" || code === "invalid_input"
            ? lang === "th" ? "QR ไม่ถูกต้อง" : "Invalid QR code"
            : code === "rate_limited"
            ? lang === "th" ? "พยายามบ่อยเกินไป รอสักครู่" : "Too many attempts"
            : lang === "th" ? "เข้าระบบด้วย QR ไม่สำเร็จ" : "QR login failed";
        toast.error(msg);
        setPQrLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) {
        toast.error(setErr.message);
        setPQrLoading(false);
        return;
      }
      if (data?.child?.display_name) {
        toast.success(
          lang === "th" ? `เข้าระบบผู้ปกครองของ ${data.child.display_name}` : `Signed in as parent of ${data.child.display_name}`,
        );
      }
      import("@/lib/auditLog").then(({ logAudit }) => logAudit({ action: "login", details: { method: "parent_qr" } }));
      navigate(await resolvePostLoginRedirect(postLoginTarget), { replace: true });
    } catch (err) {
      toast.error((err as Error).message || "QR login failed");
      setPQrLoading(false);
    }
  };

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parent-login", {
        body: { identifier: pIdentifier.trim(), dob: pDob.trim() },
      });
      if (error || !data?.success || !data?.access_token) {
        const code = (data as any)?.error;
        const msg =
          code === "dob_mismatch"
            ? lang === "th" ? "วันเกิดไม่ตรงกับข้อมูลนักเรียนในระบบ" : "Date of birth does not match"
            : code === "not_found"
            ? lang === "th" ? "ไม่พบรหัส/อีเมลนักเรียน" : "Student not found"
            : code === "inactive"
            ? lang === "th" ? "บัญชีนักเรียนถูกระงับ" : "Student account inactive"
            : code === "invalid_dob_format"
            ? lang === "th" ? "รูปแบบวันเกิดไม่ถูกต้อง (เช่น 12/05/2553)" : "Invalid date format"
            : code === "rate_limited"
            ? lang === "th" ? "พยายามบ่อยเกินไป รอสักครู่" : "Too many attempts"
            : lang === "th" ? "เข้าระบบไม่สำเร็จ" : "Login failed";
        toast.error(msg);
        setPLoading(false);
        return;
      }
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (setErr) {
        toast.error(setErr.message);
        setPLoading(false);
        return;
      }
      import("@/lib/auditLog").then(({ logAudit }) => logAudit({ action: "login", details: { method: "parent_magiclink" } }));
      navigate(await resolvePostLoginRedirect(postLoginTarget), { replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Login failed");
      setPLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center gradient-primary relative overflow-hidden px-4 py-8">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-primary-foreground/5" />
      <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full bg-primary-foreground/5" />

      <div className="absolute top-4 right-4">
        <LanguageToggle variant="light" />
      </div>

      <Card className="w-full max-w-md shadow-card-hover border-0 relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg overflow-hidden">
            {schoolLogo ? (
              <img src={schoolLogo} alt={appName} className="w-full h-full object-contain" />
            ) : (
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{appName || t("app.name")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{schoolName || t("app.subtitle")}</p>
        </CardHeader>
        <CardContent className="pt-4 pb-8">
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="grid grid-cols-2 w-full mb-4">
              <TabsTrigger value="user">
                <User className="w-4 h-4 mr-1.5" />
                {lang === "th" ? "ผู้ใช้งาน" : "User"}
              </TabsTrigger>
              <TabsTrigger value="parent">
                <Users className="w-4 h-4 mr-1.5" />
                {lang === "th" ? "ผู้ปกครอง" : "Parent"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="user">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-medium">
                    {lang === "th" ? "อีเมล หรือ รหัสนักเรียน/บุคลากร" : "Email or Student/Staff Code"}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="identifier"
                      type="text"
                      placeholder={lang === "th" ? "อีเมล หรือ รหัสประจำตัว" : "Email or ID code"}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">{t("password")}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold" disabled={loading || qrLoading}>
                  {loading ? "..." : t("login")}
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{lang === "th" ? "หรือ" : "or"}</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full h-11"
                onClick={() => setUserScanOpen(true)}
                disabled={qrLoading || loading}
              >
                <ScanLine className="w-4 h-4 mr-2" />
                {qrLoading
                  ? (lang === "th" ? "กำลังเข้าระบบ..." : "Signing in...")
                  : (lang === "th" ? "สแกน QR บัตรนักเรียน/บุคลากรเพื่อเข้าระบบ" : "Scan student or staff ID QR to sign in")}
              </Button>

              <p className="text-center text-xs text-muted-foreground mt-3">
                {lang === "th" ? "ลืมรหัสผ่าน? กรุณาติดต่อผู้ดูแลระบบ (Admin)" : "Forgot password? Please contact your administrator (Admin)"}
              </p>
            </TabsContent>


            <TabsContent value="parent">
              <Button
                type="button"
                className="w-full h-11 gradient-primary text-primary-foreground font-semibold mb-4"
                onClick={() => setParentScanOpen(true)}
                disabled={pQrLoading || pLoading}
              >
                <ScanLine className="w-4 h-4 mr-2" />
                {pQrLoading
                  ? (lang === "th" ? "กำลังเข้าระบบ..." : "Signing in...")
                  : (lang === "th" ? "สแกน QR บัตรนักเรียนเพื่อเข้าระบบ" : "Scan child's ID QR to sign in")}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground mb-4">
                {lang === "th"
                  ? "สแกนครั้งแรกระบบจะสร้างบัญชีผู้ปกครองให้อัตโนมัติ (สิทธิ์อ่านข้อมูลบุตรหลานเท่านั้น)"
                  : "First scan creates a parent account automatically (read-only access to your child's data)."}
              </p>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[11px] uppercase">
                  <span className="bg-card px-2 text-muted-foreground">{lang === "th" ? "หรือ" : "or"}</span>
                </div>
              </div>
              <form onSubmit={handleParentLogin} className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  {lang === "th"
                    ? "สำหรับผู้ปกครอง: เข้าระบบโดยใช้รหัส/อีเมลของบุตรหลาน พร้อมยืนยันด้วยวันเกิด"
                    : "For parents: log in using your child's student code or email, verified by date of birth."}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-id" className="text-sm font-medium">
                    {lang === "th" ? "รหัสนักเรียน หรือ อีเมลของบุตรหลาน" : "Student code or email"}
                  </Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="p-id"
                        type="text"
                        placeholder={lang === "th" ? "เช่น 12345 หรือ student@school.ac.th" : "e.g. 12345 or student@school.ac.th"}
                        value={pIdentifier}
                        onChange={(e) => setPIdentifier(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setScanOpen(true)}
                      title={lang === "th" ? "สแกน QR จากบัตรนักเรียน" : "Scan QR from student ID card"}
                    >
                      <ScanLine className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "th" ? "💡 มีบัตรนักเรียน? กดปุ่มสแกนเพื่อกรอกรหัสอัตโนมัติ" : "💡 Got the ID card? Tap scan to auto-fill"}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-dob" className="text-sm font-medium">
                    {lang === "th" ? "วันเกิดบุตรหลาน" : "Child's date of birth"}
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="p-dob"
                      type="text"
                      inputMode="numeric"
                      pattern="\d{8}"
                      maxLength={8}
                      placeholder={lang === "th" ? "ววดดปปปป เช่น 12052553" : "DDMMYYYY (BE) e.g. 12052553"}
                      value={pDob}
                      onChange={(e) => setPDob(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      className="pl-10 tracking-widest"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "th" ? "กรอกวันเกิดเป็นเลข 8 ตัว (วว+ดด+ปปปป พ.ศ.) ไม่ต้องมีขีด" : "8 digits (DD+MM+YYYY in Buddhist Era), no separators"}
                  </p>
                </div>
                <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold" disabled={pLoading}>
                  {pLoading ? "..." : lang === "th" ? "เข้าระบบสำหรับผู้ปกครอง" : "Parent Login"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={(code) => {
          const clean = (code || "").trim();
          if (!clean) return;
          setPIdentifier(clean);
          setScanOpen(false);
          toast.success(lang === "th" ? `กรอกรหัสให้แล้ว: ${clean}` : `Filled: ${clean}`);
        }}
        title={lang === "th" ? "สแกน QR จากบัตรนักเรียน" : "Scan QR from student ID card"}
      />

      <BarcodeScanner
        open={userScanOpen}
        onClose={() => setUserScanOpen(false)}
        onScan={(code) => handleQrLogin(code)}
        title={lang === "th" ? "สแกน QR บัตรนักเรียน/บุคลากรเพื่อเข้าระบบ" : "Scan student or staff ID QR to sign in"}
      />

      <BarcodeScanner
        open={parentScanOpen}
        onClose={() => setParentScanOpen(false)}
        onScan={(code) => handleParentQrLogin(code)}
        title={lang === "th" ? "ผู้ปกครอง: สแกน QR บัตรนักเรียน" : "Parent: scan child's ID QR"}
      />



    </div>
  );
};

export default Login;
