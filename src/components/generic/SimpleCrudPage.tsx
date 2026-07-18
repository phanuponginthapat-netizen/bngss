import { useEffect, useMemo, useState, ReactNode, ComponentType } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Search, RefreshCw, Upload, FileIcon, X, Download } from "lucide-react";
import { toast } from "sonner";
import { confirmDelete } from "@/lib/confirmAction";
import { useUserRole } from "@/hooks/useUserRole";
import { PhotoUploadField } from "@/components/ui/photo-upload-field";

export type CrudField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "time" | "textarea" | "select" | "checkbox" | "file" | "files" | "image";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  defaultValue?: any;
  hidden?: boolean;
  /** For type="file": storage bucket to upload to (private bucket). Stores the object path in the column.
   *  For type="image": public bucket. Defaults to "cms-images". Stores the public URL. */
  bucket?: string;
  /** For type="file": accept attribute (e.g. ".pdf,image/*") */
  accept?: string;
  /** For type="image": folder prefix inside bucket. Defaults to "uploads". */
  folder?: string;
};


export type CrudColumn = {
  key: string;
  label: string;
  render?: (value: any, row: any) => ReactNode;
  className?: string;
};

export interface SimpleCrudPageProps {
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ className?: string }>;
  table: string;
  fields: CrudField[];
  columns: CrudColumn[];
  defaultValues?: Record<string, any>;
  orderBy?: string;
  ascending?: boolean;
  searchableFields?: string[];
  canCreate?: boolean;
  canDelete?: boolean;
  canEdit?: boolean;
  emptyHint?: string;
  beforeInsert?: (values: Record<string, any>) => Promise<Record<string, any>> | Record<string, any>;
  /** Extra content rendered above the table (e.g. quick stats) */
  headerExtra?: ReactNode;
  /**
   * Column on the table that stores the owning user id (e.g. "user_id", "created_by").
   * When set, non-admin/director users only see their own rows and can only edit/delete their own.
   * On insert, this field is auto-populated with auth.uid().
   */
  ownerField?: string;
  /**
   * Column that stores the assigned teacher id (e.g. "teacher_id").
   * When set, role=teacher only sees rows where this column equals their auth.uid(),
   * and the column is auto-populated on insert. admin/director see everything.
   */
  teacherField?: string;
  /** Extra roles (beyond admin/director) that bypass owner/teacher scoping. */
  privilegedRoles?: string[];

}


// Default role-based permissions applied to every SimpleCrudPage.
// Pages can override via canCreate/canDelete/canEdit props.
const DEFAULT_ROLE_PERMS: Record<string, { create: boolean; edit: boolean; delete: boolean }> = {
  admin:    { create: true,  edit: true,  delete: true  },
  director: { create: true,  edit: true,  delete: true  },
  teacher:  { create: true,  edit: true,  delete: false },
  student:  { create: false, edit: false, delete: false },
  parent:   { create: false, edit: false, delete: false },
  alumni:   { create: false, edit: false, delete: false },
};

