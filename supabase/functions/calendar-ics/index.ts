import { authorizeCaller, ADMIN_ROLES, STAFF_ROLES } from "../_shared/callerAuth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { readAllRows } from "../_shared/readAllRows.ts";

function pad(n: number) { return String(n).padStart(2, '0'); }
function toIcsDate(dateStr: string, allDay = true): string {
  const d = new Date(dateStr);
  if (allDay) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}
function escapeIcs(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const __caller = await authorizeCaller(req, corsHeaders, { roles: [] });
  if (__caller instanceof Response) return __caller;

  try {
    // User-scoped RLS is authoritative, including the restrictive school policy.
    if (__caller.kind !== 'user') return new Response(null, { status: 403, headers: corsHeaders });
    const url = Deno.env.get('SUPABASE_URL'), key = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('configuration unavailable');
    const supabase = createClient(url, key, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const events = await readAllRows<any>((from, to) => supabase.from('academic_events').select('*').order('event_date').order('id').range(from, to));

    const now = new Date();
    const dtstamp = toIcsDate(now.toISOString(), false);

    let ics = 'BEGIN:VCALENDAR\r\n';
    ics += 'VERSION:2.0\r\n';
    ics += 'PRODID:-//Smart School//Academic Calendar//TH\r\n';
    ics += 'CALSCALE:GREGORIAN\r\n';
    ics += 'METHOD:PUBLISH\r\n';
    ics += 'X-WR-CALNAME:ปฏิทินวิชาการโรงเรียน\r\n';
    ics += 'X-WR-TIMEZONE:Asia/Bangkok\r\n';

    for (const ev of (events || [])) {
      const start = toIcsDate(ev.event_date, true);
      const endRaw = ev.end_date ? new Date(ev.end_date) : new Date(ev.event_date);
      endRaw.setUTCDate(endRaw.getUTCDate() + 1); // ICS DTEND for all-day is exclusive
      const end = toIcsDate(endRaw.toISOString(), true);

      ics += 'BEGIN:VEVENT\r\n';
      ics += `UID:${ev.id}@smartschool\r\n`;
      ics += `DTSTAMP:${dtstamp}\r\n`;
      ics += `DTSTART;VALUE=DATE:${start}\r\n`;
      ics += `DTEND;VALUE=DATE:${end}\r\n`;
      ics += `SUMMARY:${escapeIcs(ev.title)}\r\n`;
      if (ev.description) ics += `DESCRIPTION:${escapeIcs(ev.description)}\r\n`;
      if (ev.location) ics += `LOCATION:${escapeIcs(ev.location)}\r\n`;
      ics += `CATEGORIES:${escapeIcs(ev.event_type || 'activity')}\r\n`;
      ics += 'END:VEVENT\r\n';
    }

    ics += 'END:VCALENDAR\r\n';

    return new Response(ics, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="school-calendar.ics"',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
