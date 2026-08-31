import { useState, useRef, ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, X, Sparkles, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parsePP5Workbook, type PP5ParsedWorkbook } from "@/lib/pp5AutoParser";
import { checkAcademicYear, matchStudents, provisionAlumni, type YearCheck } from "@/lib/ppImportChecks";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { sanitizeStorageKey } from "@/lib/uploadFallback";
import { toCE } from "@/lib/utils";


export interface AutoImportResolvedTarget {
  gradeLevel: string;
  year: number;
  semester: number;
  /** columns to match dedup on (subject_name for PP5, classroom_name for PP6) */
  dedupWhere: Record<string, any>;
  /** insert payload (excluding common fields like file_name/url/path/uploaded_by/parsed_data) */
  insertExtra: Record<string, any>;
  /** merged into parsed_data */
  parsedExtra: Record<string, any>;
  /** cache-buster storage folder key (grade-based) */
  storageFolder?: string;
}

export interface AutoImportItem<T = any> {
  file: File;
  parsed?: PP5ParsedWorkbook;
  status: "pending" | "parsing" | "ready" | "uploading" | "done" | "error";
  error?: string;
  duplicateOf?: string;
  confirmedDuplicate?: boolean;
  yearCheck?: YearCheck;
  yearOverride?: number;
  semesterOverride?: number;
  missingStudents?: { studentCode: string; studentName: string }[];
  matchedStudents?: number;
  createAlumni?: boolean;
  alumniCreated?: number;
  meta: T; // per-mode extra state (assignmentId / classroomId etc.)
}

interface Props<T> {
  triggerLabel: string;
  dialogTitle: string;
  dropHint: string;
  tableName: "pp5_files" | "pp6_files";
  bucket: "pp5-files" | "pp6-files";
  initialMeta: T;
  /** Called after parsing → return any per-file meta (e.g. auto-matched assignment). */
  onParsed: (parsed: PP5ParsedWorkbook, meta: T) => T;
  /** Resolve target insert/dedup fields from item; return null to block with reason. */
  resolveTarget: (item: AutoImportItem<T>) => AutoImportResolvedTarget | { error: string };
  /** Render the meta / picker UI shown after parsing. */
  renderMeta: (item: AutoImportItem<T>, update: (patch: Partial<AutoImportItem<T>>) => void) => ReactNode;
  /** Render the preview table body (rows for c in parsed.consolidated). */
  renderPreviewTable: (parsed: PP5ParsedWorkbook) => ReactNode;
  onImportSuccess?: () => void;
}

