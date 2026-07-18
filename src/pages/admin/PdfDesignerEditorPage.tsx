import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DesignerWorkspace } from "./PdfTemplateDesignerPage";
import type { PdfTemplateRecord } from "@/lib/pdfTemplate/types";
import { Loader2 } from "lucide-react";

const EMPTY: PdfTemplateRecord = {
  id: "", name: "", category: "other", description: null,
  source_pdf_url: "", source_pdf_path: null, page_count: 0,
  page_width: null, page_height: null, fields: [], data_schema: null,
  is_active: true, created_by: null, created_at: "", updated_at: "",
};

export default function PdfDesignerEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<PdfTemplateRecord | null>(null);

  useEffect(() => {
    if (!id || id === "new") { setInitial(EMPTY); return; }
    (async () => {
      const { data } = await supabase.from("pdf_templates" as any).select("*").eq("id", id).maybeSingle();
      setInitial((data as any) || EMPTY);
    })();
  }, [id]);

  const close = () => navigate("/dashboard/admin/pdf-designer");

  if (!initial) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral text-neutral">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  return <DesignerWorkspace initial={initial} onClose={close} onSaved={close} />;
}
