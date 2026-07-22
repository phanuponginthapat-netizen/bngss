import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { getSetting as getLineSetting, pushMessage, multicastMessage, broadcastMessage } from "../_shared/lineApi.ts";

function addLineUserIds(target: Set<string>, values: Array<string | null | undefined>) {
  values.forEach((value) => {
    if (typeof value === "string" && value.trim()) target.add(value.trim());
  });
}


// ============ MESSAGE BUILDERS ============

function buildTextMessage(text: string): any {
  return { type: "text", text };
}

function buildFlexNotification(
  title: string,
  body: string,
  severity?: string,
  action?: { label: string; uri: string },
): any {
  const colorMap: Record<string, string> = {
    critical: "#D63031",
    high: "#E17055",
    warning: "#FDCB6E",
    info: "#0984E3",
    success: "#00B894",
  };
  const color = colorMap[severity || "info"] || "#0984E3";

  const bubble: any = {
    type: "bubble",
    header: {
      type: "box", layout: "vertical", backgroundColor: color,
      contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md", wrap: true }],
    },
    body: {
      type: "box", layout: "vertical",
      contents: [{ type: "text", text: body, size: "sm", color: "#333333", wrap: true }],
    },
  };

  if (action?.uri) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        {
          type: "button",
          style: "primary",
          color,
          action: { type: "uri", label: action.label.slice(0, 40), uri: action.uri },
        },
      ],
    };
  }

  return { type: "flex", altText: title, contents: bubble };
}

