import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, Activity, Coins, Zap, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { swal } from "@/lib/swal";

type Provider = {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string | null;
  model: string;
  priority: number;
  enabled: boolean;
  supports_vision: boolean;
  supports_json: boolean;
  monthly_call_limit: number | null;
  notes: string | null;
};

const PRESETS: Record<string, { base_url: string; model: string; type: string }> = {
  openrouter: { base_url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-chat-v3.1:free", type: "openrouter" },
  openai: { base_url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", type: "openai" },
  deepseek: { base_url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", type: "deepseek" },
  groq: { base_url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", type: "openai_compatible" },
  together: { base_url: "https://api.together.xyz/v1/chat/completions", model: "Qwen/Qwen2.5-72B-Instruct-Turbo", type: "openai_compatible" },
  custom: { base_url: "", model: "", type: "openai_compatible" },
};

export default function AIProvidersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    preset: "openrouter",
    name: "",
    api_key: "",
    base_url: PRESETS.openrouter.base_url,
    model: PRESETS.openrouter.model,
    priority: 50,
    supports_vision: false,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ai_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_providers" as any)
        .select("id,name,provider_type,base_url,api_key,model,priority,enabled,supports_vision,supports_json,monthly_call_limit,notes")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data as unknown as Provider[]);
    },
  });


  const { data: usage } = useQuery({
    queryKey: ["ai_usage_summary"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data, error } = await supabase
        .from("ai_usage_logs" as any)
        .select("provider_name,model,tokens_input,tokens_output,estimated_cost,success,created_at")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as any[];
    },
  });

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const totals = (usage || []).reduce(
    (acc, r) => {
      const isToday = new Date(r.created_at) >= todayStart;
      acc.calls += 1;
      acc.success += r.success ? 1 : 0;
      acc.cost += Number(r.estimated_cost || 0);
      acc.tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
      if (isToday) {
        acc.todayCalls += 1;
        acc.todayCost += Number(r.estimated_cost || 0);
        acc.todayTokens += (r.tokens_input || 0) + (r.tokens_output || 0);
      }
      const k = r.provider_name || "unknown";
      acc.byProvider[k] = acc.byProvider[k] || { calls: 0, cost: 0, tokens: 0, todayCalls: 0, todayCost: 0 };
      acc.byProvider[k].calls += 1;
      acc.byProvider[k].cost += Number(r.estimated_cost || 0);
      acc.byProvider[k].tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
      if (isToday) {
        acc.byProvider[k].todayCalls += 1;
        acc.byProvider[k].todayCost += Number(r.estimated_cost || 0);
      }
      return acc;
    },
    { calls: 0, success: 0, cost: 0, tokens: 0, todayCalls: 0, todayCost: 0, todayTokens: 0, byProvider: {} as Record<string, { calls: number; cost: number; tokens: number; todayCalls: number; todayCost: number }> },
  );

  async function saveNew() {
    if (!form.name || !form.base_url || !form.model) {
      toast.error("กรุณากรอกชื่อ, base URL, model");
      return;
    }
    const { error } = await supabase.from("ai_providers" as any).insert({
      name: form.name,
      provider_type: PRESETS[form.preset]?.type || "openai_compatible",
      base_url: form.base_url,
      api_key: form.api_key || null,
      model: form.model,
      priority: form.priority,
      supports_vision: form.supports_vision,
      enabled: true,
    });
    if (error) return toast.error(error.message);
    toast.success("เพิ่ม Provider แล้ว");
    setShowAdd(false);
    setForm({ ...form, name: "", api_key: "" });
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  async function toggleEnabled(p: Provider) {
    await supabase.from("ai_providers" as any).update({ enabled: !p.enabled }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  async function updatePriority(p: Provider, priority: number) {
    await supabase.from("ai_providers" as any).update({ priority }).eq("id", p.id);
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  async function updateKey(p: Provider, api_key: string) {
    await supabase.from("ai_providers" as any).update({ api_key }).eq("id", p.id);
    toast.success("บันทึก API Key แล้ว");
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  async function updateLimit(p: Provider, monthly_call_limit: number | null) {
    await supabase.from("ai_providers" as any).update({ monthly_call_limit }).eq("id", p.id);
    toast.success("บันทึกโควต้าแล้ว");
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  async function remove(id: string) {
    if (!(await swal.confirm({ title: "ลบ provider นี้?", danger: true }))) return;
    await supabase.from("ai_providers" as any).delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["ai_providers"] });
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">⚡ AI Providers & Usage</h1>
          <p className="text-sm text-muted-foreground">จัดการ AI provider และดู credit/usage</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่ม Provider
        </Button>
      </div>

      {/* Usage summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Activity className="h-4 w-4" />Calls วันนี้ / 30 วัน</div>
            <div className="text-2xl font-bold mt-1">{totals.todayCalls.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">/ {totals.calls.toLocaleString()}</span></div>
            <div className="text-xs text-muted-foreground">สำเร็จ {totals.success}/{totals.calls}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Zap className="h-4 w-4" />Tokens (30d)</div>
            <div className="text-2xl font-bold mt-1">{totals.tokens.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">วันนี้ {totals.todayTokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Coins className="h-4 w-4" />Cost (est.)</div>
            <div className="text-2xl font-bold mt-1">${totals.cost.toFixed(4)}</div>
            <div className="text-xs text-muted-foreground">วันนี้ ${totals.todayCost.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertCircle className="h-4 w-4" />Active</div>
            <div className="text-2xl font-bold mt-1">{providers.filter(p => p.enabled).length}/{providers.length}</div>
            <div className="text-xs text-muted-foreground">providers</div>
          </CardContent>
        </Card>
      </div>


      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่ม AI Provider ใหม่</CardTitle>
            <CardDescription>เชื่อม API key ของเจ้าอื่นได้โดยตรง — ไม่ผ่าน Lovable Gateway</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Preset</Label>
                <Select
                  value={form.preset}
                  onValueChange={(v) => {
                    const p = PRESETS[v];
                    setForm({ ...form, preset: v, base_url: p.base_url, model: p.model });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openrouter">OpenRouter (DeepSeek/Qwen/Llama ฟรี)</SelectItem>
                    <SelectItem value="openai">OpenAI direct</SelectItem>
                    <SelectItem value="deepseek">DeepSeek direct</SelectItem>
                    <SelectItem value="groq">Groq (เร็วมาก)</SelectItem>
                    <SelectItem value="together">Together AI</SelectItem>
                    <SelectItem value="custom">Custom (OpenAI-compatible)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ชื่อแสดงผล</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="เช่น OpenRouter DeepSeek" />
              </div>
              <div className="md:col-span-2">
                <Label>API Key</Label>
                <Input type="password" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." />
              </div>
              <div className="md:col-span-2">
                <Label>Base URL</Label>
                <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
              <div>
                <Label>Priority (น้อย = ใช้ก่อน)</Label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.supports_vision} onCheckedChange={(v) => setForm({ ...form, supports_vision: v })} />
                <Label>รองรับ Vision/OCR</Label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveNew}>บันทึก</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers</TabsTrigger>
          <TabsTrigger value="usage">Usage by Provider</TabsTrigger>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-3 mt-4">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.name}</span>
                    <Badge variant="outline">{p.provider_type}</Badge>
                    {p.supports_vision && <Badge>Vision</Badge>}
                    <Badge variant="secondary">Priority {p.priority}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={p.enabled} onCheckedChange={() => toggleEnabled(p)} />
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">{p.model} • {p.base_url}</div>
                {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                {(() => {
                  const v = (totals.byProvider as any)[p.name] || { calls: 0, todayCalls: 0, cost: 0 };
                  const limit = p.monthly_call_limit;
                  const dailyQuota = limit ? Math.floor(limit / 30) : null;
                  const monthlyRemaining = limit ? Math.max(0, limit - v.calls) : null;
                  const dailyRemaining = dailyQuota ? Math.max(0, dailyQuota - v.todayCalls) : null;
                  const pct = limit ? Math.min(100, Math.round((v.calls / limit) * 100)) : 0;
                  return (
                    <div className="text-xs grid grid-cols-2 md:grid-cols-4 gap-2 bg-muted/30 rounded p-2">
                      <div><span className="text-muted-foreground">วันนี้:</span> <b>{v.todayCalls}</b>{dailyQuota ? ` / ${dailyQuota}` : ""}</div>
                      <div><span className="text-muted-foreground">30 วัน:</span> <b>{v.calls}</b>{limit ? ` / ${limit} (${pct}%)` : ""}</div>
                      <div><span className="text-muted-foreground">เหลือวันนี้:</span> <b className={dailyRemaining === 0 ? "text-destructive" : ""}>{dailyRemaining ?? "—"}</b></div>
                      <div><span className="text-muted-foreground">เหลือเดือนนี้:</span> <b className={monthlyRemaining === 0 ? "text-destructive" : ""}>{monthlyRemaining ?? "—"}</b></div>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <div className="md:col-span-2">
                    <Label className="text-xs">API Key {p.provider_type === "lovable" && "(ใช้ LOVABLE_API_KEY จาก env)"}</Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        defaultValue=""
                        placeholder={p.provider_type === "lovable" ? "ไม่ต้องกรอก" : "•••••• (ปล่อยว่างเพื่อคงค่าเดิม)"}
                        disabled={p.provider_type === "lovable"}
                        onBlur={(e) => {
                          if (e.target.value) updateKey(p, e.target.value);
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Priority</Label>
                    <Input
                      type="number"
                      defaultValue={p.priority}
                      onBlur={(e) => {
                        const v = +e.target.value;
                        if (v !== p.priority) updatePriority(p, v);
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">โควต้า/เดือน (calls)</Label>
                    <Input
                      type="number"
                      defaultValue={p.monthly_call_limit ?? ""}
                      placeholder="ไม่จำกัด"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw === "" ? null : +raw;
                        if (v !== p.monthly_call_limit) updateLimit(p, v);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card>
            <CardContent className="pt-4">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2">Provider</th>
                    <th>วันนี้</th>
                    <th>30 วัน</th>
                    <th>โควต้า/เดือน</th>
                    <th>เหลือ/วัน</th>
                    <th>เหลือ/เดือน</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals.byProvider as Record<string, { calls: number; cost: number; tokens: number; todayCalls: number; todayCost: number }>)
                    .sort((a, b) => b[1].calls - a[1].calls)
                    .map(([name, v]) => {
                      const prov = providers.find(p => p.name === name);
                      const limit = prov?.monthly_call_limit ?? null;
                      const dailyQuota = limit ? Math.floor(limit / 30) : null;
                      const dailyRemaining = dailyQuota ? Math.max(0, dailyQuota - v.todayCalls) : null;
                      const monthlyRemaining = limit ? Math.max(0, limit - v.calls) : null;
                      return (
                        <tr key={name} className="border-t">
                          <td className="py-2">{name}</td>
                          <td>{v.todayCalls.toLocaleString()}{dailyQuota ? <span className="text-muted-foreground"> / {dailyQuota}</span> : null}</td>
                          <td>{v.calls.toLocaleString()}{limit ? <span className="text-muted-foreground"> / {limit}</span> : null}</td>
                          <td>{limit ?? <span className="text-muted-foreground">ไม่จำกัด</span>}</td>
                          <td className={dailyRemaining === 0 ? "text-destructive font-semibold" : ""}>{dailyRemaining ?? "—"}</td>
                          <td className={monthlyRemaining === 0 ? "text-destructive font-semibold" : ""}>{monthlyRemaining ?? "—"}</td>
                          <td>{v.tokens.toLocaleString()}</td>
                          <td>${v.cost.toFixed(4)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardContent className="pt-4 max-h-[500px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground sticky top-0 bg-background">
                  <tr>
                    <th className="py-2">เวลา</th>
                    <th>Provider</th>
                    <th>Model</th>
                    <th>Tokens</th>
                    <th>Cost</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(usage || []).slice(0, 100).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-1">{new Date(r.created_at).toLocaleString("th-TH")}</td>
                      <td>{r.provider_name}</td>
                      <td className="font-mono">{r.model}</td>
                      <td>{((r.tokens_input || 0) + (r.tokens_output || 0)).toLocaleString()}</td>
                      <td>${Number(r.estimated_cost || 0).toFixed(5)}</td>
                      <td>{r.success ? <Badge variant="outline">OK</Badge> : <Badge variant="destructive">FAIL</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
