import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuthSession } from "@/hooks/useAuthSession";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import CreditFooter from "@/components/CreditFooter";
import HomepagePopup from "@/components/cms/HomepagePopup";


// Sanitize CMS-authored HTML before injecting into the public landing page
// to prevent stored XSS in case an admin account is compromised.
const sanitizeCmsHtml = (html: string | null | undefined): string =>
  DOMPurify.sanitize(html || "", {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "allow", "allowfullscreen", "frameborder", "scrolling", "data-embed"],
  });
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useCmsSettingsBulk } from "@/hooks/useCmsSettings";
import { useModuleToggles } from "@/hooks/useModuleToggles";
import EmbedRenderer, { isFullHtml } from "@/components/cms/EmbedRenderer";
import SocialWallWidget from "@/components/social/SocialWallWidget";
import { BE_OFFSET } from "@/lib/dateBE";
import {
  icons as lucideIcons,
  GraduationCap, Phone, Mail, MapPin, Menu, X, Search,
  BookOpen, Users, Award, Shield, Clock, Heart,
  Star, Zap, Target, Lightbulb, Globe, Rocket,
  CheckCircle, FileText, Layers, Monitor, Facebook, User,
  ChevronLeft, ChevronRight
} from "lucide-react";

// Resolve a Lucide icon by kebab-case or PascalCase name (e.g. "log-in" or "LogIn")
const resolveLucide = (name?: string) => {
  if (!name) return null;
  const pascal = name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return (lucideIcons as Record<string, any>)[pascal] ?? null;
};

interface CmsMenuItem { id: string; label: string; url: string | null; sort_order: number; }
interface CmsPage { id: string; slug: string; title: string; content: string | null; }
interface CmsSettings { [key: string]: string; }
interface NewsPost { id: string; title: string; content: string | null; published_at: string | null; created_at: string; is_pinned: boolean; category: string; }

const iconMap: Record<string, any> = {
  BookOpen, Users, Shield, Clock, Award, Heart,
  Star, Zap, Target, Lightbulb, Globe, Rocket,
  CheckCircle, FileText, Layers, Monitor, GraduationCap
};