export function AutoImportDialogBase<T>({
  triggerLabel, dialogTitle, dropHint, tableName, bucket, initialMeta,
  onParsed, resolveTarget, renderMeta, renderPreviewTable, onImportSuccess,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AutoImportItem<T>[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const keyOf = (f: File) => f.name + f.size;
  const updateItem = (file: File, patch: Partial<AutoImportItem<T>>) =>
    setItems((prev) => prev.map((x) => (x.file === file ? { ...x, ...patch } : x)));

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter((f) => /\.(xlsx|xlsm|xls)$/i.test(f.name));
    if (list.length === 0) return toast.error("รองรับเฉพาะไฟล์ .xlsx / .xlsm / .xls");
    setItems((prev) => [...prev, ...list.map((f) => ({ file: f, status: "parsing" as const, meta: initialMeta }))]);
    for (const file of list) {
      try {
        const parsed = await parsePP5Workbook(file);
        const nextMeta = onParsed(parsed, initialMeta);
        updateItem(file, {
          parsed,
          status: parsed.sheets.length > 0 ? "ready" : "error",
          error: parsed.sheets.length === 0 ? "ไม่พบตารางนักเรียนในไฟล์นี้" : undefined,
          meta: nextMeta,
        });
        if (parsed.sheets.length > 0) {
          const yearCheck = await checkAcademicYear(parsed.meta.academicYear || 0, parsed.meta.semester);
          const match = await matchStudents(parsed.consolidated);
          updateItem(file, {
            yearCheck,
            matchedStudents: match.matched,
            missingStudents: match.missing,
            createAlumni: match.missing.length > 0,
          });
        }
      } catch (e: any) {
        updateItem(file, { status: "error", error: e?.message || "อ่านไฟล์ไม่สำเร็จ" });
      }
    }
  };

  const importAll = async () => {
    const ready = items.filter((it) => it.status === "ready" && it.parsed);
    if (ready.length === 0) return toast.error("ไม่มีไฟล์พร้อมนำเข้า");
    setBusy(true);
    let okCount = 0;
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData?.user?.id;


    for (const it of ready) {
      updateItem(it.file, { status: "uploading" });
      try {
        const target = resolveTarget(it);
        if ("error" in target) throw new Error(target.error);
        const { gradeLevel, dedupWhere, insertExtra, parsedExtra, storageFolder } = target;
        const year = it.yearOverride || target.year;
        const semester = it.semesterOverride || target.semester;

        // นักเรียนที่ไม่มีในระบบ = ศิษย์เก่า → บรรจุก่อนนำเข้าคะแนน
        let alumniCreated = 0;
        if (it.createAlumni && it.missingStudents?.length) {
          const res = await provisionAlumni(it.missingStudents, { gradeLevel, academicYear: year });
          alumniCreated = res.created;
        }

        // Dedup check
        let dupQuery = (supabase.from(tableName) as any)
          .select("id, file_name, file_path")
          .eq("grade_level", gradeLevel).eq("semester", semester).eq("academic_year", toCE(year));
        for (const [k, v] of Object.entries(dedupWhere)) dupQuery = dupQuery.eq(k, v);
        const { data: dupe } = await dupQuery.maybeSingle();

        if (dupe && !it.confirmedDuplicate) {
          updateItem(it.file, {
            status: "error",
            error: `พบไฟล์ซ้ำ: ${(dupe as any).file_name} — กด "อัปโหลดทับ" เพื่อแทนที่`,
            duplicateOf: (dupe as any).id,
          });
          continue;
        }
        if (dupe && it.confirmedDuplicate) {
          if ((dupe as any).file_path) await supabase.storage.from(bucket).remove([(dupe as any).file_path]);
          await (supabase.from(tableName) as any).delete().eq("id", (dupe as any).id);
        }

        // Supabase Storage รับเฉพาะ key แบบ ASCII — ชื่อไฟล์/ระดับชั้นภาษาไทยทำให้ "Invalid key"
        // (ชื่อไฟล์จริงยังถูกเก็บในคอลัมน์ file_name)
        const ext = (it.file.name.match(/\.([A-Za-z0-9]{1,8})$/)?.[1] || "xlsx").toLowerCase();
        const uniq = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const rawKey = `${year}/${storageFolder || gradeLevel}/${uniq}_${it.file.name.replace(/\.[A-Za-z0-9]{1,8}$/, "")}`;
        const path = `${sanitizeStorageKey(rawKey)}.${ext}`;


        const { error: upErr } = await supabase.storage.from(bucket).upload(path, it.file, {
          contentType: it.file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

        const meta = it.parsed!.meta;
        const parsedForDb = {
          meta: { ...meta, gradeLevel },
          ...parsedExtra,
          sheets: it.parsed!.sheets.map((s) => ({
            sheetName: s.sheetName, kind: s.kind, subjects: s.subjects, studentCount: s.students.length,
          })),
          consolidated: it.parsed!.consolidated,
          parsedAt: new Date().toISOString(),
        };

        // เก็บ FK ลงคอลัมน์จริงด้วย (ไม่ใช่แค่ใน parsed_data) เพื่อให้โมดูลอื่นดึงต่อได้
        const fkCols: Record<string, any> = {};
        if ((parsedExtra as any).subject_id) fkCols.subject_id = (parsedExtra as any).subject_id;
        if ((parsedExtra as any).classroom_id) fkCols.classroom_id = (parsedExtra as any).classroom_id;
        if ((parsedExtra as any).personnel_id) fkCols.personnel_id = (parsedExtra as any).personnel_id;

        const { error: insErr } = await (supabase.from(tableName) as any).insert({
          file_name: it.file.name,
          file_url: pub.publicUrl,
          file_path: path,
          grade_level: gradeLevel,
          semester,
          academic_year: year,
          teacher_name: meta.teacherName || null,
          uploaded_by: uid || null,
          parsed_data: parsedForDb as any,
          parse_status: "parsed",
          ...fkCols,
          ...insertExtra,
        });
        if (insErr) throw insErr;

        okCount += 1;
        updateItem(it.file, { status: "done", alumniCreated, error: undefined });
      } catch (e: any) {
        updateItem(it.file, { status: "error", error: e?.message || "นำเข้าไม่สำเร็จ" });
      }
    }
    setBusy(false);
    if (okCount > 0) {
      toast.success(`นำเข้าสำเร็จ ${okCount} ไฟล์ — กดปุ่ม 'ประกาศ' ในหน้าไฟล์เพื่อแจ้งนักเรียน`);
      onImportSuccess?.();
    } else {
      toast.error("นำเข้าไม่สำเร็จ — ตรวจข้อความผิดพลาดในแต่ละไฟล์");
    }

  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Sparkles className="w-4 h-4" />{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="w-[96vw] max-w-[96vw] xl:max-w-[1280px] h-[92vh] max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />{dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 space-y-3">
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/40 cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="font-medium">ลากไฟล์ .xlsx มาวางที่นี่ หรือ คลิกเพื่อเลือก</p>
            <p className="text-xs text-muted-foreground mt-1">{dropHint}</p>
            <input ref={inputRef} type="file" multiple accept=".xlsx,.xlsm,.xls" className="hidden"
              onChange={(e) => handleFiles(e.target.files)} />
          </div>

          {items.length > 0 && (
            <ScrollArea className="flex-1 min-h-0 pr-3">
              <div className="space-y-2">
                {items.map((it) => {
                  const k = keyOf(it.file);
                  const preview = !!showPreview[k];
                  return (
                    <Card key={k}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-primary shrink-0" />
                          <span className="font-medium text-sm truncate flex-1">{it.file.name}</span>
                          {it.status === "parsing" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                          {it.status === "ready" && <Badge variant="secondary">พร้อมนำเข้า</Badge>}
                          {it.status === "uploading" && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                          {it.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                          {it.status === "error" && <Badge variant="destructive">ผิดพลาด</Badge>}
                          <Button size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((x) => x.file !== it.file))}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        {it.error && (
                          <div className="space-y-1">
                            <p className="text-xs text-destructive">{it.error}</p>
                            <div className="flex flex-wrap gap-2">
                              {it.duplicateOf && !it.confirmedDuplicate && (
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => updateItem(it.file, { status: "ready", error: undefined, confirmedDuplicate: true })}>
                                  อัปโหลดทับ (ไฟล์เก่าจะถูกลบ)
                                </Button>
                              )}
                              {it.parsed && !it.duplicateOf && (
                                <Button size="sm" variant="outline" className="h-7 text-xs"
                                  onClick={() => updateItem(it.file, { status: "ready", error: undefined })}>
                                  ลองนำเข้าใหม่
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {it.parsed && (
                          <div className="text-xs space-y-2">
                            <div className="grid gap-3 lg:grid-cols-2 items-start">
                              {/* คอลัมน์ซ้าย: ข้อมูลไฟล์ + การตั้งค่า */}
                              <div className="space-y-2 min-w-0">
                                {renderMeta(it, (patch) => updateItem(it.file, patch))}

                                {/* ปีการศึกษา: ย้อนหลัง / ปัจจุบัน / ล่วงหน้า + แก้ไขได้ */}
                                <div className="rounded-md border bg-muted/40 p-2 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-medium text-muted-foreground">ปีการศึกษาของไฟล์</span>
                                    {it.yearCheck && (
                                      <Badge
                                        variant={it.yearCheck.status === "current" ? "secondary" : it.yearCheck.status === "past" ? "outline" : "destructive"}
                                        className="text-[10px]"
                                      >
                                        {it.yearCheck.status === "past" ? "ย้อนหลัง" : it.yearCheck.status === "future" ? "ล่วงหน้า" : "ปัจจุบัน"} · {it.yearCheck.label}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      className="h-8 w-28 text-xs"
                                      placeholder="ปี พ.ศ."
                                      value={it.yearOverride ?? it.parsed.meta.academicYear ?? ""}
                                      onChange={async (e) => {
                                        const y = Number(e.target.value) || undefined;
                                        updateItem(it.file, { yearOverride: y });
                                        if (y) updateItem(it.file, { yearCheck: await checkAcademicYear(y, it.semesterOverride ?? it.parsed?.meta.semester) });
                                      }}
                                    />
                                    <Input
                                      type="number"
                                      min={1}
                                      max={2}
                                      className="h-8 w-20 text-xs"
                                      placeholder="ภาค"
                                      value={it.semesterOverride ?? it.parsed.meta.semester ?? ""}
                                      onChange={(e) => updateItem(it.file, { semesterOverride: Number(e.target.value) || undefined })}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-1 pt-1">
                                  {it.parsed.sheets.map((s) => (
                                    <Badge key={s.sheetName} variant="outline" className="text-[10px]">
                                      {s.sheetName} · {s.students.length} คน · {s.kind}
                                    </Badge>
                                  ))}
                                </div>
                              </div>

                              {/* คอลัมน์ขวา: ตรวจสอบข้อมูลก่อนนำเข้า */}
                              <div className="rounded-md border bg-background p-2 space-y-2 min-w-0">
                                <p className="text-[11px] font-semibold">ตรวจสอบข้อมูลก่อนนำเข้า</p>
                                <ValidationList item={it} resolveTarget={resolveTarget} />

                                {/* ตรวจรายชื่อกับระบบ → ศิษย์เก่า */}
                                {it.missingStudents !== undefined && it.missingStudents.length > 0 && (
                                  <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <Checkbox
                                        checked={!!it.createAlumni}
                                        onCheckedChange={(v) => updateItem(it.file, { createAlumni: !!v })}
                                      />
                                      <span className="text-[11px]">
                                        บรรจุผู้ที่ไม่พบเป็น "ศิษย์เก่า" อัตโนมัติ ({it.missingStudents.length} คน)
                                      </span>
                                    </label>
                                    <p className="text-[10px] text-muted-foreground break-words">
                                      {it.missingStudents.slice(0, 6).map((m) => `${m.studentCode} ${m.studentName}`).join(", ")}
                                      {it.missingStudents.length > 6 ? " …" : ""}
                                    </p>
                                  </div>
                                )}
                                {typeof it.alumniCreated === "number" && it.alumniCreated > 0 && (
                                  <p className="text-[10px] text-green-600">บรรจุศิษย์เก่าแล้ว {it.alumniCreated} คน</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <p className="text-muted-foreground">รวม {it.parsed.consolidated.length} นักเรียน</p>
                              <Button size="sm" variant="ghost" className="h-6 text-[11px]"
                                onClick={() => setShowPreview((s) => ({ ...s, [k]: !s[k] }))}>
                                {preview ? "ซ่อน" : "ดูตารางคะแนน"}
                              </Button>
                            </div>
                            {preview && (
                              <div className="border rounded-md max-h-64 overflow-auto">
                                {renderPreviewTable(it.parsed)}
                              </div>
                            )}
                          </div>
                        )}

                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>ปิด</Button>
          <Button onClick={importAll} disabled={busy || !items.some((it) => it.status === "ready")}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            นำเข้าไฟล์ที่พร้อม ({items.filter((it) => it.status === "ready").length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MetaField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (<div><span className="text-muted-foreground">{label}: </span><span className="font-medium">{value}</span></div>);
}

function CheckRow({ ok, warn, text }: { ok: boolean; warn?: boolean; text: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-[1px]" />
      ) : warn ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-[1px]" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-[1px]" />
      )}
      <span className={`text-[11px] ${ok ? "text-muted-foreground" : warn ? "text-amber-600" : "text-destructive"}`}>{text}</span>
    </div>
  );
}

function ValidationList({
  item,
  resolveTarget,
}: {
  item: AutoImportItem<any>;
  resolveTarget: (item: AutoImportItem<any>) => AutoImportResolvedTarget | { error: string };
}) {
  const parsed = item.parsed;
  if (!parsed) return null;
  const target = resolveTarget(item);
  const targetError = (target as any)?.error as string | undefined;
  const year = item.yearOverride ?? parsed.meta.academicYear;
  const semester = item.semesterOverride ?? parsed.meta.semester;
  const students = parsed.consolidated.length;
  const missing = item.missingStudents?.length ?? 0;
  const matched = item.matchedStudents ?? 0;

  return (
    <div className="space-y-1">
      <CheckRow ok={!targetError} text={targetError ? targetError : "จับคู่รายวิชา/ห้องเรียนเรียบร้อย"} />
      <CheckRow ok={!!year} warn={!year} text={year ? `ปีการศึกษา ${year}${semester ? ` · ภาค ${semester}` : ""}` : "ยังไม่ระบุปีการศึกษา"} />
      {item.yearCheck && item.yearCheck.status !== "current" && (
        <CheckRow
          ok={false}
          warn
          text={item.yearCheck.status === "past" ? `เป็นข้อมูลย้อนหลัง (${item.yearCheck.label})` : `เป็นปีล่วงหน้า (${item.yearCheck.label})`}
        />
      )}
      <CheckRow ok={students > 0} text={`พบนักเรียนในไฟล์ ${students} คน`} />
      <CheckRow ok={parsed.sheets.length > 0} text={`อ่านได้ ${parsed.sheets.length} sheet`} />
      {item.missingStudents !== undefined && (
        <CheckRow
          ok={missing === 0}
          warn={missing > 0 && !!item.createAlumni}
          text={missing === 0 ? `ตรงกับระบบครบ ${matched} คน` : `พบในระบบ ${matched} คน · ไม่พบ ${missing} คน${item.createAlumni ? " (จะบรรจุเป็นศิษย์เก่า)" : ""}`}
        />
      )}
      {item.duplicateOf && (
        <CheckRow ok={false} warn={!!item.confirmedDuplicate} text={item.confirmedDuplicate ? "ยืนยันอัปโหลดทับไฟล์เดิม" : "มีไฟล์เดิมอยู่แล้ว"} />
      )}
    </div>
  );
}
