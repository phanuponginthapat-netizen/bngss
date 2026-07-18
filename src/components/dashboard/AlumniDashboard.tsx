import { lazy, Suspense } from "react";
import { todayBangkok } from "@/lib/dateBE";
import { useWeatherData } from "@/hooks/useWeatherData";
const DynamicHeroBackground = lazy(() => import("./DynamicHeroBackground"));
const MascotHeroWidget = lazy(() => import("./widgets/MascotHeroWidget"));
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toBE } from "@/lib/utils";
import { Sparkles, Calendar, Bell, ArrowRight, User as UserIcon, Award, Heart, FileText } from "lucide-react";

const AlumniDashboard = () => {
  const { lang } = useLanguage();
  const { userId } = useUserRole();
  const navigate = useNavigate();
  const currentBE = toBE(new Date().getFullYear());
  const L = (th: string, en: string) => (lang === "th" ? th : en);
  const weather = useWeatherData();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return L("สวัสดีตอนเช้า", "Good Morning");
    if (h < 17) return L("สวัสดีตอนบ่าย", "Good Afternoon");
    return L("สวัสดีตอนเย็น", "Good Evening");
  })();

  const { data, isLoading } = useQuery({
    queryKey: ["alumni_dashboard", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", userId!)
        .maybeSingle();

      const [news, events, totalAlumni] = await Promise.all([
        supabase.from("news_posts").select("id, title, category, published_at, content")
          .eq("is_published", true).order("created_at", { ascending: false }).limit(8),
        supabase.from("academic_events").select("id, title, event_date, event_type, location")
          .gte("event_date", todayBangkok())
          .order("event_date").limit(6),
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "graduated"),
      ]);
      return {
        profile,
        news: news.data || [],
        events: events.data || [],
        alumniCount: totalAlumni.count || 0,
      };
    },
  });

  const displayName = data?.profile
    ? [data.profile.first_name, data.profile.last_name].filter(Boolean).join(" ")
    : "";

  return (
    <div className="space-y-6">
      <Suspense fallback={<Skeleton className="h-72 rounded-2xl" />}>
        <MascotHeroWidget />
      </Suspense>
      <div className="gradient-hero rounded-2xl p-6 text-primary-foreground relative overflow-hidden min-h-[180px]">
        <Suspense fallback={null}>
          <DynamicHeroBackground
            weatherCode={weather.weatherCode}
            isRainy={weather.isRainy}
            temperature={weather.temperature}
          />
        </Suspense>
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/20" />
          <div className="absolute -left-4 -bottom-4 w-28 h-28 rounded-full bg-white/10" />
        </div>
        <div className="relative z-10 flex items-center gap-4">
          {data?.profile?.avatar_url ? (
            <img src={data.profile.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/40" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center">
              <Award className="w-8 h-8" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 opacity-80" />
              <span className="text-xs font-medium opacity-80 tracking-wide uppercase">{L("ศิษย์เก่า", "Alumni")}</span>
            </div>
            <h1 className="text-2xl font-bold mb-1 truncate">{greeting}{displayName ? `, ${displayName}` : ""} 👋</h1>
            <p className="text-sm opacity-80">{L("ยินดีต้อนรับกลับสู่บ้านหลังเดิม · ปีการศึกษา", "Welcome back to your school · AY")} {currentBE}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border/50 shadow-elevated rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="w-3.5 h-3.5 text-primary" />
              </div>
              {L("ข่าวสาร / ประชาสัมพันธ์", "News & Announcements")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : data?.news.length ? (
              <div className="space-y-1.5">
                {data.news.map((n: any) => (
                  <div
                    key={n.id}
                    onClick={() => navigate(`/dashboard/news/${n.id}`)}
                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/40 transition cursor-pointer group"
                  >
                    <Badge variant="secondary" className="text-[9px] shrink-0">{n.category}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate group-hover:text-primary">{n.title}</p>
                      {n.published_at && (
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(n.published_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-xs text-center py-6">{L("ยังไม่มีข่าวสาร", "No news")}</p>}
          </CardContent>
        </Card>

        <Card onClick={() => navigate("/dashboard/academic/calendar")} className="border border-border/50 shadow-elevated rounded-2xl cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-warning flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              {L("กิจกรรม / งานศิษย์เก่า", "Upcoming Events")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-40" /> : data?.events.length ? (
              <div className="space-y-1.5">
                {data.events.map((e: any) => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition">
                    <div className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded shrink-0">
                      {new Date(e.event_date).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" })}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{e.title}</p>
                      {e.location && <p className="text-[10px] text-muted-foreground truncate">📍 {e.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-muted-foreground text-xs text-center py-6">{L("ไม่มีกิจกรรม", "No events")}</p>}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{L("ทางลัด", "Quick Actions")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { name: L("โปรไฟล์", "Profile"), icon: UserIcon, gradient: "gradient-primary", link: "/dashboard/profile" },
            { name: L("ขอใบรับรอง", "Certificates"), icon: FileText, gradient: "gradient-warning", link: "/dashboard/academic/certificate" },
            { name: L("รายชื่อศิษย์เก่า", "Alumni Directory"), icon: Heart, gradient: "gradient-accent", link: "/dashboard/academic/alumni" },
          ].map(item => (
            <Card key={item.name} className="border border-border/50 shadow-elevated rounded-2xl hover:shadow-card-hover transition-all hover:-translate-y-0.5 cursor-pointer overflow-hidden group" onClick={() => navigate(item.link)}>
              <div className={`h-1 ${item.gradient}`} />
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${item.gradient} flex items-center justify-center shrink-0`}>
                  <item.icon className="w-4 h-4 text-primary-foreground" />
                </div>
                <p className="text-xs font-semibold text-foreground">{item.name}</p>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground ml-auto group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AlumniDashboard;