import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PublicPageLayout from "@/components/public/PublicPageLayout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FaqPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("cms_faqs").select("*").eq("is_published", true).order("sort_order").then(({ data }) => setRows(data || []));
  }, []);

  return (
    <PublicPageLayout title="คำถามที่พบบ่อย" subtitle="FAQ" breadcrumbs={[{ label: "วิชาการ" }, { label: "FAQ" }]}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-border/50 bg-background/70 p-6 shadow-sm backdrop-blur">
        <Accordion type="single" collapsible>
          {rows.map((r) => (
            <AccordionItem key={r.id} value={r.id}>
              <AccordionTrigger className="text-left">{r.question}</AccordionTrigger>
              <AccordionContent className="whitespace-pre-line text-foreground/80">{r.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        {rows.length === 0 && <div className="py-10 text-center text-muted-foreground">ยังไม่มีคำถาม</div>}
      </div>
    </PublicPageLayout>
  );
}
