import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import WorksheetPlayer from "@/components/worksheets/WorksheetPlayer";
import { Loader2 } from "lucide-react";

export default function PublicWorksheetPage() {
  const { code } = useParams();
  const [ws, setWs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("worksheets")
        .select("id,title,description,grade_level,questions,is_published,source_url,source_type")
        .eq("share_code", code as string)
        .maybeSingle();
      setWs(data);
      setLoading(false);
    })();
  }, [code]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  if (!ws || !ws.is_published) return (
    <div className="min-h-screen flex items-center justify-center text-center p-6">
      <div>
        <h1 className="text-xl font-bold">ไม่พบใบงาน</h1>
        <p className="text-muted-foreground text-sm">ลิงก์อาจไม่ถูกต้องหรือถูกปิดเผยแพร่</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 py-6 px-3">
      <WorksheetPlayer worksheet={ws} />
    </div>
  );
}
