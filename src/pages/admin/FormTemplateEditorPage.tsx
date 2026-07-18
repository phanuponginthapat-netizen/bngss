import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ArrowLeft, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import SuperDocEditor from "@/components/editor/SuperDocEditor";
import { Button } from "@/components/ui/button";

const DOCX_DATA_PREFIX = "data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(url: string): Promise<Blob> {
  const r = await fetch(url); return await r.blob();
}

/**
 * Full Word-like editor page (SuperDoc): rulers, headers/footers, page-breaks,
 * image resize/wrap, native .docx import/export.
 * URL: /form-template/:code?title=...
 */
export default function FormTemplateEditorPage() {
  const { code = "" } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, isDirector, loading: roleLoading } = useUserRole();
  const canEdit = isAdmin || isDirector;

  const title = sp.get("title") || code;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialDocx, setInitialDocx] = useState<Blob | null>(null);
  const [legacyHtml, setLegacyHtml] = useState<string>("");

  // Built-in default templates per code (fallback when DB is empty)
  const DEFAULT_TEMPLATE_URL: Record<string, string> = {
    pp5: "/templates/pp5.docx",
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("form_templates").select("content_html").eq("code", code).maybeSingle();
      if (cancelled) return;
      const raw: string = data?.content_html || "";
      if (raw.startsWith(DOCX_DATA_PREFIX)) {
        try { setInitialDocx(await dataUrlToBlob(raw)); }
        catch { setInitialDocx(null); }
      } else if (raw.trim()) {
        // Legacy HTML template — open blank docx
        setLegacyHtml(raw);
        setInitialDocx(null);
      } else if (DEFAULT_TEMPLATE_URL[code]) {
        // No saved template yet → load built-in default .docx
        try {
          const r = await fetch(DEFAULT_TEMPLATE_URL[code]);
          if (r.ok) setInitialDocx(await r.blob());
          else setInitialDocx(null);
        } catch { setInitialDocx(null); }
      } else {
        setInitialDocx(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => { document.title = `📝 SuperDoc — ${title}`; }, [title]);

  const handleSave = async (docx: Blob) => {
    if (!canEdit) { toast.error("เฉพาะผู้ดูแล/ผู้อำนวยการเท่านั้นที่บันทึก template ได้"); return; }
    setSaving(true);
    try {
      const dataUrl = await blobToDataUrl(docx);
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("form_templates").upsert({
        code, title, content_html: dataUrl, updated_by: u.user?.id || null,
      }, { onConflict: "code" });
      if (error) throw error;
      toast.success("บันทึกเทมเพลตสำเร็จ");
    } catch (err: any) {
      toast.error("บันทึกไม่สำเร็จ: " + (err?.message || err));
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-editor-canvas">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-editor-chrome text-editor-chrome-foreground text-sm shrink-0">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-white hover:bg-white/15"
          onClick={() => window.history.length > 1 ? navigate(-1) : window.close()}>
          <ArrowLeft className="w-4 h-4 mr-1" />ย้อนกลับ
        </Button>
        <span className="font-semibold">📝 SuperDoc Editor</span>
        <span className="opacity-70">—</span>
        <span className="truncate">{title}</span>
        {!canEdit && <span className="text-xs opacity-80">(โหมดดูอย่างเดียว)</span>}
        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
        <Button size="sm" variant="ghost" className="ml-auto h-7 w-7 p-0 text-white hover:bg-danger"
          onClick={() => window.close()} title="ปิด">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {legacyHtml && (
        <div className="shrink-0 bg-warning-soft border-b border-warning/30 px-3 py-2 text-xs text-warning">
          ⚠️ เทมเพลตเก่าเป็น HTML — กำลังเปิด document เปล่า สามารถ <b>นำเข้า .docx</b> หรือ copy/paste เนื้อหาจากของเดิมได้
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {loading || roleLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <SuperDocEditor
            key={code}
            initialDocx={initialDocx}
            title={title}
            readOnly={!canEdit}
            onSave={canEdit ? handleSave : undefined}
          />
        )}
      </div>
    </div>
  );
}
