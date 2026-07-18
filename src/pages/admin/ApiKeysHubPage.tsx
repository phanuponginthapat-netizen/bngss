import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Sparkles, Layers, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Reuse the existing pages as tab panels — no duplicated logic.
const SecretsManagementPage = lazy(() => import("./SecretsManagementPage"));
const AIProvidersPage = lazy(() => import("./AIProvidersPage"));
const AIKeyPoolPage = lazy(() => import("./AIKeyPoolPage"));

const TAB_INFO = {
  secrets: {
    icon: KeyRound,
    th: {
      title: "API Keys & Secrets",
      desc: "เก็บคีย์ลับและตัวแปรเชื่อมต่อภายนอก (เช่น GEMINI_API_KEY, LINE_CHANNEL_ACCESS_TOKEN). ใช้ภายในระบบ — ไม่เปิดเผยให้ผู้ใช้",
      hint:
        "เคล็ดลับ: กดไอคอน ⓘ ข้างชื่อคีย์ที่รู้จัก จะมีคำแนะนำพร้อมลิงก์ไปขอ key. ค่าจะเข้ารหัสบนเซิร์ฟเวอร์เสมอ",
    },
    en: {
      title: "Secrets",
      desc: "Store private keys & tokens used by the backend (e.g. GEMINI_API_KEY, LINE_CHANNEL_ACCESS_TOKEN). Never exposed to users.",
      hint:
        "Tip: click ⓘ next to known keys for step-by-step instructions. Values are always encrypted server-side.",
    },
  },
  providers: {
    icon: Sparkles,
    th: {
      title: "ผู้ให้บริการ AI",
      desc: "กำหนด AI Provider ที่ใช้สำหรับงาน Chat/OCR/สรุปเนื้อหา พร้อมลำดับความสำคัญ (priority น้อย = ใช้ก่อน) และเก็บ usage/cost",
      hint:
        "Base URL คือ endpoint ของผู้ให้บริการ (เช่น https://api.openai.com/v1/chat/completions) — เลือก Preset แล้วระบบจะกรอกให้",
    },
    en: {
      title: "AI Providers",
      desc: "Configure AI providers used for chat/OCR/summarisation with priority (lower = used first) and live usage/cost tracking.",
      hint:
        "Base URL is the provider's chat endpoint. Pick a Preset and it'll be filled in for you.",
    },
  },
  pool: {
    icon: Layers,
    th: {
      title: "คลัง API Key (Pool)",
      desc: "ใส่ API Key หลายตัวต่อหนึ่งผู้ให้บริการเพื่อกระจายโหลด/เพิ่มโควต้าฟรี ระบบจะหมุนเวียนเลือก key ที่ใช้น้อยที่สุดอัตโนมัติ",
      hint:
        "ถ้า key โดน 429/402/403 ระบบจะพัก 1 ชม. แล้วลอง key ถัดไปให้เอง — ใส่ได้สูงสุด 20 keys ต่อ provider",
    },
    en: {
      title: "Key Pool",
      desc: "Add multiple API keys per provider to round-robin requests and stretch free quotas — the system picks the least-used key automatically.",
      hint:
        "On 429/402/403 the key cools down for 1 hour and traffic moves to the next key. Max 20 keys per provider.",
    },
  },
} as const;

type TabKey = keyof typeof TAB_INFO;

export default function ApiKeysHubPage() {
  const { lang } = useLanguage();
  const [params, setParams] = useSearchParams();
  const initial = (params.get("tab") as TabKey) || "secrets";
  const active: TabKey = initial in TAB_INFO ? initial : "secrets";

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  const t = (k: TabKey) => TAB_INFO[k][lang === "th" ? "th" : "en"];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <KeyRound className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {lang === "th" ? "ศูนย์รวม API & Secrets" : "API Keys & Secrets Hub"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === "th"
              ? "หน้าเดียวจบ — Secrets, ผู้ให้บริการ AI, และคลัง API Key (Pool)"
              : "One place for secrets, AI providers, and the rotating key pool"}
          </p>
        </div>
      </div>

      <Tabs value={active} onValueChange={setTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          {(Object.keys(TAB_INFO) as TabKey[]).map((k) => {
            const Icon = TAB_INFO[k].icon;
            return (
              <TabsTrigger key={k} value={k} className="gap-1.5">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{t(k).title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(TAB_INFO) as TabKey[]).map((k) => {
          const PanelIcon = TAB_INFO[k].icon;
          return (
          <TabsContent key={k} value={k} className="mt-4 space-y-3">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-1">
                <div className="font-semibold text-primary flex items-center gap-2">
                  <PanelIcon className="h-4 w-4" />
                  {t(k).title}
                </div>
                <div className="text-sm text-foreground/80">{t(k).desc}</div>
                <div className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{t(k).hint}</span>
                </div>
              </CardContent>
            </Card>

            <Suspense
              fallback={
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {lang === "th" ? "กำลังโหลด..." : "Loading..."}
                </div>
              }
            >
              {k === "secrets" && <SecretsManagementPage />}
              {k === "providers" && <AIProvidersPage />}
              {k === "pool" && <AIKeyPoolPage />}
            </Suspense>
          </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