export function SimpleCrudPage(props: SimpleCrudPageProps) {
  const {
    title, subtitle, icon: Icon, table, fields, columns,
    defaultValues = {}, orderBy = "created_at", ascending = false,
    searchableFields = [],
    emptyHint, beforeInsert, headerExtra,
    ownerField, teacherField, privilegedRoles = [],
  } = props;

  // Role-based defaults (props can still force-disable via false)
  const { role } = useUserRole();
  const perms = DEFAULT_ROLE_PERMS[role ?? ""] ?? DEFAULT_ROLE_PERMS.student;
  const canCreate = props.canCreate !== false && perms.create;
  const canEdit   = props.canEdit   !== false && perms.edit;
  const canDelete = props.canDelete !== false && perms.delete;
  const isPrivileged = role === "admin" || role === "director" || privilegedRoles.includes(role ?? "");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const initialForm = useMemo(() => {
    const out: Record<string, any> = { ...defaultValues };
    fields.forEach(f => { if (f.defaultValue !== undefined && out[f.name] === undefined) out[f.name] = f.defaultValue; });
    return out;
  }, [JSON.stringify(defaultValues), fields]);
  const [form, setForm] = useState<Record<string, any>>(initialForm);

  const load = async () => {
    setLoading(true);
    let q: any = (supabase as any).from(table).select("*").order(orderBy, { ascending });
    if (ownerField && !isPrivileged && currentUserId) {
      q = q.eq(ownerField, currentUserId);
    }
    if (teacherField && role === "teacher" && currentUserId) {
      q = q.eq(teacherField, currentUserId);
    }

    const { data, error } = await q;
    if (error) toast.error(`โหลดข้อมูลล้มเหลว: ${error.message}`);
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [table, currentUserId, isPrivileged]);


  // Realtime
  useEffect(() => {
    const channel = (supabase as any)
      .channel(`crud-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [table]);

  const openCreate = () => { setEditing(null); setForm(initialForm); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    const f: Record<string, any> = {};
    fields.forEach(fd => { f[fd.name] = row[fd.name] ?? ""; });
    setForm(f);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Validate required
      for (const f of fields) {
        if (f.required && (form[f.name] === "" || form[f.name] === undefined || form[f.name] === null)) {
          toast.error(`กรุณากรอก: ${f.label}`); setSaving(false); return;
        }
      }
      let payload: Record<string, any> = {};
      fields.forEach(f => {
        let v = form[f.name];
        if (v === "" || v === undefined) v = null;
        if (f.type === "number" && v !== null) v = Number(v);
        if (f.type === "checkbox") v = !!v;
        payload[f.name] = v;
      });
      if (beforeInsert && !editing) payload = await beforeInsert(payload);
      // Auto-populate owner field on insert
      if (ownerField && !editing && currentUserId && !payload[ownerField]) {
        payload[ownerField] = currentUserId;
      }
      if (teacherField && !editing && role === "teacher" && currentUserId && !payload[teacherField]) {
        payload[teacherField] = currentUserId;
      }



      let err;
      if (editing) {
        ({ error: err } = await (supabase as any).from(table).update(payload).eq("id", editing.id));
      } else {
        ({ error: err } = await (supabase as any).from(table).insert(payload));
      }
      if (err) throw err;
      toast.success(editing ? "แก้ไขสำเร็จ" : "เพิ่มข้อมูลสำเร็จ");
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "บันทึกล้มเหลว");
    } finally { setSaving(false); }
  };

  const handleDelete = async (row: any) => {
    const ok = await confirmDelete(`ลบ "${String(row.title || row.name || row.subject || row.id).slice(0,60)}"?`, "การลบไม่สามารถย้อนกลับได้");
    if (!ok) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", row.id);
    if (error) toast.error(error.message); else { toast.success("ลบสำเร็จ"); load(); }
  };

  const filtered = useMemo(() => {
    if (!search.trim() || searchableFields.length === 0) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => searchableFields.some(k => String(r[k] ?? "").toLowerCase().includes(q)));
  }, [rows, search, searchableFields]);

  const renderField = (f: CrudField) => {
    if (f.hidden) return null;
    const v = form[f.name] ?? "";
    const set = (val: any) => setForm(s => ({ ...s, [f.name]: val }));
    if (f.type === "textarea") return <Textarea value={v} onChange={e => set(e.target.value)} placeholder={f.placeholder} rows={3} />;
    if (f.type === "select") return (
      <Select value={v ? String(v) : ""} onValueChange={set}>
        <SelectTrigger><SelectValue placeholder={f.placeholder || "เลือก..."} /></SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {(f.options || []).map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    );
    if (f.type === "checkbox") return (
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!v} onChange={e => set(e.target.checked)} className="h-4 w-4 accent-primary" />
        <span>{f.placeholder || "ใช่"}</span>
      </label>
    );
    if (f.type === "file") return <FileField field={f} value={v} onChange={set} />;
    if (f.type === "files") return <FilesField field={f} value={v} onChange={set} />;
    if (f.type === "image") return (
      <PhotoUploadField
        value={v || null}
        onChange={(url) => set(url)}
        bucket={f.bucket || "cms-images"}
        folder={f.folder || "uploads"}
      />
    );
    return <Input type={f.type || "text"} value={v ?? ""} onChange={e => set(e.target.value)} placeholder={f.placeholder} step={f.type === "number" ? "any" : undefined} />;
  };


  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="โหลดใหม่"><RefreshCw className="w-4 h-4" /></Button>
          {canCreate && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> เพิ่มข้อมูล</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? "แก้ไข" : "เพิ่ม"} {title}</DialogTitle></DialogHeader>
                <div className="grid gap-4 sm:grid-cols-2 py-2">
                  {fields.filter(f => !f.hidden).map(f => (
                    <div key={f.name} className={(f.type === "textarea" || f.type === "image") ? "sm:col-span-2" : ""}>
                      <Label className="mb-1.5 block">
                        {f.label}{f.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {renderField(f)}
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    บันทึก
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {headerExtra}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base flex-1">รายการทั้งหมด ({filtered.length})</CardTitle>
            {searchableFields.length > 0 && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="ค้นหา..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {emptyHint || "ยังไม่มีข้อมูล กดปุ่ม “เพิ่มข้อมูล” เพื่อเริ่มต้น"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map(c => <TableHead key={c.key} className={c.className}>{c.label}</TableHead>)}
                    {(canEdit || canDelete) && <TableHead className="text-right w-28">จัดการ</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(row => (
                    <TableRow key={row.id}>
                      {columns.map(c => (
                        <TableCell key={c.key} className={c.className}>
                          {c.render ? c.render(row[c.key], row) : (row[c.key] ?? "—")}
                        </TableCell>
                      ))}
                      {(canEdit || canDelete) && (() => {
                        const ownsByOwner = !ownerField || isPrivileged || (currentUserId && row[ownerField] === currentUserId);
                        const ownsByTeacher = !teacherField || isPrivileged || role !== "teacher" || (currentUserId && row[teacherField] === currentUserId);
                        const owns = ownsByOwner && ownsByTeacher;

                        const showEdit = canEdit && owns;
                        const showDelete = canDelete && owns;
                        return (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {showEdit && (
                                <Button size="icon" variant="ghost" onClick={() => openEdit(row)} title="แก้ไข"><Pencil className="w-4 h-4" /></Button>
                              )}
                              {showDelete && (
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(row)} title="ลบ"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })()}

                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper: status badge renderer
export function statusBadge(value: string, map?: Record<string, { label: string; variant?: "default"|"secondary"|"outline"|"destructive" }>) {
  const cfg = map?.[value] || { label: value };
  return <Badge variant={cfg.variant || "secondary"}>{cfg.label}</Badge>;
}

export function moneyTH(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return `฿${Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// File upload field — uploads to a private storage bucket, stores object path in the column.
function FileField({ field, value, onChange }: { field: CrudField; value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const bucket = field.bucket;
  const path: string = typeof value === "string" ? value : "";
  const fileName = path ? path.split("/").pop() : "";
  const allowsImage = !field.accept || /image|\*/.test(field.accept);

  const doUpload = async (file: File) => {
    if (!file || !bucket) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("ไฟล์ใหญ่เกิน 20MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(key, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || undefined,
      });
      if (error) throw error;
      onChange(key);
      toast.success("อัปโหลดสำเร็จ");
    } catch (err: any) {
      toast.error(err.message || "อัปโหลดล้มเหลว");
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = "";
  };

  const handleOpen = async () => {
    if (!path || !bucket) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { toast.error("เปิดไฟล์ไม่ได้"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const handleRemove = async () => {
    if (!path || !bucket) return;
    await supabase.storage.from(bucket).remove([path]).catch(() => {});
    onChange(null);
  };

  if (path) {
    return (
      <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
        <FileIcon className="w-4 h-4 text-primary shrink-0" />
        <button type="button" onClick={handleOpen} className="text-sm flex-1 text-left truncate hover:underline">
          {fileName}
        </button>
        <Button type="button" size="icon" variant="ghost" onClick={handleOpen} title="เปิด/ดาวน์โหลด" className="h-7 w-7">
          <Download className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={handleRemove} title="ลบไฟล์" className="h-7 w-7">
          <X className="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span>{uploading ? "กำลังอัปโหลด..." : "เลือกไฟล์"}</span>
        <input type="file" className="hidden" accept={field.accept} onChange={handleUpload} disabled={uploading} />
      </label>
      {allowsImage && (
        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
          <Upload className="w-4 h-4" />
          <span>ถ่ายภาพ</span>
          <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleUpload} disabled={uploading} />
        </label>
      )}
    </div>
  );
}

// Multi-file upload field — stores an array of storage object paths (JSONB / text[]) in the column.
function FilesField({ field, value, onChange }: { field: CrudField; value: any; onChange: (v: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const bucket = field.bucket;
  const paths: string[] = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : typeof value === "string" && value ? [value] : [];

  const uploadOne = async (file: File): Promise<string | null> => {
    if (!bucket) return null;
    if (file.size > 20 * 1024 * 1024) { toast.error(`ไฟล์ "${file.name}" ใหญ่เกิน 20MB`); return null; }
    const ext = file.name.split(".").pop() || "bin";
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(key, file, {
      cacheControl: "3600", upsert: false, contentType: file.type || undefined,
    });
    if (error) { toast.error(error.message || "อัปโหลดล้มเหลว"); return null; }
    return key;
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    try {
      const keys: string[] = [];
      for (const f of files) {
        const k = await uploadOne(f);
        if (k) keys.push(k);
      }
      if (keys.length) {
        onChange([...paths, ...keys]);
        toast.success(`อัปโหลดสำเร็จ ${keys.length} ไฟล์`);
      }
    } finally {
      setUploading(false);
    }
  };

  const openOne = async (p: string) => {
    if (!bucket) return;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, 300);
    if (error || !data?.signedUrl) { toast.error("เปิดไฟล์ไม่ได้"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const removeOne = async (p: string) => {
    if (!bucket) return;
    await supabase.storage.from(bucket).remove([p]).catch(() => {});
    onChange(paths.filter((x) => x !== p));
  };

  return (
    <div className="space-y-2">
      {paths.length > 0 && (
        <div className="space-y-1">
          {paths.map((p) => {
            const name = p.split("/").pop() || p;
            return (
              <div key={p} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                <FileIcon className="w-4 h-4 text-primary shrink-0" />
                <button type="button" onClick={() => openOne(p)} className="text-sm flex-1 text-left truncate hover:underline">
                  {name}
                </button>
                <Button type="button" size="icon" variant="ghost" onClick={() => openOne(p)} title="เปิด/ดาวน์โหลด" className="h-7 w-7">
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => removeOne(p)} title="ลบไฟล์" className="h-7 w-7">
                  <X className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-muted/40 text-sm text-muted-foreground">
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        <span>{uploading ? "กำลังอัปโหลด..." : paths.length ? "เพิ่มไฟล์" : "เลือกไฟล์ (เลือกได้หลายไฟล์)"}</span>
        <input type="file" multiple className="hidden" accept={field.accept} onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}