const MenuDropdown = ({ menuItems }: { menuItems: CmsMenuItem[] }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        className="inline-flex items-center gap-2 h-9 pl-1.5 pr-3.5 rounded-full bg-muted/60 hover:bg-muted border border-border/60 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:scale-[1.02]"
        aria-label="เมนู"
      >
        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
          <Menu className="w-3 h-3 text-primary-foreground" />
        </span>
        <span className="hidden sm:inline">เมนู</span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl p-2 shadow-xl border-border/60">
      <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
        ค้นหา
      </DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <Link to="/find" className="flex items-center gap-3 rounded-xl px-2.5 py-2 cursor-pointer">
          <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Search className="w-4 h-4 text-primary" />
          </span>
          <div className="flex-1">
            <div className="text-sm font-medium">ค้นหาบุคคล</div>
            <div className="text-[11px] text-muted-foreground">ครู · บุคลากร · นักเรียน</div>
          </div>
        </Link>
      </DropdownMenuItem>
      {menuItems.length > 0 && (
        <>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
            เมนูหลัก
          </DropdownMenuLabel>
          {menuItems.map((item) => {
            const url = item.url || "/";
            const active =
              typeof window !== "undefined" &&
              (window.location.pathname === url || (url !== "/" && window.location.pathname.startsWith(url)));
            return (
              <DropdownMenuItem key={item.id} asChild>
                <Link
                  to={url}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 cursor-pointer ${
                    active ? "bg-primary/10 text-primary font-medium" : ""
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              </DropdownMenuItem>
            );
          })}
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);


const Index = () => {
  const { slug } = useParams();
  useSystemSettings(); // dynamically update title & favicon
  const { isModuleEnabled } = useModuleToggles();
  const socialFeedEnabled = isModuleEnabled("social_feed");
  const [menuItems, setMenuItems] = useState<CmsMenuItem[]>([]);
  const { data: settings = {} } = useCmsSettingsBulk();
  const [currentPage, setCurrentPage] = useState<CmsPage | null>(null);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const { session } = useAuthSession();
  const navigate = useNavigate();

  // เมื่อเปิดจาก PWA ที่ติดตั้งแล้ว และผู้ใช้ล็อกอินอยู่ → พาเข้าหน้าระบบทันที
  // (start_url เป็น "/" เพื่อ identity ที่เสถียร แต่ผู้ใช้ที่ล็อกอินอยู่ไม่ควรค้างที่หน้าประชาสัมพันธ์)
  useEffect(() => {
    if (slug) return; // /page/:slug — ไม่ต้อง redirect
    if (!session?.user) return;
    const isPwa =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true ||
      new URLSearchParams(window.location.search).get("source")?.startsWith("pwa");
    if (isPwa) navigate("/dashboard", { replace: true });
  }, [session?.user?.id, slug, navigate]);


  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfile(null); return; }
    supabase
      .from("profiles")
      .select("first_name, last_name, avatar_url")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { setProfile(null); return; }
        const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
        setProfile({ full_name: full || null, avatar_url: (data as any).avatar_url ?? null });
      });

  }, [session?.user?.id]);

  useEffect(() => {
    // Fire each query independently so the UI can paint as soon as the
    // fastest one resolves — instead of waiting for the slowest (settings ~2s)
    supabase.from("cms_menu_items").select("*").eq("is_visible", true).order("sort_order")
      .then(({ data }) => { if (data) setMenuItems(data); });
    supabase.from("cms_pages").select("*").eq("is_published", true).order("sort_order")
      .then(({ data }) => { if (data) setPages(data); });
    supabase.from("news_posts")
      .select("id, title, content, published_at, created_at, is_pinned, category")
      .eq("is_published", true)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(6)
      .then(({ data }) => { if (data) setNewsPosts(data as NewsPost[]); });
  }, []);

  useEffect(() => {
    const targetSlug = slug || "home";
    const page = pages.find(p => p.slug === targetSlug);
    setCurrentPage(page || null);
  }, [slug, pages]);

  const get = (key: string, fallback = "") => settings[key] || fallback;
  const getJson = (key: string, fallback: any[] = []) => {
    try { return JSON.parse(get(key, "[]")); } catch { return fallback; }
  };

  const schoolName = get("school_name");
  const schoolLogo = get("school_logo");
  const heroTitle = get("hero_title") || schoolName;
  const heroSubtitle = get("hero_subtitle");
  const heroBackground = get("hero_background");
  const heroBgColor = get("hero_bg_color");
  const showHero = get("show_hero", "true") !== "false";
  const showHeroLogo = get("hero_show_logo", "true") !== "false";
  const heroPrimaryText = get("hero_cta_primary", "เข้าสู่ระบบ");
  const heroPrimaryUrl = get("hero_cta_primary_url", "/login");
  const heroPrimaryIcon = get("hero_cta_primary_icon");
  const heroPrimaryImage = get("hero_cta_primary_image");
  const heroSecondaryText = get("hero_cta_secondary", "เกี่ยวกับเรา");
  const heroSecondaryUrl = get("hero_cta_secondary_url", "/page/about");
  const heroSecondaryIcon = get("hero_cta_secondary_icon");
  const heroSecondaryImage = get("hero_cta_secondary_image");
  const heroTextAlign = get("hero_text_align", "center") as "left" | "center" | "right";
  const heroTextVertical = get("hero_text_vertical", "middle") as "top" | "middle" | "bottom";
  const heroIconPosition = get("hero_icon_position", "above") as "above" | "below" | "left" | "right" | "none";
  const heroHeight = get("hero_height", "md") as "sm" | "md" | "lg" | "xl";
  const heroOverlay = parseInt(get("hero_overlay", "40")); // 0-100
  const heroTextColor = get("hero_text_color", "#ffffff");
  const heroShowButtons = get("hero_show_buttons", "true") !== "false";
  const headerLoginText = get("header_login_text", "เข้าสู่ระบบ");

  const showStats = get("show_stats", "true") !== "false";
  const defaultStats = [
    { value: "29+", label: "ระบบย่อย" },
    { value: "4", label: "ฝ่ายงาน" },
    { value: "100%", label: "ออนไลน์" },
    { value: "24/7", label: "เข้าถึงได้" },
  ];
  const stats: { value: string; label: string }[] = getJson("homepage_stats", defaultStats);

  const showBannerCarousel = get("show_banner_carousel", "true") !== "false";
  const bannerImages = [0, 1, 2, 3]
    .map(i => ({
      url: get(`banner_carousel_${i}`),
      caption: get(`banner_carousel_caption_${i}`),
      link: get(`banner_carousel_link_${i}`),
      target: get(`banner_carousel_link_target_${i}`, "_self"),
    }))
    .filter(b => b.url);
  const bannerInterval = parseInt(get("banner_carousel_interval", "5")) * 1000;
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => {
    if (!showBannerCarousel || bannerImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % bannerImages.length);
    }, bannerInterval);
    return () => clearInterval(timer);
  }, [showBannerCarousel, bannerImages.length, bannerInterval]);

  // Scroll animation observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const animateRef = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('animate-in');
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );
    }
    observerRef.current.observe(el);
  }, []);

  const showHomepageContent = get("show_homepage_content", "true") !== "false";
  const homepageContent = get("homepage_content");

  const showFeatures = get("show_features", "true") !== "false";
  const featuresTitle = get("features_title", "ระบบครบจบในที่เดียว");
  const featuresSubtitle = get("features_subtitle", "บริหารจัดการโรงเรียนทุกมิติ ตั้งแต่วิชาการ กิจการนักเรียน งานทั่วไป ไปจนถึงงานบุคคล");
  const defaultFeatures = [
    { icon: "BookOpen", title: "ระบบวิชาการครบวงจร", desc: "จัดการหลักสูตร ลงทะเบียน บันทึกคะแนน ตัดเกรดอัตโนมัติ" },
    { icon: "Users", title: "กิจการนักเรียน", desc: "ระบบเช็กชื่อ พฤติกรรม คัดกรอง เยี่ยมบ้าน ครบจบในที่เดียว" },
    { icon: "Shield", title: "ปลอดภัยและน่าเชื่อถือ", desc: "ระบบรักษาความปลอดภัยข้อมูลระดับสูง แบ่งสิทธิ์ตามบทบาท" },
    { icon: "Clock", title: "บริหารงานบุคคล", desc: "ลงเวลา ลาออนไลน์ ประเมินผล จัดการข้อมูลบุคลากร" },
    { icon: "Award", title: "ใบรับรองดิจิทัล", desc: "ออก ปพ.1 ปพ.2 ใบรับรอง Transcript อัตโนมัติ" },
    { icon: "Heart", title: "สุขภาพและความปลอดภัย", desc: "ห้องพยาบาล วัคซีน ประกาศฉุกเฉิน ดูแลนักเรียนรอบด้าน" },
  ];
  const features: { icon: string; title: string; desc: string }[] = getJson("homepage_features", defaultFeatures);

  const showCta = get("show_cta", "true") !== "false";
  const ctaTitle = get("cta_title", "พร้อมเริ่มต้นใช้งานแล้วหรือยัง?");
  const ctaSubtitle = get("cta_subtitle", "เข้าสู่ระบบเพื่อเริ่มบริหารจัดการโรงเรียนของคุณได้ทันที");
  const ctaButtonText = get("cta_button_text", "เข้าสู่ระบบเลย");
  const ctaButtonUrl = get("cta_button_url", "/login");

  const showCustomEmbed = get("show_custom_embed", "false") === "true";
  const customEmbedCode = get("custom_embed_code");

  const schoolAddress = get("school_address");
  const schoolPhone = get("school_phone");
  const schoolEmail = get("school_email");
  const footerDescription = get("footer_description") || heroSubtitle;
  const footerCopyright = get("footer_copyright");
  const footerLogo = get("footer_logo") || schoolLogo;
  const footerName = get("footer_school_name") || schoolName;
  const showFooter = get("show_footer", "true") !== "false";
  const socialFacebook = get("social_facebook");
  const socialLine = get("social_line");

  const isHome = !slug || slug === "home";




  return (
    <div className="min-h-screen flex flex-col bg-[#fffaf5] dark:bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-card/80 backdrop-blur-xl border-b border-[#fecaca]/40 dark:border-border/40 shadow-[0_1px_20px_-8px_rgba(249,168,168,0.35)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} className="w-10 h-10 rounded-xl object-contain shadow-md ring-1 ring-border/40 group-hover:shadow-lg group-hover:scale-105 transition-all" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md ring-1 ring-primary/20 group-hover:shadow-lg group-hover:scale-105 transition-all">
                <GraduationCap className="w-5 h-5 text-primary-foreground" />
              </div>
            )}
            <span className="font-bold text-foreground text-lg hidden sm:inline tracking-tight max-w-[220px] truncate">{schoolName}</span>
          </Link>


          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Language toggle wrapper */}
            <div className="hidden sm:flex items-center h-9 rounded-full bg-muted/60 border border-border/50 px-1">
              <LanguageToggle />
            </div>
            <div className="sm:hidden">
              <LanguageToggle />
            </div>


            {/* Auth CTA */}
            {session ? (
              <div className="flex items-center gap-1.5">
                <Link to="/dashboard/profile" className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted border border-border/50 transition-colors">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name || "profile"}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-border/60"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/20 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <span className="hidden lg:inline text-sm font-medium text-foreground max-w-[120px] truncate">
                    {profile?.full_name || session.user?.email}
                  </span>
                </Link>
                <MenuDropdown menuItems={menuItems} />
                <Link to="/dashboard">
                  <Button size="sm" className="rounded-full font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all">
                    แดชบอร์ด
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <MenuDropdown menuItems={menuItems} />
                <Link to="/login">
                  <Button size="sm" className="rounded-full font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.02] transition-all">
                    {headerLoginText}
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>



      {isHome ? (
        <>
          {/* Hero Banner */}
          {showHero && (() => {
            const overlayAlpha = Math.max(0, Math.min(100, heroOverlay)) / 100;
            const heightCls = { sm: "min-h-[40vh]", md: "min-h-[60vh]", lg: "min-h-[75vh]", xl: "min-h-[90vh]" }[heroHeight];
            const alignCls = { left: "text-left items-start", center: "text-center items-center", right: "text-right items-end" }[heroTextAlign];
            const justifyCls = { top: "justify-start pt-20", middle: "justify-center", bottom: "justify-end pb-20" }[heroTextVertical];
            const isHorizontalIcon = heroIconPosition === "left" || heroIconPosition === "right";
            const Icon = (
              <div className={`inline-flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem] bg-white shadow-2xl ring-[6px] ring-white/60 border-4 border-[#fecaca]/60 overflow-hidden animate-[fadeInScale_0.6s_ease-out_0.2s_both] shrink-0 relative`}>
                <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[#7dd3fc]/70 blur-[2px]" aria-hidden />
                <div className="absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-[#f9a8a8]/60 blur-[2px]" aria-hidden />
                {schoolLogo ? (
                  <img src={schoolLogo} alt={schoolName} className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-lg relative z-10" />
                ) : (
                  <GraduationCap className="w-14 h-14 sm:w-16 sm:h-16 drop-shadow-lg relative z-10 text-[#0369a1]" />
                )}
              </div>
            );
            const TextBlock = (
              <div className={`flex flex-col gap-5 ${alignCls}`}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight animate-[fadeInUp_0.8s_ease-out_0.3s_both]">
                  {heroTitle}
                </h1>
                <p className="text-lg sm:text-xl opacity-90 max-w-2xl leading-relaxed animate-[fadeInUp_0.8s_ease-out_0.5s_both]">
                  {heroSubtitle}
                </p>
                {heroShowButtons && (heroPrimaryText || heroPrimaryIcon || heroPrimaryImage || heroSecondaryText || heroSecondaryIcon || heroSecondaryImage) && (() => {
                  const PrimaryIcon = resolveLucide(heroPrimaryIcon);
                  const SecondaryIcon = resolveLucide(heroSecondaryIcon);
                  const renderContent = (text: string, Icon: any, image: string) => {
                    if (image) return <img src={image} alt={text || "button"} className="h-6 w-auto object-contain" />;
                    return (
                      <>
                        {Icon && <Icon className="h-5 w-5" />}
                        {text && <span>{text}</span>}
                      </>
                    );
                  };
                  const hasPrimary = heroPrimaryText || heroPrimaryIcon || heroPrimaryImage;
                  const hasSecondary = heroSecondaryText || heroSecondaryIcon || heroSecondaryImage;
                  return (
                    <div className={`flex flex-wrap gap-3 mt-2 animate-[fadeInUp_0.8s_ease-out_0.7s_both] ${heroTextAlign === "center" ? "justify-center" : heroTextAlign === "right" ? "justify-end" : "justify-start"}`}>
                      {hasPrimary && (
                        <Link to={heroPrimaryUrl}>
                          <Button size="lg" className="bg-white text-primary hover:bg-white/90 shadow-xl gap-2">
                            {renderContent(heroPrimaryText, PrimaryIcon, heroPrimaryImage)}
                          </Button>
                        </Link>
                      )}
                      {hasSecondary && (
                        <Link to={heroSecondaryUrl}>
                          <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/40 hover:bg-white/20 gap-2">
                            {renderContent(heroSecondaryText, SecondaryIcon, heroSecondaryImage)}
                          </Button>
                        </Link>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
            return (
              <section
                className={`relative overflow-hidden ${heightCls}`}
                style={{
                  color: heroTextColor,
                  ...(heroBackground ? {
                    backgroundImage: `linear-gradient(rgba(0,0,0,${overlayAlpha}), rgba(0,0,0,${overlayAlpha * 0.7})), url(${heroBackground})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  } : heroBgColor ? { background: heroBgColor } : undefined),
                }}
              >
                {!heroBackground && !heroBgColor && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#e0f2fe] via-[#7dd3fc] to-[#f9a8a8]">
                    <div className="absolute top-[-15%] right-[-8%] w-[520px] h-[520px] rounded-full bg-[#fecaca]/60 blur-3xl animate-[fadeInScale_1.2s_ease-out]" />
                    <div className="absolute bottom-[-25%] left-[-12%] w-[620px] h-[620px] rounded-full bg-[#e0f2fe]/70 blur-3xl animate-[fadeInScale_1.4s_ease-out]" />
                    <div className="absolute top-[20%] left-[15%] w-32 h-32 rounded-full bg-white/40 blur-2xl" />
                    <div className="absolute bottom-[18%] right-[20%] w-40 h-40 rounded-full bg-[#fecaca]/50 blur-2xl" />
                    {/* subtle dotted grid overlay */}
                    <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
                  </div>
                )}
                <div className={`relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col ${justifyCls} ${heightCls} animate-[fadeInUp_0.8s_ease-out_forwards]`}>
                  {isHorizontalIcon ? (
                    <div className={`flex flex-col sm:flex-row gap-8 sm:gap-10 ${alignCls} ${heroIconPosition === "right" ? "sm:flex-row-reverse" : ""}`}>
                      {showHeroLogo && Icon}
                      <div className="flex-1">{TextBlock}</div>
                    </div>
                  ) : (
                    <div className={`flex flex-col gap-6 ${alignCls}`}>
                      {showHeroLogo && heroIconPosition === "above" && Icon}
                      {TextBlock}
                      {showHeroLogo && heroIconPosition === "below" && Icon}
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {(() => {
            const defaultOrder = ["stats", "banner", "content", "page_content", "features", "cta", "news", "social", "embed"];
            let order: string[] = defaultOrder;
            try {
              const saved = JSON.parse(get("homepage_sections_order", "[]"));
              if (Array.isArray(saved) && saved.length > 0) {
                const valid = saved.filter((k: string) => defaultOrder.includes(k));
                const missing = defaultOrder.filter(k => !valid.includes(k));
                order = [...valid, ...missing];
              }
            } catch {}

            const sectionMap: Record<string, JSX.Element | null> = {
              stats: showStats && stats.length > 0 ? (
                <section ref={animateRef} className="relative -mt-14 z-10 max-w-4xl mx-auto px-4 scroll-animate opacity-0 translate-y-6">
                  <Card className="border-0 shadow-2xl rounded-[2rem] bg-white/95 backdrop-blur-xl ring-1 ring-[#fecaca]/40 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[#fecaca]/40">
                        {stats.map((s, i) => (
                          <div key={i} className="text-center py-7 px-4 relative group">
                            <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-[#0ea5e9] to-[#f9a8a8] bg-clip-text text-transparent">{s.value}</div>
                            <div className="text-sm text-muted-foreground mt-1.5 font-medium">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              ) : null,

              banner: showBannerCarousel && bannerImages.length > 0 ? (
                <section ref={animateRef} className="max-w-5xl mx-auto px-4 py-10 scroll-animate opacity-0 translate-y-6">
                  <div className="relative rounded-2xl overflow-hidden shadow-xl aspect-[21/9]">
                    {bannerImages.map((b, i) => {
                      const imgEl = (
                        <>
                          <img src={b.url} alt={b.caption || `Banner ${i + 1}`} className="w-full h-full object-cover" />
                          {b.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 pointer-events-none">
                              <p className="text-white text-lg font-medium">{b.caption}</p>
                            </div>
                          )}
                        </>
                      );
                      const isExternal = b.link && /^https?:\/\//i.test(b.link);
                      return (
                        <div
                          key={i}
                          className="absolute inset-0 transition-all duration-700 ease-in-out"
                          style={{
                            opacity: currentBanner === i ? 1 : 0,
                            transform: currentBanner === i ? 'scale(1)' : 'scale(1.05)',
                            pointerEvents: currentBanner === i ? 'auto' : 'none',
                          }}
                        >
                          {b.link ? (
                            isExternal ? (
                              <a href={b.link} target={b.target || "_self"} rel="noopener noreferrer" className="block w-full h-full">
                                {imgEl}
                              </a>
                            ) : (
                              <Link to={b.link} target={b.target || "_self"} className="block w-full h-full">
                                {imgEl}
                              </Link>
                            )
                          ) : (
                            imgEl
                          )}
                        </div>
                      );
                    })}
                    {bannerImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentBanner(prev => (prev - 1 + bannerImages.length) % bannerImages.length)}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setCurrentBanner(prev => (prev + 1) % bannerImages.length)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                          {bannerImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setCurrentBanner(i)}
                              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                currentBanner === i ? 'bg-white scale-125' : 'bg-white/50 hover:bg-white/75'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              ) : null,

              content: showHomepageContent && homepageContent ? (
                <section className="max-w-4xl mx-auto px-4 py-12">
                  <div
                    className="prose prose-sm sm:prose max-w-none
                      [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-4
                      [&_p]:text-muted-foreground [&_p]:leading-relaxed
                      [&_img]:rounded-xl [&_img]:shadow-md
                      [&_iframe]:rounded-xl [&_iframe]:w-full [&_iframe]:aspect-video
                      [&_[data-embed]]:my-4"
                    dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(homepageContent) }}
                  />
                </section>
              ) : null,

              page_content: currentPage?.content ? (
                <section className="max-w-4xl mx-auto px-4 py-12">
                  <div
                    className="prose prose-sm sm:prose max-w-none
                      [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-4
                      [&_p]:text-muted-foreground [&_p]:leading-relaxed
                      [&_img]:rounded-xl [&_img]:shadow-md"
                    dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(currentPage.content) }}
                  />
                </section>
              ) : null,

              features: showFeatures && features.length > 0 ? (
                <section ref={animateRef} className="max-w-6xl mx-auto px-4 py-16 sm:py-20 scroll-animate opacity-0 translate-y-6">
                  <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-foreground mb-3">{featuresTitle}</h2>
                    <p className="text-muted-foreground max-w-xl mx-auto">{featuresSubtitle}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((f, i) => {
                      const Icon = iconMap[f.icon] || Star;
                      return (
                        <Card key={i} className="border border-[#fecaca]/30 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#7dd3fc]/50 transition-all duration-300 rounded-3xl bg-white/90 group" style={{ animationDelay: `${i * 100}ms` }}>
                          <CardContent className="p-6">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                              <Icon className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="font-semibold text-foreground text-lg mb-2">{f.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              ) : null,

              cta: showCta ? (
                <section ref={animateRef} className="py-16 scroll-animate opacity-0 translate-y-6">
                  <div className="max-w-4xl mx-auto px-4">
                    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#fecaca] via-[#f9a8a8] to-[#7dd3fc] p-10 sm:p-14 text-center shadow-2xl shadow-[#f9a8a8]/30">
                      <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
                      <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-white/20 blur-3xl" />
                      <div className="relative">
                        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4 drop-shadow-sm">{ctaTitle}</h2>
                        <p className="text-white/90 mb-8 max-w-xl mx-auto">{ctaSubtitle}</p>
                        <Link to={ctaButtonUrl}>
                          <Button size="lg" className="rounded-full font-bold px-10 h-12 text-base bg-white text-[#f9a8a8] hover:bg-white/90 shadow-xl hover:scale-105 transition-transform">
                            {ctaButtonText}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null,

              news: newsPosts.length > 0 ? (
                <section ref={animateRef} className="max-w-6xl mx-auto px-4 py-16 scroll-animate opacity-0 translate-y-6">
                  <div className="flex items-end justify-between mb-8 flex-wrap gap-2">
                    <div>
                      <h2 className="text-3xl font-bold text-foreground mb-2">ข่าวสารและประกาศ</h2>
                      <p className="text-sm text-muted-foreground">ข่าวล่าสุดจากโรงเรียน</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {newsPosts.slice(0, 6).map((n) => (
                      <Link key={n.id} to={`/dashboard/news/${n.id}`} className="group">
                        <Card className="h-full border border-[#fecaca]/30 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#7dd3fc]/50 transition-all duration-300 rounded-3xl bg-white/90">
                          <CardContent className="p-5">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              {n.is_pinned && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">📌 ปักหมุด</span>}
                              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{n.category}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(n.published_at || n.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            </div>
                            <h3 className="font-semibold text-foreground text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">{n.title}</h3>
                            {n.content && (
                              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3"
                                 dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(n.content.replace(/<[^>]+>/g, " ").slice(0, 180)) }} />
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null,

              social: socialFeedEnabled ? (
                <section ref={animateRef} className="max-w-6xl mx-auto px-4 py-16 scroll-animate opacity-0 translate-y-6">
                  <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
                    <div>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 text-xs font-medium mb-3">
                        <Facebook className="h-3.5 w-3.5" />
                        Facebook Page
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-2 tracking-tight">Social Wall</h2>
                      <p className="text-sm text-muted-foreground max-w-xl">
                        โพสต์ล่าสุดจากเพจ Facebook ของโรงเรียน — อัปเดตอัตโนมัติทุก 15 นาที
                      </p>
                    </div>
                  </div>
                  <SocialWallWidget title="" variant="bare" />
                </section>
              ) : null,

              embed: showCustomEmbed && customEmbedCode ? (
                <section className="max-w-6xl mx-auto px-4 py-8">
                  <EmbedRenderer html={customEmbedCode} className="w-full border-0 rounded-xl" />
                </section>
              ) : null,
            };

            return <>{order.map(key => <div key={key}>{sectionMap[key]}</div>)}</>;
          })()}

        </>
      ) : (
        <main className="flex-1 w-full">
          {currentPage ? (
            currentPage.content && isFullHtml(currentPage.content) ? (
              <EmbedRenderer html={currentPage.content} className="w-full border-0" />
            ) : (
              <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <h1 className="text-3xl font-bold text-foreground mb-8">{currentPage.title}</h1>
                <div
                  className="prose prose-sm sm:prose max-w-none
                    [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:mb-4
                    [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground
                    [&_p]:text-muted-foreground [&_p]:leading-relaxed
                    [&_img]:rounded-xl [&_img]:shadow-md [&_img]:my-6
                    [&_ul]:text-muted-foreground [&_ol]:text-muted-foreground
                    [&_iframe]:w-full [&_iframe]:rounded-xl"
                  dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(currentPage.content) }}
                />
              </article>
            )
          ) : (
            <div className="text-center py-20 text-muted-foreground">ไม่พบหน้าที่ต้องการ</div>
          )}
        </main>
      )}

      {/* Footer */}
      {showFooter && (
      <footer className="bg-foreground/[0.03] border-t border-border mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                {footerLogo ? (
                  <img src={footerLogo} alt={footerName} className="w-9 h-9 rounded-lg object-contain" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                <span className="font-bold text-foreground text-lg">{footerName}</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{footerDescription}</p>
              {(socialFacebook || socialLine) && (
                <div className="flex gap-3 mt-4">
                  {socialFacebook && (
                    <a href={socialFacebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {socialLine && (
                    <a href={socialLine} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors text-sm font-bold">
                      LINE
                    </a>
                  )}
                </div>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">เมนู</h3>
              <ul className="space-y-2">
                {menuItems.map(item => (
                  <li key={item.id}>
                    <Link to={item.url || "/"} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-4">ติดต่อเรา</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                {schoolAddress && <div className="flex items-start gap-2.5"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-primary" />{schoolAddress}</div>}
                {schoolPhone && <div className="flex items-center gap-2.5"><Phone className="w-4 h-4 shrink-0 text-primary" />{schoolPhone}</div>}
                {schoolEmail && <div className="flex items-center gap-2.5"><Mail className="w-4 h-4 shrink-0 text-primary" />{schoolEmail}</div>}
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-10 pt-6 text-center text-xs text-muted-foreground">
            {footerCopyright || `© ${new Date().getFullYear() + BE_OFFSET} ${footerName || schoolName}. All rights reserved.`}
          </div>
        </div>
      </footer>
      )}
      <CreditFooter />
    </div>
  );
};

export default Index;
