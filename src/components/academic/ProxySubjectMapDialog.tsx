import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjects: any[];
}

export const ProxySubjectMapDialog = ({ open, onOpenChange, subjects }: Props) => {
  const qc = useQueryClient();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [suggested, setSuggested] = useState<Set<string>>(new Set());

  const proxies = useMemo(
    () => subjects.filter((s: any) => typeof s.code === "string" && s.code.startsWith("T-")),
    [subjects]
  );
  const real = useMemo(
    () => subjects.filter((s: any) => !(typeof s.code === "string" && s.code.startsWith("T-"))),
    [subjects]
  );

  useEffect(() => {
    if (!open) return;
    setMapping({});
    setSuggested(new Set());
    (async () => {
      const { data } = await supabase
        .from("schedules")
        .select("subject_id")
        .in("subject_id", proxies.map((p: any) => p.id));
      const c: Record<string, number> = {};
      (data || []).forEach((r: any) => { c[r.subject_id] = (c[r.subject_id] || 0) + 1; });
      setCounts(c);
    })();
  }, [open, proxies]);

  const handleAutoSuggest = async () => {
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-proxy-mapping", {
        body: {
          proxies: proxies.map((p: any) => ({ id: p.id, code: p.code, name_th: p.name_th, grade_level: p.grade_level })),
          real: real.map((r: any) => ({ id: r.id, code: r.code, name_th: r.name_th, grade_level: r.grade_level })),
        },
      });
      if (error) throw error;
      const sugg: Record<string, string | null> = data?.suggestions || {};
      const next = { ...mapping };
      const newSuggested = new Set<string>();
      let count = 0;
      for (const [pid, rid] of Object.entries(sugg)) {
        if (rid) { next[pid] = rid; newSuggested.add(pid); count++; }
      }
      setMapping(next);
      setSuggested(newSuggested);
      toast.success(`แนะนำการจับคู่ ${count} รายการ — กรุณาตรวจสอบก่อนบันทึก`);
    } catch (e: any) {
      toast.error(e.message || "แนะนำอัตโนมัติไม่สำเร็จ");
    } finally {
      setSuggesting(false);
    }
  };

  const handleSave = async () => {
    const entries = Object.entries(mapping).filter(([, v]) => v);
    if (entries.length === 0) {
      toast.error("กรุณาเลือกวิชาหลักสูตรอย่างน้อย 1 รายการ");
      return;
    }
    const __tid_save_1 = toast.loading("กำลังบันทึก...");
    setSaving(true);
    try {
      for (const [proxyId, realId] of entries) {
        // 1) update all schedules pointing at proxy -> real
        const { error: e1 } = await supabase
          .from("schedules")
          .update({ subject_id: realId })
          .eq("subject_id", proxyId);
        if (e1) throw e1;
        // 2) delete proxy subject
        const { error: e2 } = await supabase.from("subjects").delete().eq("id", proxyId);
        if (e2) throw e2;
      }
      toast.success(`เชื่อมโยง ${entries.length} วิชาเข้ากับหลักสูตรสำเร็จ`);
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["schedules"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "บันทึกไม่สำเร็จ");
    } finally {
      toast.dismiss(__tid_save_1);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เชื่อมโยงวิชา proxy เข้ากับหลักสูตร</DialogTitle>
        </DialogHeader>
        {proxies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            ไม่มีวิชา proxy ที่ต้องเชื่อมโยง
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground flex-1 min-w-[240px]">
                เลือกวิชาในหลักสูตรที่ตรงกับวิชา proxy แต่ละรายการ ระบบจะย้ายตารางสอนทั้งหมดไปยังวิชาหลักสูตร และลบวิชา proxy ออกอัตโนมัติ
              </p>
              <Button variant="secondary" onClick={handleAutoSuggest} disabled={suggesting || saving}>
                {suggesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                แนะนำอัตโนมัติ
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วิชา Proxy</TableHead>
                  <TableHead className="w-24 text-center">คาบใช้งาน</TableHead>
                  <TableHead>ระดับ</TableHead>
                  <TableHead className="w-[280px]">เลือกวิชาในหลักสูตร</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((p: any) => {
                  const grade = p.grade_level;
                  const options = real.filter(
                    (r: any) => !grade || !r.grade_level || r.grade_level === grade
                  );
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium text-sm">{p.name_th}</div>
                        <div className="font-mono text-xs text-muted-foreground">{p.code}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{counts[p.id] || 0}</Badge>
                      </TableCell>
                      <TableCell>{grade || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={mapping[p.id] || ""}
                            onValueChange={(v) => {
                              setMapping({ ...mapping, [p.id]: v });
                              if (suggested.has(p.id)) {
                                const ns = new Set(suggested); ns.delete(p.id); setSuggested(ns);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="-- เลือกวิชา --" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                              {options.map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>
                                  {r.code} · {r.name_th}{r.grade_level ? ` (${r.grade_level})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {suggested.has(p.id) && (
                            <Badge variant="outline" className="text-xs whitespace-nowrap">
                              <Sparkles className="w-3 h-3 mr-1" /> แนะนำ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                ยกเลิก
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                บันทึกการเชื่อมโยง
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
