import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Building2, Briefcase, ArrowLeft, User, Award } from "lucide-react";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import PortfolioGrid from "@/components/social/PortfolioGrid";

interface PublicProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  position_title: string | null;
  department: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  email: string | null;
  phone: string | null;
  school_name: string | null;
}

const PublicProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appName } = useSystemSettings();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    const load = async () => {
      if (!id) { setNotFound(true); setLoading(false); return; }
      const [{ data: userRes }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("get_public_profile", { _id: id }),
      ]);
      setCurrentUserId(userRes?.user?.id ?? null);
      if (error || !data || (Array.isArray(data) && data.length === 0)) setNotFound(true);
      else setProfile(Array.isArray(data) ? data[0] : data);
      setLoading(false);
    };
    load();
  }, [id]);
  const isOwner = !!currentUserId && currentUserId === profile?.id;

  const fullName = profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "—" : "";
  const initials = profile ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`.toUpperCase() || "?" : "?";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="text-muted-foreground">กำลังโหลด...</div></div>;
  }
  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center"><User className="w-8 h-8 text-muted-foreground" /></div>
            <h1 className="text-xl font-bold">ไม่พบโปรไฟล์</h1>
            <Button asChild variant="outline"><Link to="/"><ArrowLeft className="w-4 h-4 mr-2" />กลับหน้าหลัก</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 pb-12 public-profile-protected"
      onContextMenu={(e) => {
        // ป้องกันการคลิกขวาเพื่อบันทึกรูป/ดูแหล่งที่มา ในหน้าโปรไฟล์สาธารณะ
        const t = e.target as HTMLElement;
        if (t.closest("img, video, picture, [data-allow-context]") || t.tagName === "IMG" || t.tagName === "VIDEO") {
          e.preventDefault();
        }
      }}
      onDragStart={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "IMG" || t.tagName === "VIDEO") e.preventDefault();
      }}
    >
      <style>{`
        .public-profile-protected img,
        .public-profile-protected video {
          -webkit-user-select: none;
          user-select: none;
          -webkit-user-drag: none;
          -webkit-touch-callout: none;
          pointer-events: auto;
        }
      `}</style>
      {/* Top nav bar */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/dashboard"))}>
            <ArrowLeft className="w-4 h-4 mr-1" />ย้อนกลับ
          </Button>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/feed">ฟีด</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard/members">สมาชิก</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><GraduationCap className="w-4 h-4 mr-1" />{appName}</Link></Button>
          </div>
        </div>
      </div>

      {/* Cover + header */}
      <div className="h-48 md:h-64 gradient-hero relative overflow-hidden">
        {profile.cover_photo_url ? (
          <img
            src={profile.cover_photo_url}
            alt="cover"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 0%, transparent 50%), radial-gradient(circle at 80% 80%, white 0%, transparent 50%)" }} />
        )}
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-20 relative">
        <Card className="shadow-elevated">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center md:items-end gap-4">
              <Avatar className="w-32 h-32 border-4 border-background shadow-elevated">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={fullName} />
                <AvatarFallback className="text-3xl gradient-primary text-primary-foreground font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-2xl md:text-3xl font-bold">{fullName}</h1>
                {profile.nickname && <p className="text-sm text-muted-foreground">({profile.nickname})</p>}
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                  {profile.position_title && <Badge variant="secondary"><Briefcase className="w-3 h-3 mr-1" />{profile.position_title}</Badge>}
                  {profile.department && <Badge variant="outline">{profile.department}</Badge>}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Award className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">ผลงาน &amp; รางวัล</h2>
          </div>
          <PortfolioGrid userId={profile.id} />
        </div>

      </div>
    </div>
  );
};

export default PublicProfilePage;
