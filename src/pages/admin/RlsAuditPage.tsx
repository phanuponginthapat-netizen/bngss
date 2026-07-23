import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, RefreshCw } from "lucide-react";

type Row = {
  table_name: string;
  rls_enabled: boolean;
  policy_count: number;
  has_select: boolean;
  has_insert: boolean;
  has_update: boolean;
  has_delete: boolean;
  policies: Array<{ name: string; cmd: string; roles: string[]; permissive: string }>;
};

type Filter = "all" | "incomplete" | "no_policy" | "no_rls" | "complete";

function Cell({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>
  ) : (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">✗</span>
  );
}

export default function RlsAuditPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("incomplete");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["rls-policy-audit"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("rls_policy_audit");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 60_000,
  });

  const rows = data ?? [];
  const summary = useMemo(() => {
    const total = rows.length;
    const noRls = rows.filter((r) => !r.rls_enabled).length;
    const noPolicy = rows.filter((r) => r.rls_enabled && r.policy_count === 0).length;
    const incomplete = rows.filter(
      (r) => r.rls_enabled && r.policy_count > 0 && !(r.has_select && r.has_insert && r.has_update && r.has_delete),
    ).length;
    const complete = rows.filter(
      (r) => r.rls_enabled && r.has_select && r.has_insert && r.has_update && r.has_delete,
    ).length;
    return { total, noRls, noPolicy, incomplete, complete };
  }, [rows]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (ql && !r.table_name.toLowerCase().includes(ql)) return false;
      const isComplete = r.rls_enabled && r.has_select && r.has_insert && r.has_update && r.has_delete;
      const isIncomplete = r.rls_enabled && r.policy_count > 0 && !isComplete;
      switch (filter) {
        case "no_rls": return !r.rls_enabled;
        case "no_policy": return r.rls_enabled && r.policy_count === 0;
        case "incomplete": return isIncomplete || (r.rls_enabled && r.policy_count === 0);
        case "complete": return isComplete;
        default: return true;
      }
    });
  }, [rows, q, filter]);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> ตรวจสอบสถานะ RLS ของทุกตาราง
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              ดูว่าตารางไหนมีนโยบายอ่าน/เพิ่ม/แก้/ลบครบหรือยัง — เฉพาะแอดมินเท่านั้น
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Stat label="ตารางทั้งหมด" value={summary.total} tone="default" />
            <Stat label="ครบทุก op" value={summary.complete} tone="ok" />
            <Stat label="ไม่ครบ" value={summary.incomplete} tone="warn" />
            <Stat label="ไม่มี policy" value={summary.noPolicy} tone="bad" />
            <Stat label="RLS ปิด" value={summary.noRls} tone="bad" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="ค้นหาชื่อตาราง…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="incomplete">ต้องดู</TabsTrigger>
                <TabsTrigger value="no_policy">ไม่มี policy</TabsTrigger>
                <TabsTrigger value="no_rls">RLS ปิด</TabsTrigger>
                <TabsTrigger value="complete">ครบ</TabsTrigger>
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {error && (
            <div className="text-sm text-red-600 flex items-center gap-2">
              <ShieldX className="w-4 h-4" /> {(error as any).message}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลด…
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="py-2 px-3">ตาราง</th>
                    <th className="py-2 px-2 text-center">RLS</th>
                    <th className="py-2 px-2 text-center">Policies</th>
                    <th className="py-2 px-2 text-center">อ่าน</th>
                    <th className="py-2 px-2 text-center">เพิ่ม</th>
                    <th className="py-2 px-2 text-center">แก้</th>
                    <th className="py-2 px-2 text-center">ลบ</th>
                    <th className="py-2 px-2">สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const complete = r.rls_enabled && r.has_select && r.has_insert && r.has_update && r.has_delete;
                    const noPolicy = r.rls_enabled && r.policy_count === 0;
                    const isExpanded = expanded === r.table_name;
                    return (
                      <>
                        <tr
                          key={r.table_name}
                          className="border-t hover:bg-muted/30 cursor-pointer"
                          onClick={() => setExpanded(isExpanded ? null : r.table_name)}
                        >
                          <td className="py-1.5 px-3 font-mono text-xs">{r.table_name}</td>
                          <td className="py-1.5 px-2 text-center">
                            {r.rls_enabled ? (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">ON</Badge>
                            ) : (
                              <Badge variant="destructive">OFF</Badge>
                            )}
                          </td>
                          <td className="py-1.5 px-2 text-center font-mono">{r.policy_count}</td>
                          <td className="py-1.5 px-2 text-center"><Cell ok={r.has_select} /></td>
                          <td className="py-1.5 px-2 text-center"><Cell ok={r.has_insert} /></td>
                          <td className="py-1.5 px-2 text-center"><Cell ok={r.has_update} /></td>
                          <td className="py-1.5 px-2 text-center"><Cell ok={r.has_delete} /></td>
                          <td className="py-1.5 px-2">
                            {!r.rls_enabled ? (
                              <span className="inline-flex items-center gap-1 text-red-600 text-xs"><ShieldX className="w-3.5 h-3.5" /> RLS ปิด</span>
                            ) : noPolicy ? (
                              <span className="inline-flex items-center gap-1 text-red-600 text-xs"><ShieldX className="w-3.5 h-3.5" /> ไม่มี policy</span>
                            ) : complete ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><ShieldCheck className="w-3.5 h-3.5" /> ครบ</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 text-xs"><ShieldAlert className="w-3.5 h-3.5" /> ไม่ครบ</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && r.policies.length > 0 && (
                          <tr className="bg-muted/20">
                            <td colSpan={8} className="px-3 py-2">
                              <div className="space-y-1">
                                {r.policies.map((p, i) => (
                                  <div key={i} className="text-xs flex flex-wrap gap-2 items-center">
                                    <Badge variant="secondary">{p.cmd}</Badge>
                                    <span className="font-mono">{p.name}</span>
                                    <span className="text-muted-foreground">→ {p.roles?.join(", ") || "public"}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">ไม่มีตารางตรงเงื่อนไข</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            * "ครบ" = มี policy ครอบคลุมทั้ง 4 การกระทำ (SELECT/INSERT/UPDATE/DELETE) — ตารางที่เขียนโดย edge function
            เท่านั้นอาจไม่จำเป็นต้องมี INSERT/UPDATE policy
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "ok" | "warn" | "bad" }) {
  const cls =
    tone === "ok" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    tone === "warn" ? "bg-amber-50 text-amber-700 border-amber-200" :
    tone === "bad" ? "bg-red-50 text-red-700 border-red-200" :
    "bg-muted text-foreground border-border";
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
