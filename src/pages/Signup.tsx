import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Lock, Mail, User } from "lucide-react";
import { saveErrorMessage } from "@/lib/saveError";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("signup.password_min"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      toast.error(saveErrorMessage(error));
    } else {
      toast.success(lang === "th" 
        ? "สมัครสมาชิกสำเร็จ!" 
        : "Registration successful!");
      navigate("/login");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-primary relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full bg-primary-foreground/5" />
      <div className="absolute bottom-[-15%] left-[-8%] w-[500px] h-[500px] rounded-full bg-primary-foreground/5" />
      <div className="absolute top-4 right-4">
        <LanguageToggle variant="light" />
      </div>
      <Card className="w-full max-w-md mx-4 shadow-card-hover border-0 relative z-10">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 shadow-lg">
            <GraduationCap className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("signup.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("signup.subtitle")}</p>
        </CardHeader>
        <CardContent className="pt-4 pb-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-sm font-medium">{t("user.first_name")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-10" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-sm font-medium">{t("user.last_name")}</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">{t("email")}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">{t("password")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="อย่างน้อย 6 ตัวอักษร" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full h-11 gradient-primary text-primary-foreground font-semibold" disabled={loading}>
              {loading ? "..." : t("signup.button")}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {t("signup.have_account")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">{t("login")}</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
