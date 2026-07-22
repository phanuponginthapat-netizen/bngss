import { ReactNode } from "react";
import PublicNavbar from "./PublicNavbar";
import CreditFooter from "@/components/CreditFooter";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Link } from "react-router-dom";

interface Props {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: ReactNode;
  cover?: string;
}

export default function PublicPageLayout({ title, subtitle, breadcrumbs, children, cover }: Props) {
  const { settings } = useSystemSettings();
  return (
    <div className="min-h-screen bg-[#fffaf5]">
      {/* decorative blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-orange-200/40 blur-3xl" />
      </div>

      <PublicNavbar />

      {title && (
        <section
          className="relative border-b border-border/40 bg-gradient-to-br from-primary/10 via-background to-orange-100/30"
          style={cover ? { backgroundImage: `linear-gradient(to bottom right, hsl(var(--primary)/0.7), hsl(var(--primary)/0.85)), url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
            {breadcrumbs && (
              <nav className={`mb-3 flex flex-wrap items-center gap-1 text-xs ${cover ? "text-white/85" : "text-muted-foreground"}`}>
                <Link to="/" className="hover:underline">หน้าแรก</Link>
                {breadcrumbs.map((b, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span>/</span>
                    {b.href ? <Link to={b.href} className="hover:underline">{b.label}</Link> : <span>{b.label}</span>}
                  </span>
                ))}
              </nav>
            )}
            <h1 className={`font-outfit text-3xl font-bold sm:text-5xl ${cover ? "text-white" : "text-foreground"}`}>{title}</h1>
            {subtitle && <p className={`mt-2 text-base sm:text-lg ${cover ? "text-white/90" : "text-muted-foreground"}`}>{subtitle}</p>}
          </div>
        </section>
      )}

      <main className="mx-auto max-w-7xl px-4 py-10 sm:py-14">{children}</main>

      <footer className="border-t border-border/40 bg-background/60 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {settings?.school_name || "โรงเรียน"} · สงวนลิขสิทธิ์
        </div>
        <CreditFooter />
      </footer>
    </div>
  );
}
