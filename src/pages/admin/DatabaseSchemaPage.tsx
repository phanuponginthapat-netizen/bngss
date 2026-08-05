import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Database, Download, Copy, ExternalLink, BookOpen, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getBackendConfig } from "@/lib/runtimeConfig";


type Column = { name: string; type: string; nullable: string; default: string | null };
type Row = { table_name: string; columns: Column[]; col_count: number };

// อ่านจาก runtime config เสมอ เพื่อให้ถูกต้องหลังย้าย backend / deploy ที่อื่น (Vercel ฯลฯ)
const RUNTIME = getBackendConfig();
const PROJECT_URL = RUNTIME.url;
const ANON_KEY = RUNTIME.anonKey;


function copy(text: string, label = "คัดลอกแล้ว") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

export default function DatabaseSchemaPage() {
  const [q, setQ] = useState("");

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["db-schema"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_db_schema" as any);
      if (error) throw error;
      return (data as Row[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const kw = q.trim().toLowerCase();
    if (!kw) return data;
    return data.filter(
      (r) =>
        r.table_name.toLowerCase().includes(kw) ||
        r.columns.some((c) => c.name.toLowerCase().includes(kw)),
    );
  }, [data, q]);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bngss-schema-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Database className="w-7 h-7 text-primary" />
            คู่มือ & โครงสร้างฐานข้อมูล
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            สำหรับเรียกใช้งานข้อมูลจากภายนอกระบบ (REST / Realtime / Storage / Edge Functions)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            รีเฟรช
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson} disabled={!data?.length}>
            <Download className="w-4 h-4 mr-1" /> Export JSON
          </Button>
        </div>
      </div>

      <Tabs defaultValue="guide" className="w-full">
        <TabsList>
          <TabsTrigger value="guide"><BookOpen className="w-4 h-4 mr-1" />คู่มือ</TabsTrigger>
          <TabsTrigger value="schema"><Database className="w-4 h-4 mr-1" />ตารางทั้งหมด ({data?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">🔑 ค่าเชื่อมต่อ (Credentials)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "SUPABASE_URL", value: PROJECT_URL },
                { label: "SUPABASE_ANON_KEY", value: ANON_KEY },
                { label: "PROJECT_ID", value: RUNTIME.projectId || "" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0 min-w-[170px] justify-start">{row.label}</Badge>
                  <code className="flex-1 text-xs bg-muted px-2 py-1 rounded truncate">{row.value}</code>
                  <Button size="sm" variant="ghost" onClick={() => copy(row.value)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                anon key เป็น publishable ปลอดภัยที่จะฝัง client. RLS จะจำกัดสิทธิ์ตาม role อีกชั้น
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">🌐 REST Endpoint (PostgREST)</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`curl "${PROJECT_URL}/rest/v1/students?select=id,first_name,last_name&limit=10" \\
  -H "apikey: <ANON_KEY>" \\
  -H "Authorization: Bearer <USER_JWT>"`}
              </pre>
              <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {[
                  ["?grade=eq.6", "เท่ากับ"],
                  ["?score=gte.50", "มากกว่าเท่ากับ"],
                  ["?name=ilike.*สม*", "ค้นหา"],
                  ["?order=created_at.desc", "เรียงลำดับ"],
                  ["?limit=100&offset=200", "แบ่งหน้า"],
                  ["?select=id,teacher(*)", "join"],
                ].map(([op, desc]) => (
                  <div key={op} className="bg-muted/50 p-2 rounded">
                    <code className="text-primary">{op}</code>
                    <div className="text-muted-foreground">{desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">🔐 Authentication</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`curl -X POST "${PROJECT_URL}/auth/v1/token?grant_type=password" \\
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \\
  -d '{"email":"admin@school.com","password":"********"}'`}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                นำ <code>access_token</code> ที่ได้ ไปวางใน header <code>Authorization: Bearer ...</code>
              </p>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-lg">⚡ Realtime</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`supabase.channel('wall')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'wall_posts' },
    (p) => console.log(p))
  .subscribe()`}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg">📦 Storage</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`${PROJECT_URL}/storage/v1/object/public/<bucket>/<path>

buckets: profile-images, cms-images,
wall-media, padlet-media, documents ...`}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                🧰 Edge Functions
                <Button asChild variant="ghost" size="sm">
                  <a href="/docs/DATABASE-API-GUIDE.md" target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4 mr-1" /> คู่มือฉบับเต็ม
                  </a>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <div><code>system-backup</code> — export ข้อมูลทั้งระบบ</div>
              <div><code>system-restore</code> — นำเข้า backup</div>
              <div><code>upload-cms-image</code> — อัปโหลดไฟล์</div>
              <div><code>attendance-digest</code> — สร้างรายงานสแกน QuickChart</div>
              <div><code>district-outbox-worker</code> — feed ไปเขตพื้นที่</div>
              <div className="text-xs text-muted-foreground mt-2">
                Endpoint: <code>{PROJECT_URL}/functions/v1/&lt;name&gt;</code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema" className="space-y-4 mt-4">
          <Input
            placeholder="ค้นหาตารางหรือคอลัมน์..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-md"
          />

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> กำลังโหลด schema...
            </div>
          ) : (
            <Card>
              <CardContent className="p-2 md:p-4">
                <div className="text-xs text-muted-foreground mb-2">
                  พบ {filtered.length} ตาราง (จากทั้งหมด {data?.length ?? 0})
                </div>
                <Accordion type="multiple" className="w-full">
                  {filtered.map((t) => (
                    <AccordionItem key={t.table_name} value={t.table_name}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 flex-1">
                          <code className="font-mono text-sm">{t.table_name}</code>
                          <Badge variant="secondary">{t.col_count} คอลัมน์</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() =>
                            copy(`${PROJECT_URL}/rest/v1/${t.table_name}?select=*`, "คัดลอก URL แล้ว")
                          }>
                            <Copy className="w-3 h-3 mr-1" /> REST URL
                          </Button>
                          <Button size="sm" variant="outline" onClick={() =>
                            copy(`select ${t.columns.map(c => c.name).join(", ")}\nfrom public.${t.table_name};`, "คัดลอก SQL แล้ว")
                          }>
                            <Copy className="w-3 h-3 mr-1" /> SQL
                          </Button>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-muted/50 text-left">
                                <th className="px-2 py-1 font-medium">คอลัมน์</th>
                                <th className="px-2 py-1 font-medium">ประเภท</th>
                                <th className="px-2 py-1 font-medium">Null</th>
                                <th className="px-2 py-1 font-medium">ค่าเริ่มต้น</th>
                              </tr>
                            </thead>
                            <tbody>
                              {t.columns.map((c) => (
                                <tr key={c.name} className="border-b border-border/50">
                                  <td className="px-2 py-1 font-mono text-xs">{c.name}</td>
                                  <td className="px-2 py-1 text-xs text-primary">{c.type}</td>
                                  <td className="px-2 py-1 text-xs">{c.nullable === "YES" ? "✓" : "—"}</td>
                                  <td className="px-2 py-1 text-xs text-muted-foreground truncate max-w-[200px]">
                                    {c.default ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
