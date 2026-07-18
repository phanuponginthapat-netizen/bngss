import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireCronOrAdmin } from "../_shared/requireCron.ts";
import { corsHeadersWithCron as corsHeaders } from "../_shared/cors.ts";
import { makeAdmin } from "../_shared/supabaseAdmin.ts";
import { notifyGChat } from "../_shared/fanout.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const denied = await requireCronOrAdmin(req, corsHeaders);
  if (denied) return denied;

  try {
    const supabaseAdmin = makeAdmin();

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

    const typeLabels: Record<string, string> = {
      activity: "🎯 กิจกรรม",
      exam: "📝 สอบ",
      meeting: "🤝 ประชุม",
      holiday: "🏖️ วันหยุด",
      ceremony: "🎓 พิธีการ",
      training: "📚 อบรม/สัมมนา",
      other: "📌 อื่นๆ",
    };

    // Route through notify-google-chat so cards use proper templates,
    // respect per-webhook notification_types filter, and log to google_chat_logs.
    const projectId = Deno.env.get("SUPABASE_PROJECT_ID");
    const siteUrl = projectId ? `https://${projectId}.lovableproject.com` : "https://bngss.lovable.app";
    let notifiedCount = 0;

    for (const event of uniqueEvents) {
      const dateLabel = new Date(event.event_date + "T00:00:00").toLocaleDateString("th-TH", {
        year: "numeric", month: "long", day: "numeric", weekday: "long",
      });
      const typeLabel = typeLabels[event.event_type] || "📌 กิจกรรม";
      const fields: Record<string, string> = { "ประเภท": typeLabel, "วันที่": dateLabel };
      if (event.location) fields["สถานที่"] = event.location;
      if (event.end_date && event.end_date !== event.event_date) {
        fields["ถึงวันที่"] = new Date(event.end_date + "T00:00:00").toLocaleDateString("th-TH", {
          day: "numeric", month: "long", year: "numeric",
        });
      }

      const { ok, data: result } = await notifyGChat({
        title: `🔔 แจ้งเตือนกิจกรรมพรุ่งนี้: ${event.title}`,
        message: event.description || "",
        notification_type: "event",
        severity: event.event_type === "exam" ? "warning" : "info",
        fields,
        url: `${siteUrl}/dashboard/calendar`,
        reference_table: "academic_events",
        reference_id: event.id,
      });
      if (ok && (result?.sent ?? 0) > 0) {
        await supabaseAdmin.from("academic_events").update({ is_notified: true }).eq("id", event.id);
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
