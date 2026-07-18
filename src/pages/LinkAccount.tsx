import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, IdCard, MessageCircle, LogOut } from "lucide-react";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useSystemSettings } from "@/hooks/useSystemSettings";


const LinkAccount = () => {
  const [code, setCode] = useState("");
  const [lineId, setLineId] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const { isReady, session } = useAuthSession();
  const { appName, schoolName, schoolLogo } = useSystemSettings();

  useEffect(() => {
    if (!isReady) return;
    if (!session?.user) {
      navigate("/login", { replace: true });
      return;
    }
    setEmail(session.user.email || "");
  }, [isReady, session, navigate]);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error(lang === "th" ? "กรุณากรอกรหัส" : "Please enter your code");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("link-account", {
        body: { code: code.trim(), line_id: lineId.trim() || null },
      });
      if (error || !data?.success) {
        const msg = (data?.error || error?.message || "") as string;
        if (msg.includes("not_found")) {
          toast.error(lang === "th" ? "ไม่พบรหัสนี้ในระบบ" : "Code not found");
        } else if (msg.includes("already_linked")) {
          toast.error(lang === "th" ? "รหัสนี้ถูกผูกกับบัญชีอื่นแล้ว" : "Code already linked to another account");
        } else {
          toast.error(msg || (lang === "th" ? "เกิดข้อผิดพลาด" : "Error"));
        }
        return;
      }
      toast.success(lang === "th" ? "ผูกบัญชีสำเร็จ!" : "Account linked!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center gradient-primary relative overflow-hidden px-4">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-primary-foreground/5" />
      <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full bg-primary-foreground/5" />

      <div className="absolute top-4 right-4">
        <LanguageToggle variant="light" />
      </div>

      <Card className="w-full max-w-md shadow-card-hover border-0 relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          {schoolLogo ? (
            <img src={schoolLogo} alt={schoolName || appName} className="mx-auto w-20 h-20 object-contain mb-4 drop-shadow-md" />
          ) : (
            <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
              <GraduationCap className="w-8 h-8 text-primary-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-foreground">
            {lang === "th" ? `ผูกบัญชีกับ${schoolName || "โรงเรียน"}` : `Link Your Account${schoolName ? ` to ${schoolName}` : ""}`}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === "th"
              ? "กรุณากรอกรหัสนักเรียนหรือรหัสบุคลากรเพื่อใช้งานระบบ"
              : "Enter your student or staff code to use the system"}
          </p>
          {email && (
            <p className="text-xs text-muted-foreground mt-2">
              {lang === "th" ? "Gmail: " : "Gmail: "}<span className="font-medium">{email}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4 pb-8">
          <form onSubmit={handleLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium">
                {lang === "th" ? "รหัสนักเรียน / รหัสบุคลากร" : "Student / Staff Code"} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="code"
                  type="text"
                  placeholder={lang === "th" ? "เช่น 12345" : "e.g. 12345"}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lineId" className="text-sm font-medium">
                {lang === "th" ? "LINE ID (ไม่บังคับ)" : "LINE ID (optional)"}
              </Label>
              <div className="relative">
                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="lineId"
                  type="text"
                  placeholder={lang === "th" ? "สำหรับรับการแจ้งเตือน" : "For notifications"}
                  value={lineId}
                  onChange={(e) => setLineId(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold" disabled={loading}>
              {loading ? "..." : lang === "th" ? "ผูกบัญชีและเข้าสู่ระบบ" : "Link & Continue"}
            </Button>
          </form>
          <button
            onClick={handleSignOut}
            className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            {lang === "th" ? "ออกจากระบบ" : "Sign out"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LinkAccount;
