import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import LearningPlayer from "@/components/learning/LearningPlayer";
import { Loader2, GraduationCap } from "lucide-react";

export default function PublicLearningPage() {
  const { slug } = useParams<{ slug: string }>();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data, error } = await supabase
        .from("learning_contents")
        .select("*")
        .eq("public_slug", slug)
        .eq("visibility", "public")
        .eq("is_active", true)
        .maybeSingle();
      if (error || !data) setError("ไม่พบสื่อนี้ หรือถูกปิดการใช้งานแล้ว");
      else setContent(data);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center space-y-3">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="text-lg font-semibold">{error || "ไม่พบสื่อนี้"}</h1>
            <p className="text-sm text-muted-foreground">โปรดตรวจสอบลิงก์อีกครั้ง หรือติดต่อครูผู้สอน</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <LearningPlayer content={content} anonymous />;
}
