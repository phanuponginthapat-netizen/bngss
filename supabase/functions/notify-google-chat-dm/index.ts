// Personal Google Chat DM notifications (Google Workspace only) — the LINE OA equivalent.
// Resolves each user's Workspace email (profiles.google_email, else auth email) and sends
// a cardsV2 message into the 1:1 DM space.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { gchatDmConfigured, sendChatDm } from "../_shared/googleChatDm.ts";

type Severity = "info" | "success" | "warning" | "critical";

const SEVERITY_META: Record<Severity, { emoji: string; color: string; label: string }> = {
  info: { emoji: "ℹ️", color: "#6366F1", label: "ข้อมูล" },
  success: { emoji: "✅", color: "#10B981", label: "สำเร็จ" },
  warning: { emoji: "⚠️", color: "#F59E0B", label: "ควรระวัง" },
  critical: { emoji: "🚨", color: "#EF4444", label: "เร่งด่วน" },
};

function hexToRgb(hex: string) {
  return {
    red: parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function nowBangkok() {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date());
}

function buildCard(opts: {
  title: string;
  message: string;
  severity: Severity;
  fields?: Record<string, string> | null;
  url?: string | null;
  imageUrl?: string | null;
  notificationType?: string;
}) {
  const meta = SEVERITY_META[opts.severity] ?? SEVERITY_META.info;
  const sections: any[] = [
    {
      widgets: [
        {
          decoratedText: {
            topLabel: `${meta.emoji} ${meta.label}`,
            text: `<b>${opts.title}</b>`,
            bottomLabel: nowBangkok(),
            wrapText: true,
          },
        },
        ...(opts.message?.trim()
          ? [{ textParagraph: { text: opts.message.replace(/\n/g, "<br>") } }]
          : []),
      ],
    },
  ];

  if (opts.imageUrl) {
    sections.push({ widgets: [{ image: { imageUrl: opts.imageUrl } }] });
  }

  const fieldEntries = Object.entries(opts.fields || {}).filter(
    ([, v]) => v !== null && v !== undefined && String(v).length > 0,
  );
  if (fieldEntries.length > 0) {
    sections.push({
      header: "รายละเอียด",
      collapsible: fieldEntries.length > 4,
      uncollapsibleWidgetsCount: 4,
      widgets: fieldEntries.map(([k, v]) => ({
        decoratedText: { topLabel: k, text: `<b>${v}</b>`, wrapText: true },
      })),
    });
  }

  if (opts.url) {
    sections.push({
      widgets: [{
        buttonList: {
          buttons: [{
            text: "🔎 เปิดดูในระบบ",
            onClick: { openLink: { url: opts.url } },
            color: hexToRgb(meta.color),
          }],
        },
      }],
    });
  }

  return {
    text: `${meta.emoji} *${opts.title}*`,
    cardsV2: [{
      cardId: `dm_${Date.now()}`,
      card: {
        header: {
          title: opts.title,
          subtitle: `${meta.label}${opts.notificationType ? ` • ${opts.notificationType}` : ""} • Smart School`,
        },
        sections,
      },
    }],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!gchatDmConfigured()) {
      return json({ message: "Google Chat DM not configured", sent: 0, skipped: true });
    }

    const body = await req.json();
    const {
      user_ids = [],
      emails = [],
      title,
      message = "",
      severity = "info",
      notification_type,
      url,
      image_url,
      fields,
    } = body ?? {};

    if (!title && !message) return json({ error: "title or message is required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const domain = (Deno.env.get("GOOGLE_CHAT_WORKSPACE_DOMAIN") || "").trim().toLowerCase();
    const targets = new Set<string>(
      (emails as string[]).map((e) => String(e).trim().toLowerCase()).filter(Boolean),
    );

    const ids = [...new Set((user_ids as string[]).filter(Boolean))];
    if (ids.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id,google_email")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p.google_email]));
      for (const id of ids) {
        let email = (byId.get(id) || "").trim?.() || "";
        if (!email) {
          try {
            const { data } = await admin.auth.admin.getUserById(id);
            email = data?.user?.email || "";
          } catch (_) { /* ignore */ }
        }
        email = email.toLowerCase();
        if (email) targets.add(email);
      }
    }

    // Workspace-only: Chat DMs cannot reach consumer @gmail.com accounts.
    const recipients = [...targets].filter((e) => {
      if (e.endsWith("@gmail.com") || e.endsWith("@googlemail.com")) return false;
      return domain ? e.endsWith(`@${domain}`) : true;
    });

    if (recipients.length === 0) return json({ message: "No Workspace recipients", sent: 0 });

    const sev: Severity = (["info", "success", "warning", "critical"].includes(severity)
      ? severity
      : "info") as Severity;
    const payload = buildCard({
      title: title || String(message).split("\n")[0],
      message: title ? String(message) : String(message).split("\n").slice(1).join("\n"),
      severity: sev,
      fields: fields || null,
      url: url || null,
      imageUrl: image_url || null,
      notificationType: notification_type,
    });

    const results = await Promise.allSettled(recipients.map((e) => sendChatDm(e, payload)));
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failures = results
      .map((r, i) => (r.status === "rejected" ? `${recipients[i]}: ${r.reason?.message ?? r.reason}` : null))
      .filter(Boolean);
    if (failures.length) console.error("gchat-dm failures:", failures.join(" | "));

    return json({ message: "Google Chat DMs processed", sent, failed: failures.length });
  } catch (err: any) {
    console.error("notify-google-chat-dm error:", err?.message);
    return json({ error: err?.message || String(err) }, 500);
  }
});
