import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

type Severity = "info" | "success" | "warning" | "critical";

const SEVERITY_META: Record<Severity, { icon: string; emoji: string; color: string; label: string }> = {
  info:     { icon: "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/info/default/48px.svg",          emoji: "ℹ️", color: "#6366F1", label: "ข้อมูล" },
  success:  { icon: "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/check_circle/default/48px.svg", emoji: "✅", color: "#10B981", label: "สำเร็จ" },
  warning:  { icon: "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/warning/default/48px.svg",      emoji: "⚠️", color: "#F59E0B", label: "ควรระวัง" },
  critical: { icon: "https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/emergency_home/default/48px.svg", emoji: "🚨", color: "#EF4444", label: "เร่งด่วน" },
};

const TYPE_ICONS: Record<string, string> = {
  attendance_absent: "EVENT_SEAT",
  attendance: "EVENT_AVAILABLE",
  score: "STAR",
  eform: "DESCRIPTION",
  document: "DESCRIPTION",
  news: "BOOKMARK",
  emergency: "AIRPORT_SHUTTLE",
  staff_leave: "AIRPLANEMODE_ACTIVE",
  staff_leave_approved: "AIRPLANEMODE_ACTIVE",
  student_leave: "AIRPLANEMODE_ACTIVE",
  substitute: "MULTIPLE_PEOPLE",
  face_scan: "CAMERA",
  garbage: "TICKET",
  ict_loan: "INVITE",
};

function hexToRgb(hex: string) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function nowBangkok() {
  const d = new Date();
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(d);
}