// ============ SERVE ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      message,
      broadcast,
      user_ids,
      student_ids,
      line_user_ids,
      roles,
      classroom_ids,
      notification_type,
      severity,
      title,
      use_flex,
      action_url,
      action_label,
      image_url,
    } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = makeAdmin();

    const enabled = await getLineSetting(supabaseAdmin, "line_notify_enabled");
    if (enabled !== "true") {
      return new Response(
        JSON.stringify({ message: "LINE notifications are disabled", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = await getLineSetting(supabaseAdmin, "line_channel_access_token");
    if (!token) {
      return new Response(
        JSON.stringify({ error: "LINE Channel Access Token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build message (Flex or text)
    // Normalize action_url: LINE requires absolute https:// URI. Prepend site_url if relative.
    let normalizedActionUrl: string | undefined = undefined;
    if (typeof action_url === "string" && action_url.trim()) {
      const raw = action_url.trim();
      if (/^https:\/\//i.test(raw)) {
        normalizedActionUrl = raw;
      } else if (/^http:\/\//i.test(raw)) {
        // LINE rejects http; upgrade to https
        normalizedActionUrl = raw.replace(/^http:\/\//i, "https://");
      } else {
        const { getPublicOrigin } = await import("../_shared/appConfig.ts");
        const siteUrl =
          (await getLineSetting(supabaseAdmin, "site_url")) ||
          (await getPublicOrigin());
        const base = siteUrl.replace(/\/+$/, "");
        const path = raw.startsWith("/") ? raw : `/${raw}`;
        normalizedActionUrl = `${base}${path}`;
      }
    }

    const action = normalizedActionUrl
      ? { label: action_label || "เปิดดูรายงาน", uri: normalizedActionUrl }
      : undefined;
    const textWithLink = action?.uri ? `${message}\n\n🔗 ${action.label}: ${action.uri}` : message;
    const messages: any[] = use_flex && title
      ? [buildFlexNotification(title, message, severity, action)]
      : [buildTextMessage(textWithLink)];


    // Attach image if provided (LINE requires https URL, not data URL)
    if (image_url && typeof image_url === "string" && image_url.startsWith("https://")) {
      messages.push({
        type: "image",
        originalContentUrl: image_url,
        previewImageUrl: image_url,
      });
    }

    // Broadcast to all followers
    if (broadcast) {
      await broadcastMessage(token, messages);
      return new Response(
        JSON.stringify({ message: "Broadcast sent", sent: 1 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lineUserIds = new Set<string>();
    let sent = 0;
    let failed = 0;

    // Direct LINE user IDs (e.g. student.line_user_id_1/2/3 from DB triggers)
    if (line_user_ids && Array.isArray(line_user_ids)) {
      for (const uid of line_user_ids) {
        if (typeof uid === "string" && uid.trim()) lineUserIds.add(uid.trim());
      }
    }

    // Collect LINE user IDs from various sources

    // From auth user IDs
    if (user_ids && Array.isArray(user_ids) && user_ids.length > 0) {
      const uniqueUserIds = [...new Set(user_ids.filter((value: unknown) => typeof value === "string" && value.trim()))] as string[];
      if (uniqueUserIds.length > 0) {
        const [{ data: profiles }, { data: students }] = await Promise.all([
          supabaseAdmin
            .from("profiles")
            .select("line_user_id")
            .in("id", uniqueUserIds)
            .not("line_user_id", "is", null),
          supabaseAdmin
            .from("students")
            .select("line_user_id, line_user_id_2, line_user_id_3")
            .in("auth_user_id", uniqueUserIds),
        ]);

        profiles?.forEach((p: any) => addLineUserIds(lineUserIds, [p.line_user_id]));
        students?.forEach((s: any) => addLineUserIds(lineUserIds, [s.line_user_id, s.line_user_id_2, s.line_user_id_3]));
      }
    }

    // From student IDs
    if (student_ids && Array.isArray(student_ids) && student_ids.length > 0) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("line_user_id, line_user_id_2, line_user_id_3")
        .in("id", student_ids)
      students?.forEach((s: any) => addLineUserIds(lineUserIds, [s.line_user_id, s.line_user_id_2, s.line_user_id_3]));
    }

    // From roles
    if (roles && Array.isArray(roles) && roles.length > 0) {
      const { data: roleUsers } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", roles);

      if (roleUsers && roleUsers.length > 0) {
        const uids = roleUsers.map((r: any) => r.user_id);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("line_user_id")
          .in("id", uids)
          .not("line_user_id", "is", null);
        profiles?.forEach((p: any) => lineUserIds.add(p.line_user_id));
      }
    }

    // From classroom IDs — send to all students in those classrooms
    if (classroom_ids && Array.isArray(classroom_ids) && classroom_ids.length > 0) {
      const { data: students } = await supabaseAdmin
        .from("students")
        .select("line_user_id, line_user_id_2, line_user_id_3")
        .in("classroom_id", classroom_ids)
        .eq("status", "active");
      students?.forEach((s: any) => addLineUserIds(lineUserIds, [s.line_user_id, s.line_user_id_2, s.line_user_id_3]));
    }

    // Send using multicast (up to 500 per batch) or individual push
    const allIds = Array.from(lineUserIds);

    if (allIds.length === 0 && !broadcast) {
      return new Response(
        JSON.stringify({ message: "No LINE recipients found", sent: 0, failed: 0, total_recipients: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else if (allIds.length <= 500) {
      try {
        await multicastMessage(token, allIds, messages);
        sent = allIds.length;
      } catch (e) {
        console.error("Multicast failed, falling back to individual push:", e);
        // Fall back to individual push
        for (const uid of allIds) {
          try {
            await pushMessage(token, uid, messages);
            sent++;
          } catch (pushErr) {
            console.error(`Push failed for ${uid}:`, pushErr);
            failed++;
          }
        }
      }
    } else {
      // Batch multicast in groups of 500
      for (let i = 0; i < allIds.length; i += 500) {
        const batch = allIds.slice(i, i + 500);
        try {
          await multicastMessage(token, batch, messages);
          sent += batch.length;
        } catch (e) {
          console.error(`Multicast batch failed:`, e);
          failed += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "LINE notifications processed", sent, failed, total_recipients: allIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
