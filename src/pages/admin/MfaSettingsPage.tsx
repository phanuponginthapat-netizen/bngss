import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Shield, ShieldCheck, ShieldOff, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MfaState {
  enabled: boolean;
  secret?: string;
  otpauth?: string;
  backup_codes?: string[];
}

export default function MfaSettingsPage() {
  const [mfa, setMfa] = useState<MfaState>({ enabled: false });
  const [loading, setLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [showSetup, setShowSetup] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showCodes, setShowCodes] = useState<Record<number, boolean>>({});

  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("mfa-setup", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const loadStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("mfa_settings").select("enabled").eq("user_id", user.id).maybeSingle();
      setMfa({ enabled: data?.enabled ?? false });
    } catch {
      /* ignore */
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await invoke("generate");
      setMfa((prev) => ({ ...prev, secret: res.secret, otpauth: res.otpauth }));
      setShowSetup(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) return;
    setLoading(true);
    try {
      const res = await invoke("verify", { code: verifyCode });
      if (res.valid) {
        setMfa((prev) => ({ ...prev, enabled: true, backup_codes: res.backup_codes }));
        setShowSetup(false);
        setShowBackup(true);
        toast.success("MFA enabled successfully");
        setVerifyCode("");
      } else {
        toast.error("Invalid code. Please try again.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await invoke("disable");
      setMfa({ enabled: false });
      toast.success("MFA disabled");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Copied");
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication (MFA)
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with TOTP-based two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mfa.enabled ? (
                <ShieldCheck className="h-8 w-8 text-green-500" />
              ) : (
                <ShieldOff className="h-8 w-8 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">
                  {mfa.enabled ? "MFA is enabled" : "MFA is not enabled"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mfa.enabled
                    ? "Your account is protected with two-factor authentication."
                    : "Enable MFA to secure your account with an authenticator app."}
                </p>
              </div>
            </div>
            <Badge variant={mfa.enabled ? "default" : "secondary"}>
              {mfa.enabled ? "Active" : "Inactive"}
            </Badge>
          </div>

          <div className="flex gap-2 pt-2">
            {!mfa.enabled ? (
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? "Setting up..." : "Enable MFA"}
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleDisable} disabled={loading}>
                {loading ? "Disabling..." : "Disable MFA"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={showSetup} onOpenChange={setShowSetup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set up authenticator</DialogTitle>
            <DialogDescription>
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {mfa.otpauth && (
              <div className="flex justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfa.otpauth)}`}
                  alt="MFA QR Code"
                  className="rounded-lg border"
                />
              </div>
            )}
            {mfa.secret && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Or enter this secret manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono break-all">
                    {mfa.secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard.writeText(mfa.secret!); toast.success("Copied"); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-sm font-medium">Enter verification code</p>
              <Input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              />
            </div>
            <Button className="w-full" onClick={handleVerify} disabled={loading || verifyCode.length !== 6}>
              Verify & Enable
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackup} onOpenChange={setShowBackup}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Codes</DialogTitle>
            <DialogDescription>
              Save these codes in a safe place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {mfa.backup_codes?.map((code, i) => (
              <div key={i} className="flex items-center justify-between bg-muted rounded px-3 py-2">
                <code className="font-mono text-sm">{showCodes[i] ? code : "••••-••••"}</code>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowCodes((prev) => ({ ...prev, [i]: !prev[i] }))}
                  >
                    {showCodes[i] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyCode(code)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => { setShowBackup(false); loadStatus(); }}>
            I've saved my backup codes
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
