import { isAuthorizedCron, unauthorized } from "../_shared/cronAuth.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (!(await isAuthorizedCron(req))) return unauthorized();

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find events happening tomorrow that haven't been notified yet
    const { data: events, error: eventsError } = await supabaseAdmin
      .from("academic_events")
      .select("*")
      .eq("event_date", tomorrowStr)
      .eq("is_notified", false);

    if (eventsError) {
      console.error("Error fetching events:", eventsError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming events to notify", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also check for multi-day events that start tomorrow
    const { data: multiDayEvents } = await supabaseAdmin
      .from("academic_events")
      .select("*")
      .lte("event_date", tomorrowStr)
      .gte("end_date", tomorrowStr)
      .eq("is_notified", false);

    const allEvents = [...(events || []), ...(multiDayEvents || [])];
    const uniqueEvents = allEvents.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);

    // Get active webhooks for academic notifications
    const { data: webhooks } = await supabaseAdmin
      .from("google_chat_webhooks")
      .select("*")
      .eq("is_active", true);

    if (!webhooks || webhooks.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active webhooks configured", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const typeLabels: Record<string, string> = {
      activity: "🎯 กิจกรรม",
      exam: "📝 สอบ",
      meeting: "🤝 ประชุม",
      holiday: "🏖️ วันหยุด",
      ceremony: "🎓 พิธีการ",
      training: "📚 อบรม/สัมมนา",
      other: "📌 อื่นๆ",
    };

    // Send notification for each event
    let notifiedCount = 0;
    for (const event of uniqueEvents) {
      const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });

      const typeLabel = typeLabels[event.event_type] || "📌 กิจกรรม";
      let message = `🔔 *แจ้งเตือนกิจกรรมพรุ่งนี้*\n\n`;
      message += `${typeLabel}: *${event.title}*\n`;
      message += `📅 วันที่: ${dateLabel}\n`;
      if (event.location) message += `📍 สถานที่: ${event.location}\n`;
      if (event.end_date && event.end_date !== event.event_date) {
        const endLabel = new Date(event.end_date + "T00:00:00").toLocaleDateString("th-TH", {
          day: "numeric", month: "long",
        });
        message += `➡️ ถึงวันที่: ${endLabel}\n`;
      }
      if (event.description) message += `\n📝 ${event.description}`;

      // Send to all active webhooks
      const results = await Promise.allSettled(
        webhooks.map(async (webhook: any) => {
          const response = await fetch(webhook.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json; charset=UTF-8" },
            body: JSON.stringify({ text: message }),
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }
        })
      );

      const sent = results.filter(r => r.status === "fulfilled").length;
      if (sent > 0) {
        // Mark as notified
        await supabaseAdmin
          .from("academic_events")
          .update({ is_notified: true })
          .eq("id", event.id);
        notifiedCount++;
      }
    }

    return new Response(
      JSON.stringify({ message: "Event notifications processed", notified: notifiedCount }),
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
