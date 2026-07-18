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

type PresetDef = {
  label: string;
  base_url: string;
  model: string;
  type: string;
  vision?: boolean;
  hint?: string;
};

// จัดเรียงตาม tier: ฟรีถาวร → ฟรีจำกัด → ฟรีเครดิต → เสียเงิน
const PRESETS: Record<string, PresetDef> = {
  // ---- Free tier (ฟรีถาวร / จำกัดปริมาณ) ----
  gemini:      { label: "Google Gemini (ฟรี 1,500 req/วัน)", base_url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash", type: "openai_compatible", vision: true, hint: "aistudio.google.com/apikey" },
  groq:        { label: "Groq (ฟรี, เร็วมาก)", base_url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", type: "openai_compatible", hint: "console.groq.com/keys" },
  cerebras:    { label: "Cerebras (ฟรี, เร็วสุดใน list)", base_url: "https://api.cerebras.ai/v1/chat/completions", model: "llama-3.3-70b", type: "openai_compatible", hint: "cloud.cerebras.ai" },
  openrouter:  { label: "OpenRouter (โมเดล :free)", base_url: "https://openrouter.ai/api/v1/chat/completions", model: "deepseek/deepseek-chat-v3.1:free", type: "openrouter", hint: "openrouter.ai/keys" },
  glm:         { label: "ZhipuAI GLM-4-Flash (ฟรีถาวร)", base_url: "https://open.bigmodel.cn/api/paas/v4/chat/completions", model: "glm-4-flash", type: "openai_compatible", hint: "bigmodel.cn" },
  huggingface: { label: "HuggingFace Inference", base_url: "https://api-inference.huggingface.co/v1/chat/completions", model: "meta-llama/Llama-3.3-70B-Instruct", type: "openai_compatible", hint: "huggingface.co/settings/tokens" },
  github:      { label: "GitHub Models (ฟรี ใช้ PAT)", base_url: "https://models.inference.ai.azure.com/chat/completions", model: "gpt-4o-mini", type: "openai_compatible", vision: true, hint: "github.com/settings/tokens" },
  sambanova:   { label: "SambaNova", base_url: "https://api.sambanova.ai/v1/chat/completions", model: "Meta-Llama-3.3-70B-Instruct", type: "openai_compatible", hint: "cloud.sambanova.ai" },
  cohere:      { label: "Cohere (trial key)", base_url: "https://api.cohere.ai/compatibility/v1/chat/completions", model: "command-r-plus-08-2024", type: "openai_compatible", hint: "dashboard.cohere.com" },
  // ---- Free credits (สมัครแล้วได้เครดิต) ----
  deepseek:    { label: "DeepSeek (มีเครดิตแรกเข้า)", base_url: "https://api.deepseek.com/v1/chat/completions", model: "deepseek-chat", type: "deepseek", hint: "platform.deepseek.com" },
  mistral:     { label: "Mistral (ฟรี tier)", base_url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", type: "openai_compatible", hint: "console.mistral.ai" },
  together:    { label: "Together AI (เครดิต $5)", base_url: "https://api.together.xyz/v1/chat/completions", model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", type: "openai_compatible", hint: "api.together.xyz" },
  xai:         { label: "xAI Grok (เครดิต $150/เดือน)", base_url: "https://api.x.ai/v1/chat/completions", model: "grok-2-1212", type: "openai_compatible", vision: true, hint: "console.x.ai" },
  fireworks:   { label: "Fireworks", base_url: "https://api.fireworks.ai/inference/v1/chat/completions", model: "accounts/fireworks/models/llama-v3p3-70b-instruct", type: "openai_compatible", hint: "fireworks.ai/api-keys" },
  nvidia:      { label: "NVIDIA NIM (เครดิต 1,000)", base_url: "https://integrate.api.nvidia.com/v1/chat/completions", model: "meta/llama-3.3-70b-instruct", type: "openai_compatible", hint: "build.nvidia.com" },
  dashscope:   { label: "DashScope Qwen", base_url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", model: "qwen-plus", type: "openai_compatible", vision: true, hint: "dashscope.console.aliyun.com" },
  perplexity:  { label: "Perplexity (Sonar)", base_url: "https://api.perplexity.ai/chat/completions", model: "sonar", type: "openai_compatible", hint: "perplexity.ai/settings/api" },
  // ---- Paid ----
  openai:      { label: "OpenAI (เสียเงิน)", base_url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini", type: "openai", vision: true, hint: "platform.openai.com/api-keys" },
  anthropic:   { label: "Anthropic Claude", base_url: "https://api.anthropic.com/v1/messages", model: "claude-3-5-sonnet-20241022", type: "anthropic", vision: true, hint: "console.anthropic.com" },
  custom:      { label: "Custom (OpenAI-compatible)", base_url: "", model: "", type: "openai_compatible" },
};

export default function AIProvidersPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    preset: "gemini",
    name: "",
    api_key: "",
    base_url: PRESETS.gemini.base_url,
    model: PRESETS.gemini.model,
    priority: 50,
    supports_vision: !!PRESETS.gemini.vision,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ai_providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_providers_meta" as any)
        .select("id,name,provider_type,base_url,model,priority,enabled,supports_vision,supports_json,monthly_call_limit,notes,has_key")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data as unknown as Provider[]).map((p: any) => ({ ...p, api_key: p.has_key ? "" : null }));
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

  const totals = (usage || []).reduce(
    (acc, r) => {
      acc.calls += 1;
      acc.success += r.success ? 1 : 0;
      acc.cost += Number(r.estimated_cost || 0);
      acc.tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
      const k = r.provider_name || "unknown";
      acc.byProvider[k] = acc.byProvider[k] || { calls: 0, cost: 0, tokens: 0 };
      acc.byProvider[k].calls += 1;
      acc.byProvider[k].cost += Number(r.estimated_cost || 0);
      acc.byProvider[k].tokens += (r.tokens_input || 0) + (r.tokens_output || 0);
      return acc;
    },
    { calls: 0, success: 0, cost: 0, tokens: 0, byProvider: {} as Record<string, { calls: number; cost: number; tokens: number }> },
  );

  async function saveNew() {
    const preset = PRESETS[form.preset];
    const name = form.name.trim() || preset?.label?.replace(/\s*\(.*\)$/, "") || form.preset;
    const base_url = form.base_url || preset?.base_url;
    const model = form.model || preset?.model;
    if (!base_url || !model) {
      toast.error("กรุณากรอก base URL และ model");
      return;
    }
    if (!form.api_key) {
      toast.error("กรุณาใส่ API Key");
      return;
    }
    const { error } = await supabase.from("ai_providers" as any).insert({
      name,
      provider_type: preset?.type || "openai_compatible",
      base_url,
      api_key: form.api_key,
      model,
      priority: form.priority,
      supports_vision: form.supports_vision,
      enabled: true,
    });
    if (error) return toast.error(error.message);
    toast.success("เพิ่ม Provider แล้ว");
    setShowAdd(false);
    setShowAdvanced(false);
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
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Activity className="h-4 w-4" />Calls (30d)</div>
            <div className="text-2xl font-bold mt-1">{totals.calls.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">สำเร็จ {totals.success}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Zap className="h-4 w-4" />Tokens</div>
            <div className="text-2xl font-bold mt-1">{totals.tokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><Coins className="h-4 w-4" />Cost (est.)</div>
            <div className="text-2xl font-bold mt-1">${totals.cost.toFixed(4)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm"><AlertCircle className="h-4 w-4" />Active</div>
            <div className="text-2xl font-bold mt-1">{providers.filter(p => p.enabled).length}/{providers.length}</div>
          </CardContent>
        </Card>
      </div>

      {showAdd && (() => {
        const preset = PRESETS[form.preset];
        return (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่ม AI Provider ใหม่</CardTitle>
            <CardDescription>เลือก Preset แล้วใส่แค่ API Key — ที่เหลือเติมให้อัตโนมัติ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Preset</Label>
              <Select
                value={form.preset}
                onValueChange={(v) => {
                  const p = PRESETS[v];
                  setForm({ ...form, preset: v, base_url: p.base_url, model: p.model, supports_vision: !!p.vision, name: "" });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">🆓 ฟรี (rate-limited)</div>
                  {["gemini","groq","cerebras","openrouter","glm","huggingface","github","sambanova","cohere"].map(k =>
                    <SelectItem key={k} value={k}>{PRESETS[k].label}</SelectItem>)}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">💳 ฟรีเครดิต</div>
                  {["deepseek","mistral","together","xai","fireworks","nvidia","dashscope","perplexity"].map(k =>
                    <SelectItem key={k} value={k}>{PRESETS[k].label}</SelectItem>)}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">💰 เสียเงิน</div>
                  {["openai","anthropic"].map(k =>
                    <SelectItem key={k} value={k}>{PRESETS[k].label}</SelectItem>)}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-1">⚙️ อื่นๆ</div>
                  <SelectItem value="custom">{PRESETS.custom.label}</SelectItem>
                </SelectContent>
              </Select>
              {preset?.hint && (
                <p className="text-xs text-muted-foreground mt-1">
                  ขอ API Key ได้ที่ <a href={`https://${preset.hint}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{preset.hint}</a>
                </p>
              )}
            </div>

            <div>
              <Label>API Key <span className="text-destructive">*</span></Label>
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                placeholder="วางค่า API Key ที่นี่..."
                autoFocus
              />
            </div>

            {form.preset === "custom" && (
              <>
                <div>
                  <Label>Base URL</Label>
                  <Input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.example.com/v1/chat/completions" />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="model-name" />
                </div>
              </>
            )}

            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline"
              onClick={() => setShowAdvanced((s) => !s)}
            >
              {showAdvanced ? "▲ ซ่อนตัวเลือกขั้นสูง" : "▼ ตัวเลือกขั้นสูง (ชื่อ · Model · Priority · Vision)"}
            </button>

            {showAdvanced && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <Label>ชื่อแสดงผล</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={preset?.label} />
                </div>
                {form.preset !== "custom" && (
                  <div>
                    <Label>Model (override)</Label>
                    <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
                  </div>
                )}
                <div>
                  <Label>Priority (น้อย = ใช้ก่อน)</Label>
                  <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: +e.target.value })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.supports_vision} onCheckedChange={(v) => setForm({ ...form, supports_vision: v })} />
                  <Label>รองรับ Vision/OCR</Label>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={saveNew} className="flex-1"><Plus className="h-4 w-4 mr-1" />เพิ่ม Provider</Button>
              <Button variant="outline" onClick={() => { setShowAdd(false); setShowAdvanced(false); }}>ยกเลิก</Button>
            </div>
          </CardContent>
        </Card>
        );
      })()}



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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
                    <th>Calls</th>
                    <th>Tokens</th>
                    <th>Cost (est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(totals.byProvider as Record<string, { calls: number; cost: number; tokens: number }>)
                    .sort((a, b) => b[1].calls - a[1].calls)
                    .map(([name, v]) => (
                      <tr key={name} className="border-t">
                        <td className="py-2">{name}</td>
                        <td>{v.calls.toLocaleString()}</td>
                        <td>{v.tokens.toLocaleString()}</td>
                        <td>${v.cost.toFixed(4)}</td>
                      </tr>
                    ))}
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
