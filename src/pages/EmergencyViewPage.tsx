import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";

const EmergencyViewPage = () => {
  const { lang } = useLanguage();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["emergency_broadcasts_view"],
    queryFn: async () => {
      const { data } = await supabase
        .from("emergency_broadcasts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const sevColors: Record<string, string> = {
    info: "bg-blue-100 text-blue-800 border-blue-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    critical: "bg-red-100 text-red-800 border-red-200",
  };
  const sevLabel: Record<string, string> = {
    info: lang === "th" ? "แจ้งเตือน" : "Info",
    warning: lang === "th" ? "เตือนภัย" : "Warning",
    critical: lang === "th" ? "วิกฤต" : "Critical",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-destructive" />
          {lang === "th" ? "ประกาศฉุกเฉิน" : "Emergency Announcements"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === "th" ? "ประกาศและการแจ้งเตือนฉุกเฉินจากโรงเรียน" : "Emergency alerts from the school"}
        </p>
      </div>

      <div className="space-y-3">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{lang === "th" ? "กำลังโหลด..." : "Loading..."}</p>
        )}
        {!isLoading && records.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            {lang === "th" ? "ยังไม่มีประกาศฉุกเฉิน" : "No emergency announcements"}
          </CardContent></Card>
        )}
        {records.map((r: any) => (
          <Card key={r.id} className="border-l-4" style={{ borderLeftColor: r.severity === "critical" ? "hsl(var(--destructive))" : r.severity === "warning" ? "#eab308" : "#3b82f6" }}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-lg">{r.title}</h2>
                <Badge className={sevColors[r.severity] || ""}>{sevLabel[r.severity] || r.severity}</Badge>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.message}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(r.sent_at || r.created_at).toLocaleString(lang === "th" ? "th-TH" : "en-US")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default EmergencyViewPage;
