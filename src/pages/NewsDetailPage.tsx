import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, User } from "lucide-react";
import DOMPurify from "dompurify";
import BackButton from "@/components/BackButton";

const NewsDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const L = (th: string, en: string) => (lang === "th" ? th : en);

  const { data, isLoading } = useQuery({
    queryKey: ["news_post", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("news_posts")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <BackButton fallback="/dashboard/news" />


      {isLoading ? (
        <Card><CardContent className="p-6 space-y-3"><Skeleton className="h-8 w-3/4" /><Skeleton className="h-4 w-1/3" /><Skeleton className="h-32" /></CardContent></Card>
      ) : !data ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{L("ไม่พบข่าวสาร", "News not found")}</CardContent></Card>
      ) : (
        <Card className="border-0 shadow-elevated rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{data.category}</Badge>
              {data.published_at && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(data.published_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
              {data.author && (
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <User className="w-3 h-3" /> {data.author}
                </span>
              )}
            </div>
            <CardTitle className="text-2xl">{data.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.content || `<p class="text-muted-foreground">${L("ไม่มีเนื้อหา", "No content")}</p>`) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NewsDetailPage;