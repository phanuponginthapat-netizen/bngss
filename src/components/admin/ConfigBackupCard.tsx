import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, Upload, Package, Loader2 } from "lucide-react";
import { swal } from "@/lib/swal";

export type BackupScope = "system" | "cms" | "all";

// Tables included per scope
const SYSTEM_TABLES = ["school_settings"] as const;
const CMS_TABLES = ["cms_settings", "cms_pages", "cms_menu_items"] as const;

type TableName = (typeof SYSTEM_TABLES)[number] | (typeof CMS_TABLES)[number];

const tablesFor = (scope: BackupScope): TableName[] => {
  if (scope === "system") return [...SYSTEM_TABLES];
  if (scope === "cms") return [...CMS_TABLES];
  return [...SYSTEM_TABLES, ...CMS_TABLES];
};

const conflictKeyFor = (table: TableName): string => {
  switch (table) {
    case "school_settings": return "setting_key";
    case "cms_settings": return "key";
    case "cms_pages": return "slug";
    case "cms_menu_items": return "id";
  }
};

interface BackupFile {
  version: 1;
  exported_at: string;
  scope: BackupScope;
  tables: Record<string, any[]>;
}

interface Props {
  scope: BackupScope;
  title?: string;
  description?: string;
}

const ConfigBackupCard = ({ scope, title, description }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [overwrite, setOverwrite] = useState(true);

  const handleExport = async () => {
    setExporting(true);
    try {
      const tables = tablesFor(scope);
      const payload: BackupFile = {
        version: 1,
        exported_at: new Date().toISOString(),
        scope,
        tables: {},
      };
      for (const t of tables) {
        const { data, error } = await supabase.from(t as any).select("*");
        if (error) throw error;
        payload.tables[t] = data || [];
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `${scope}-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const total = Object.values(payload.tables).reduce((s, r) => s + r.length, 0);
      toast.success(`ส่งออกสำเร็จ (${total} เรคคอร์ด)`);
    } catch (e: any) {
      toast.error(e.message || "ส่งออกไม่สำเร็จ");
    } finally {
      setExporting(false);
    }
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupFile;
      if (!parsed?.tables || typeof parsed.tables !== "object") {
        throw new Error("ไฟล์สำรองไม่ถูกต้อง");
      }
      const allowed = new Set(tablesFor(scope));
      const tablesInFile = Object.keys(parsed.tables).filter((t) => allowed.has(t as TableName));
      if (tablesInFile.length === 0) throw new Error("ไม่พบข้อมูลที่ตรงกับหมวดนี้");

      const summary: string[] = [];
      const action = overwrite ? "เขียนทับ" : "เพิ่มเฉพาะที่ยังไม่มี";
      if (!(await swal.confirm({ title: "ยืนยันนำเข้า", text: `จะนำเข้าข้อมูล ${tablesInFile.length} ตาราง โดย${action}`, danger: true }))) {
        setImporting(false);
        return;
      }

      for (const t of tablesInFile) {
        const rows = (parsed.tables[t] || []).filter((r) => r && typeof r === "object");
        if (rows.length === 0) { summary.push(`${t}: 0`); continue; }
        // strip updated_at / created_at so DB defaults apply, keep ids/keys
        const cleaned = rows.map((r) => {
          const { updated_at, created_at, ...rest } = r as any;
          return rest;
        });
        const conflict = conflictKeyFor(t as TableName);
        const { error } = await supabase
          .from(t as any)
          .upsert(cleaned, { onConflict: conflict, ignoreDuplicates: !overwrite });
        if (error) throw new Error(`${t}: ${error.message}`);
        summary.push(`${t}: ${cleaned.length}`);
      }
      toast.success(`นำเข้าสำเร็จ — ${summary.join(", ")}`);
    } catch (err: any) {
      toast.error(err.message || "นำเข้าไม่สำเร็จ");
    } finally {
      setImporting(false);
    }
  };

  const scopeLabel = scope === "system" ? "การตั้งค่าระบบ" : scope === "cms" ? "เนื้อหา CMS" : "ทุกหมวด";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          {title || `สำรอง / กู้คืน${scopeLabel}`}
        </CardTitle>
        <CardDescription>
          {description || "ส่งออกเป็นไฟล์ JSON เพื่อสำรองหรือย้ายไปติดตั้งที่ระบบอื่น"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tablesFor(scope).map((t) => (
            <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExport} disabled={exporting} variant="default">
            {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            ส่งออก (Export)
          </Button>
          <Button onClick={handleImportClick} disabled={importing} variant="outline">
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            นำเข้า (Import)
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFile} />
          <div className="flex items-center gap-2 ml-auto">
            <Checkbox id={`overwrite-${scope}`} checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} />
            <Label htmlFor={`overwrite-${scope}`} className="text-sm cursor-pointer">
              เขียนทับข้อมูลที่ซ้ำ
            </Label>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          ไฟล์สำรองเป็น JSON ที่อ่านได้ — ใช้สำหรับย้ายข้อมูลระหว่างโรงเรียน หรือกู้คืนเมื่อแก้ไขผิดพลาด
        </p>
      </CardContent>
    </Card>
  );
};

export default ConfigBackupCard;
