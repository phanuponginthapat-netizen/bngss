// School "tour guide" context: weather/air, personnel, curriculum, calendar, achievements
// Designed to be lightweight + cached. No PII (no phones/emails/IDs in output).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type Cached<T> = { at: number; data: T };
const TTL_SCHOOL = 5 * 60_000;   // 5 min
const TTL_WEATHER = 10 * 60_000; // 10 min
const TTL_GEOCODE = 24 * 3600_000; // 24h

let schoolCache: Cached<string> | null = null;
let weatherCache: Cached<string> | null = null;
const geoCache = new Map<string, Cached<{ lat: number; lon: number; name: string } | null>>();

function aqiCategory(pm25: number): string {
  if (pm25 <= 15) return "ดีมาก";
  if (pm25 <= 25) return "ดี";
  if (pm25 <= 37.5) return "ปานกลาง";
  if (pm25 <= 75) return "เริ่มมีผลต่อสุขภาพ";
  return "มีผลต่อสุขภาพ (อันตราย)";
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const key = query.trim().toLowerCase();
  const c = geoCache.get(key);
  if (c && Date.now() - c.at < TTL_GEOCODE) return c.data;
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=th&format=json`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j?.results?.[0];
    const data = hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
    geoCache.set(key, { at: Date.now(), data });
    return data;
  } catch { return null; }
}

export async function getWeatherAndAir(lat: number, lon: number): Promise<string> {
  if (weatherCache && Date.now() - weatherCache.at < TTL_WEATHER) return weatherCache.data;
  try {
    const wUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&timezone=Asia%2FBangkok&forecast_days=3`;
    const aUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,pm10,us_aqi&timezone=Asia%2FBangkok`;
    const [wr, ar] = await Promise.all([fetch(wUrl), fetch(aUrl)]);
    const w = wr.ok ? await wr.json() : null;
    const a = ar.ok ? await ar.json() : null;
    const cur = w?.current;
    const daily = w?.daily;
    const air = a?.current;
    const lines: string[] = [];
    if (cur) {
      lines.push(`อากาศปัจจุบัน: ${cur.temperature_2m}°C (รู้สึก ${cur.apparent_temperature}°C), ความชื้น ${cur.relative_humidity_2m}%, ลม ${cur.wind_speed_10m} กม./ชม., ฝน ${cur.precipitation} มม.`);
    }
    if (daily?.time?.length) {
      const days = daily.time.slice(0, 3).map((d: string, i: number) =>
        `${d}: ${daily.temperature_2m_min[i]}–${daily.temperature_2m_max[i]}°C, โอกาสฝน ${daily.precipitation_probability_max[i]}%`
      );
      lines.push(`พยากรณ์ 3 วัน:\n- ${days.join("\n- ")}`);
    }
    if (air) {
      lines.push(`คุณภาพอากาศ: PM2.5 = ${air.pm2_5} µg/m³ (${aqiCategory(air.pm2_5)}), PM10 = ${air.pm10} µg/m³, US AQI = ${air.us_aqi}`);
    }
    const out = lines.join("\n");
    weatherCache = { at: Date.now(), data: out };
    return out;
  } catch { return ""; }
}

export async function buildSchoolContext(supabaseUrl: string, serviceKey: string, address: string): Promise<string> {
  if (schoolCache && Date.now() - schoolCache.at < TTL_SCHOOL) return schoolCache.data;
  const sb = createClient(supabaseUrl, serviceKey);
  try {
    const [persRes, classRes, subjRes, evtRes, taRes, newsRes, schedRes] = await Promise.all([
      sb.from("personnel").select("id,first_name,last_name,prefix,position,subject_group,department,academic_standing,phone,email").eq("status", "active"),
      sb.from("classrooms").select("id,name,grade_level,homeroom_teacher,homeroom_teacher_2"),
      sb.from("subjects").select("id,code,name_th,grade_level,subject_type").limit(200),
      sb.from("academic_events").select("title,event_date,event_type,location").gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").limit(15),
      sb.from("teacher_assignments").select("personnel_id,subject_id,classroom_id"),
      sb.from("news_posts").select("title,category,published_at").eq("is_published", true).order("published_at", { ascending: false, nullsFirst: false }).limit(8),
      sb.from("schedules").select("teacher_id,day_of_week,period,start_time,end_time,subject_name_raw,subject_id,classroom_id,room").limit(2000),
    ]);

    const personnel = persRes.data || [];
    const classrooms = classRes.data || [];
    const subjects = subjRes.data || [];
    const events = evtRes.data || [];
    const news = newsRes.data || [];

    // Subject group distribution
    const groupCount: Record<string, number> = {};
    personnel.forEach((p: any) => {
      const g = p.subject_group || p.department || "อื่นๆ";
      groupCount[g] = (groupCount[g] || 0) + 1;
    });
    const groupList = Object.entries(groupCount).map(([g, n]) => `${g} (${n} คน)`).join(", ");

    // Build teacher -> subjects taught mapping (from teacher_assignments)
    const assignments = (taRes.data as any[]) || [];
    const subjectById = new Map<string, any>();
    subjects.forEach((s: any) => subjectById.set(s.id, s));
    const classroomById = new Map<string, any>();
    classrooms.forEach((c: any) => classroomById.set(c.id, c));
    const teacherSubjects = new Map<string, Set<string>>();
    const teacherClassrooms = new Map<string, Set<string>>();
    assignments.forEach((a: any) => {
      if (!a.personnel_id) return;
      if (a.subject_id) {
        const s = subjectById.get(a.subject_id);
        const name = s?.name_th;
        if (name) {
          if (!teacherSubjects.has(a.personnel_id)) teacherSubjects.set(a.personnel_id, new Set());
          teacherSubjects.get(a.personnel_id)!.add(name);
        }
      }
      if (a.classroom_id) {
        const c = classroomById.get(a.classroom_id);
        const name = c?.name;
        if (name) {
          if (!teacherClassrooms.has(a.personnel_id)) teacherClassrooms.set(a.personnel_id, new Set());
          teacherClassrooms.get(a.personnel_id)!.add(name);
        }
      }
    });

    // Schedule per teacher (day/period/subject/room) — work info, not PII
    const DAY_TH = ["อา","จ","อ","พ","พฤ","ศ","ส"];
    const schedules = (schedRes.data as any[]) || [];
    const teacherSchedule = new Map<string, string[]>();
    schedules.forEach((s: any) => {
      if (!s.teacher_id) return;
      const subName = s.subject_name_raw || subjectById.get(s.subject_id)?.name_th || "";
      const cls = classroomById.get(s.classroom_id)?.name || s.room || "";
      const day = DAY_TH[s.day_of_week] ?? `วัน${s.day_of_week}`;
      const time = s.start_time && s.end_time ? `${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}` : `คาบ${s.period ?? "?"}`;
      const line = `${day} ${time}${subName ? " " + subName : ""}${cls ? " @" + cls : ""}`;
      if (!teacherSchedule.has(s.teacher_id)) teacherSchedule.set(s.teacher_id, []);
      const arr = teacherSchedule.get(s.teacher_id)!;
      if (arr.length < 12) arr.push(line);
    });

    // Teacher list — รวมข้อมูลที่ครู/โรงเรียนใส่ไว้เปิดเผยได้ (ชื่อ ตำแหน่ง วิชาที่สอน ห้อง คาบ เบอร์/อีเมลที่ทำงาน)
    const teacherList = personnel.slice(0, 60).map((p: any) => {
      const subs = Array.from(teacherSubjects.get(p.id) || []);
      const cls = Array.from(teacherClassrooms.get(p.id) || []);
      const sch = teacherSchedule.get(p.id) || [];
      const contact = [p.phone ? `โทร ${p.phone}` : "", p.email ? `อีเมล ${p.email}` : ""].filter(Boolean).join(", ");
      return `- ${p.prefix || ""}${p.first_name} ${p.last_name}${p.position ? " — " + p.position : ""}${p.subject_group ? " (กลุ่มสาระ " + p.subject_group + ")" : ""}${subs.length ? " | สอน: " + subs.join(", ") : ""}${cls.length ? " | ห้อง: " + cls.join(", ") : ""}${contact ? " | ติดต่อ: " + contact : ""}${sch.length ? "\n    คาบสอน: " + sch.join("; ") : ""}`;
    }).join("\n");

    // Homeroom mapping
    const homerooms = classrooms.map((c: any) =>
      `- ${c.name} (${c.grade_level})${c.homeroom_teacher ? ": ครูประจำชั้น " + c.homeroom_teacher : ""}${c.homeroom_teacher_2 ? " และ " + c.homeroom_teacher_2 : ""}`
    ).join("\n");

    // Curriculum overview by grade
    const byGrade: Record<string, string[]> = {};
    subjects.forEach((s: any) => {
      const g = s.grade_level || "ทั่วไป";
      (byGrade[g] = byGrade[g] || []).push(s.name_th);
    });
    const curriculum = Object.entries(byGrade).slice(0, 10)
      .map(([g, arr]) => `- ${g}: ${arr.slice(0, 10).join(", ")}${arr.length > 10 ? "..." : ""}`).join("\n");

    // Academic calendar
    const calendar = events.map((e: any) =>
      `- ${e.event_date}: ${e.title}${e.event_type ? " [" + e.event_type + "]" : ""}${e.location ? " @ " + e.location : ""}`
    ).join("\n") || "(ยังไม่มีกิจกรรมที่กำหนด)";

    // Achievements (news posts ที่หมวด ผลงาน/รางวัล/ achievement)
    const achievements = news.filter((n: any) => /ผลงาน|รางวัล|achiev|award|แข่งขัน|ชนะ/i.test(`${n.category} ${n.title}`));
    const achievementText = achievements.length
      ? achievements.slice(0, 6).map((n: any) => `- ${n.title}`).join("\n")
      : "(ใช้ข่าวล่าสุดในระบบเป็นข้อมูลแทน)";
    const recentNews = news.slice(0, 6).map((n: any) => `- [${n.category}] ${n.title}`).join("\n");

    const out = `
[ข้อมูลโรงเรียน — เปิดเผยได้: ชื่อ-ตำแหน่ง-กลุ่มสาระ-วิชาที่สอน-คาบสอน-ห้องที่สอน-เบอร์โทร/อีเมลที่ทำงาน-ที่อยู่โรงเรียน-ปฏิทินกิจกรรม | ห้ามเปิดเผย: เลขบัตรประชาชน เงินเดือน รหัสผ่าน คะแนนสอบรายบุคคล ที่อยู่บ้าน เบอร์โทรส่วนตัวของนักเรียน/ผู้ปกครอง]
ที่อยู่: ${address}

บุคลากร (${personnel.length} คน) — แบ่งตามกลุ่มสาระ:
${groupList || "(ไม่มีข้อมูล)"}

รายชื่อครู/บุคลากรหลัก (บอกได้แค่ชื่อ-ตำแหน่ง-กลุ่มสาระ):
${teacherList || "(ไม่มีข้อมูล)"}

ห้องเรียนและครูประจำชั้น:
${homerooms || "(ไม่มีข้อมูล)"}

หลักสูตร/รายวิชา (${subjects.length} วิชา):
${curriculum || "(ไม่มีข้อมูล)"}

ปฏิทินวิชาการ (กิจกรรมที่จะถึง):
${calendar}

ผลงาน/รางวัลโรงเรียน:
${achievementText}

ข่าวล่าสุด:
${recentNews || "(ไม่มีข่าว)"}
`.trim();

    schoolCache = { at: Date.now(), data: out };
    return out;
  } catch {
    return "";
  }
}

export function shouldUseSchoolGuide(text: string): boolean {
  return /โรงเรียน|ครู|บุคลากร|วิชา|หลักสูตร|ตารางสอน|ตารางเรียน|ปฏิทิน|กิจกรรม|ผลงาน|รางวัล|ห้องเรียน|ประจำชั้น|ผอ|ผู้อำนวยการ|มัคคุเทศ|เยี่ยมชม|แนะนำ|ใครสอน|ใครเป็น|ใครคือ|รายชื่อ|มีกี่|กี่คน|มีใครบ้าง|สอนวิชา|สอนภาษา|สอนคณิต|สอนวิทย|สอนสังคม|สอนพละ|สอนศิลป|สอนดนตรี|สอนการงาน|สอนคอมพ์|สอนคอมพิวเตอร์|วิชาอะไร|เปิดสอน|tour|visit|principal|teacher|school|class/i.test(text);
}

export function shouldUseWeather(text: string): boolean {
  return /อากาศ|ฝน|ร้อน|หนาว|อุณหภูมิ|พยากรณ์|ฝุ่น|pm\s?2\.?5|pm25|pm10|aqi|คุณภาพอากาศ|มลพิษ|weather|forecast|rain|temperature|dust|air quality/i.test(text);
}
