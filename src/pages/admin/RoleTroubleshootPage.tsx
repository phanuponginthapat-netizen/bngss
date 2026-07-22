import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuthSession } from "@/hooks/useAuthSession";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

const DEFAULT_TABLES = [
  "students", "personnel", "profiles", "user_roles", "classrooms",
  "attendance", "enrollments", "subjects", "schedules", "schools",
  "homework_assignments", "homework_submissions", "exams", "exam_submissions",
  "documents", "eforms", "notifications", "wall_posts", "activities",
  "budget_requests", "assets", "ict_devices", "library_books",
  "cafeteria_menus", "duty_assignments", "clubs", "news_posts",
  "cms_pages", "cms_settings", "school_settings", "district_snapshots",
  "district_feed_outbox", "audit_logs", "error_logs", "ai_usage_logs",
] as const;

type Result = { table: string; ok: boolean; count: number | null; error?: string };

export default function RoleTroubleshootPage() {
  const { role, realRole } = useUserRole();
  const { user } = useAuthSession();
  const [tables, setTables] = useState<string>(DEFAULT_TABLES.join(", "));
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function runTest() {
    setLoading(true);
    setResults([]);
    const list = tables.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    const out: Result[] = [];
    for (const t of list) {
      try {
        const { count, error } = await (supabase as any)
          .from(t)
          .select("*", { count: "exact", head: true });
        if (error) out.push({ table: t, ok: false, count: null, error: error.message });
        else out.push({ table: t, ok: true, count: count ?? 0 });
      } catch (e: any) {
        out.push({ table: t, ok: false, count: null, error: e?.message ?? String(e) });
      }
      setResults([...out]);
    }
    setLoading(false);
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>🔎 ตรวจสอบสิทธิ์การอ่านข้อมูล (Role Troubleshoot)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">User: {user?.email ?? "-"}</Badge>
            <Badge>Active role: {role ?? "-"}</Badge>
            {realRole && realRole !== role && <Badge variant="secondary">Real role: {realRole}</Badge>}
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              รายชื่อตาราง (คั่นด้วย comma หรือ space)
            </label>
            <Input value={tables} onChange={(e) => setTables(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button onClick={runTest} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              เริ่มตรวจสอบ
            </Button>
            {results.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="default" className="bg-emerald-600">✓ อ่านได้ {okCount}</Badge>
                <Badge variant="destructive">✗ อ่านไม่ได้ {failCount}</Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ผลลัพธ์</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">ตาราง</th>
                    <th className="py-2 pr-2">สถานะ</th>
                    <th className="py-2 pr-2">จำนวนแถวที่อ่านได้</th>
                    <th className="py-2 pr-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.table} className="border-b">
                      <td className="py-1.5 pr-2 font-mono">{r.table}</td>
                      <td className="py-1.5 pr-2">
                        {r.ok ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="w-4 h-4" /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4" /> BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">{r.count ?? "-"}</td>
                      <td className="py-1.5 pr-2 text-xs text-muted-foreground">{r.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              * ผลลัพธ์นี้ใช้ session ปัจจุบันของคุณ (RLS จริง) — แถวที่นับได้คือแถวที่ role นี้อ่านได้เท่านั้น
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