function buildCardV2(opts: {
  title: string;
  message: string;
  severity: Severity;
  notificationType?: string;
  fields?: Record<string, string> | null;
  url?: string | null;
  imageUrl?: string | null;
  prefix?: string;
}) {
  const meta = SEVERITY_META[opts.severity] ?? SEVERITY_META.info;
  const rgb = hexToRgb(meta.color);
  const typeIcon = (opts.notificationType && TYPE_ICONS[opts.notificationType]) || "BOOKMARK";
  const sections: any[] = [];

  // Section 1: Severity chip + message body
  const headWidgets: any[] = [
    {
      decoratedText: {
        startIcon: { knownIcon: typeIcon },
        topLabel: `${meta.emoji} ${meta.label}`,
        text: `<b>${opts.title}</b>`,
        bottomLabel: nowBangkok(),
        wrapText: true,
      },
    },
  ];
  if (opts.message && opts.message.trim().length > 0) {
    headWidgets.push({ textParagraph: { text: opts.message.replace(/\n/g, "<br>") } });
  }
  sections.push({ widgets: headWidgets });

  // Section: Image (if any) — full-width preview
  if (opts.imageUrl) {
    sections.push({
      widgets: [
        {
          image: {
            imageUrl: opts.imageUrl,
            ...(opts.url ? { onClick: { openLink: { url: opts.url } } } : {}),
          },
        },
      ],
    });
  }



  // Section 2: Details grid (if any)
  if (opts.fields && Object.keys(opts.fields).length > 0) {
    const items = Object.entries(opts.fields).filter(
      ([_, v]) => v !== null && v !== undefined && String(v).length > 0,
    );
    if (items.length > 0) {
      sections.push({
        header: "รายละเอียด",
        collapsible: items.length > 4,
        uncollapsibleWidgetsCount: 4,
        widgets: items.map(([k, v]) => ({
          decoratedText: {
            startIcon: { knownIcon: "BOOKMARK" },
            topLabel: k,
            text: `<b>${v}</b>`,
            wrapText: true,
          },
        })),
      });
    }
  }

  // Section 3: Action button
  if (opts.url) {
    sections.push({
      widgets: [
        {
          buttonList: {
            buttons: [
              {
                text: "🔎 เปิดดูในระบบ",
                onClick: { openLink: { url: opts.url } },
                color: rgb,
              },
            ],
          },
        },
      ],
    });
  }

  const prefix = opts.prefix ? `${opts.prefix}\n` : "";
  return {
    text: `${prefix}${meta.emoji} *${opts.title}*`,
    cardsV2: [
      {
        cardId: `card_${Date.now()}`,
        card: {
          header: {
            title: opts.title,
            subtitle: `${meta.label}${opts.notificationType ? ` • ${opts.notificationType}` : ""} • Smart School`,
            imageUrl: meta.icon,
            imageType: "CIRCLE",
          },
          sections,
        },
      },
    ],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      message,
      title,
      department,
      notification_type,
      severity = "info",
      url,
      image_url,
      fields,
      reference_table,
      reference_id,
    } = body;

    if (!message && !title) {
      return new Response(JSON.stringify({ error: "message or title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve absolute public site URL — Google Chat button requires https:// and
    // we don't want links pointing at the preview/lovableproject domain.
    async function resolvePublicSiteUrl(): Promise<string> {
      const { data } = await supabaseAdmin
        .from("school_settings")
        .select("setting_value")
        .eq("setting_key", "site_url")
        .maybeSingle();
      const configured = (data?.setting_value || "").trim();
      if (configured) return configured.replace(/\/+$/, "");
      const { getPublicOrigin } = await import("../_shared/appConfig.ts");
      return await getPublicOrigin();
    }

    function toAbsolute(raw: string | null | undefined, base: string): string | null {
      if (!raw) return null;
      const s = String(raw).trim();
      if (!s) return null;
      // Replace preview/lovableproject/localhost origins with the public site
      const previewRe = /^https?:\/\/[^/]*(lovableproject\.com|lovable\.app\/preview|localhost(:\d+)?)/i;
      if (previewRe.test(s)) {
        try {
          const u = new URL(s);
          // Skip published domain
          if (!/bngss\.lovable\.app/i.test(u.host)) {
            return `${base}${u.pathname}${u.search}${u.hash}`;
          }
        } catch { /* fallthrough */ }
      }
      if (/^https?:\/\//i.test(s)) return s;
      if (s.startsWith("/")) return `${base}${s}`;
      return `${base}/${s}`;
    }

    const siteBase = await resolvePublicSiteUrl();
    const absUrl = toAbsolute(url, siteBase);
    const absImage = toAbsolute(image_url, siteBase);


    let query = supabaseAdmin.from("google_chat_webhooks").select("*").eq("is_active", true);
    if (department && department !== "all") {
      // .in() avoids PostgREST filter-string injection that .or(`...${user}...`) would expose
      query = query.in("department", [String(department), "all"]);
    }

    const { data: webhooks, error } = await query;

    if (error) {
      console.error("Error fetching webhooks:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch webhooks" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response(JSON.stringify({ message: "No active webhooks", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const filtered = notification_type
      ? webhooks.filter((w: any) => {
          const types = w.notification_types || [];
          return types.length === 0 || types.includes(notification_type);
        })
      : webhooks;

    if (filtered.length === 0) {
      return new Response(JSON.stringify({ message: "No webhooks for this notification type", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sev: Severity = (["info","success","warning","critical"].includes(severity) ? severity : "info") as Severity;
    const finalTitle = title || (message || "").split("\n")[0] || "การแจ้งเตือน";
    const finalBody = title ? (message || "") : (message || "").split("\n").slice(1).join("\n");

    const results = await Promise.allSettled(
      filtered.map(async (webhook: any) => {
        const customMessages = webhook.custom_messages || {};
        const prefix = notification_type && customMessages[notification_type] ? customMessages[notification_type] : "";

        const payload = buildCardV2({
          title: finalTitle,
          message: finalBody,
          severity: sev,
          notificationType: notification_type,
          fields: fields || null,
          url: absUrl,
          imageUrl: absImage,
          prefix,
        });


        let httpStatus = 0;
        let errorText: string | null = null;
        try {
          const response = await fetch(webhook.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify(payload),
          });
          httpStatus = response.status;
          if (!response.ok) {
            errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
          // Log success
          await supabaseAdmin.from("google_chat_logs").insert({
            webhook_id: webhook.id,
            notification_type,
            department: webhook.department,
            title: finalTitle,
            message: finalBody,
            payload,
            status: "sent",
            http_status: httpStatus,
            reference_table: reference_table || null,
            reference_id: reference_id || null,
          });
          return { webhook_id: webhook.id, status: "sent" };
        } catch (err: any) {
          await supabaseAdmin.from("google_chat_logs").insert({
            webhook_id: webhook.id,
            notification_type,
            department: webhook.department,
            title: finalTitle,
            message: finalBody,
            payload,
            status: "failed",
            http_status: httpStatus || null,
            error_text: errorText || err.message,
            reference_table: reference_table || null,
            reference_id: reference_id || null,
          });
          throw err;
        }
      }),
    );

    const sent = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    return new Response(JSON.stringify({ message: "Notifications processed", sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
