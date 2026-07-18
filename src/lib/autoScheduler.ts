/**
 * Auto-scheduler algorithm for generating class timetables.
 * Rules:
 * 1. Distribute subjects by hours_per_week across days
 * 2. Prevent teacher time conflicts (same teacher can't teach 2 classes at same time)
 * 3. Activity subjects are locked to same day/period across ALL classrooms
 * 4. Admin can pre-configure which day/period each activity locks to
 * 5. Works WITHOUT teacher assignments — teachers are optional
 * 6. Balance: alternate core (hard) and skill (lighter) subjects to reduce fatigue
 * 7. Schedule demanding subjects in morning periods (early periods)
 * 8. Max 2 consecutive periods per subject per day
 * 9. No repeating same subject on same day (beyond the 2-period block)
 * 10. Prefer alternate-day spacing for each subject (day-on/day-off)
 * 11. Base (พื้นฐาน) and additional (เพิ่มเติม) subjects of same group on different days
 * 12. Cross-classroom distribution to avoid teacher conflicts
 */

export interface SubjectEntry {
  subject_id: string;
  classroom_id: string;
  subject_type: string;
  hours_per_week: number;
  personnel_id?: string | null;
  teacher_name?: string;
  subject_name?: string;
  subject_code?: string;
}

export interface ActivityLock {
  subject_id: string;
  day_of_week: number;
  start_period: number;
}

export interface ScheduleSlot {
  classroom_id: string;
  subject_id: string;
  day_of_week: number;
  period: number;
  teacher_name: string;
}

interface ExistingSchedule {
  classroom_id: string;
  day_of_week: number;
  period: number;
  teacher_name?: string;
  subject_id?: string;
}

// Core/academic subjects that need concentration — schedule in the morning
const CORE_SUBJECTS = ["required"];
// Lighter/skill subjects — schedule later or as alternation
const SKILL_SUBJECTS = ["elective", "activity"];

function isCoreDifficult(subjectType: string): boolean {
  return CORE_SUBJECTS.includes(subjectType);
}

/**
 * Extract subject group from name by removing variant suffixes.
 * e.g. "ภาษาอังกฤษพื้นฐาน 1", "ภาษาอังกฤษเพิ่มเติม 1",
 * and "ภาษาอังกฤษเพื่อการสื่อสาร 1" -> "ภาษาอังกฤษ"
 */
function getSubjectGroup(name: string): string {
  if (!name) return "";
  return name
    .replace(/พื้นฐาน/g, "")
    .replace(/เพิ่มเติม/g, "")
    .replace(/เพื่อการสื่อสาร/g, "")
    .replace(/\s*\d+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract subject category from code prefix, e.g. ว23102 -> ว, SCI101 -> SCI
 */
function getSubjectCategoryFromCode(code: string): string {
  if (!code) return "";
  const normalized = code.replace(/\s+/g, "").trim();
  const match = normalized.match(/^[A-Za-zก-ฮ]+/);
  return match?.[0]?.toUpperCase() || "";
}

function getTeacherCategoryKey(entry: SubjectEntry): string {
  const subjectCategory = getSubjectCategoryFromCode(entry.subject_code || "");
  const teacherIdentity = entry.personnel_id || entry.teacher_name?.trim();
  return teacherIdentity && subjectCategory ? `${teacherIdentity}:${subjectCategory}` : "";
}

/**
 * Check if a subject name is "base" (พื้นฐาน) type
 */
function isBaseSubject(name: string): boolean {
  return name?.includes("พื้นฐาน") || false;
}

/**
 * Check if a subject name is "additional" (เพิ่มเติม) type
 */
function isAdditionalSubject(name: string): boolean {
  return name?.includes("เพิ่มเติม") || false;
}

/**
 * Build subject entries from subjects + optional teacher assignments.
 */
export function buildSubjectEntries(
  classrooms: { id: string; grade_level: string }[],
  subjects: { id: string; code?: string; grade_level: string | null; subject_type: string; hours_per_week: number; semester: number | null; name?: string; name_th?: string; name_en?: string }[],
  assignments: { classroom_id: string; subject_id: string; personnel_id: string; personnel?: { prefix?: string; first_name: string; last_name: string } | null }[],
  activeSemester: number
): SubjectEntry[] {
  const entries: SubjectEntry[] = [];

  for (const classroom of classrooms) {
    const classSubjects = subjects.filter(
      (s) =>
        s.grade_level === classroom.grade_level &&
        (s.semester === 0 || s.semester === activeSemester || s.semester == null)
    );

    for (const subj of classSubjects) {
      const assignment = assignments.find(
        (a) => a.subject_id === subj.id && a.classroom_id === classroom.id
      );
      const teacherName = assignment?.personnel
        ? `${assignment.personnel.prefix || ""}${assignment.personnel.first_name} ${assignment.personnel.last_name}`
        : "";

      entries.push({
        subject_id: subj.id,
        classroom_id: classroom.id,
        subject_type: subj.subject_type,
        hours_per_week: subj.hours_per_week,
        personnel_id: assignment?.personnel_id || null,
        teacher_name: teacherName,
        subject_name: subj.name_th || subj.name || subj.name_en || "",
        subject_code: subj.code || "",
      });
    }
  }

  return entries;
}

interface PendingItem {
  entry: SubjectEntry;
  remaining: number;
  daysUsed: Set<number>;
  periodsOnDay: Map<number, number>;
  subjectGroup: string;
  teacherCategoryKey: string;
}

export function generateAutoSchedule(
  entries: SubjectEntry[],
  classroomIds: string[],
  periodsPerDay: number,
  existingSchedules: ExistingSchedule[] = [],
  activityLocks: ActivityLock[] = []
): ScheduleSlot[] {
  const result: ScheduleSlot[] = [];
  const daysOfWeek = [1, 2, 3, 4, 5];

  const occupied = new Set<string>();
  const teacherBusy = new Set<string>();
  const subjectSlotCount = new Map<string, number>();
  // Track which subject was placed in each slot per classroom: "day-period-classroom" -> subject_id
  const slotSubjectMap = new Map<string, string>();
  // Track teacher + category for each slot per classroom: "day-period-classroom" -> teacher:category
  const slotTeacherCategoryMap = new Map<string, string>();
  // Track which subject groups are used on each day per classroom: "classroom-day" -> Set<subjectGroup>
  const dayGroupMap = new Map<string, Set<string>>();
  // Track which subject_ids are on each day per classroom: "classroom-day" -> Set<subject_id>
  const daySubjectMap = new Map<string, Set<string>>();
  // Track teacher + category usage on each day per classroom: "classroom-day" -> Set<teacher:category>
  const dayTeacherCategoryMap = new Map<string, Set<string>>();

  existingSchedules.forEach((s) => {
    occupied.add(`${s.day_of_week}-${s.period}-${s.classroom_id}`);
    if (s.subject_id) {
      slotSubjectMap.set(`${s.day_of_week}-${s.period}-${s.classroom_id}`, s.subject_id);
    }
  });

  const byClassroom = new Map<string, SubjectEntry[]>();
  classroomIds.forEach((cid) => byClassroom.set(cid, []));
  entries.forEach((e) => {
    const list = byClassroom.get(e.classroom_id);
    if (list) list.push(e);
  });

  // Step 1: Place activity subjects — use locks if available, otherwise auto-assign
  const activityEntries = entries.filter((e) => e.subject_type === "activity");
  const activityBySubject = new Map<string, SubjectEntry[]>();
  activityEntries.forEach((e) => {
    const list = activityBySubject.get(e.subject_id) || [];
    list.push(e);
    activityBySubject.set(e.subject_id, list);
  });

  const activityPlacedKeys = new Set<string>();
  const lockMap = new Map<string, ActivityLock>();
  activityLocks.forEach((l) => lockMap.set(l.subject_id, l));

  let fallbackDayIdx = daysOfWeek.length - 1;
  let fallbackPeriod = periodsPerDay;

  activityBySubject.forEach((actEntries, subjectId) => {
    const hoursNeeded = actEntries[0]?.hours_per_week || 1;
    const lock = lockMap.get(subjectId);

    for (let h = 0; h < hoursNeeded; h++) {
      let placed = false;

      if (lock) {
        const day = lock.day_of_week;
        const p = lock.start_period + h;

        if (p <= periodsPerDay) {
          const allFree = actEntries.every((e) => {
            const slotKey = `${day}-${p}-${e.classroom_id}`;
            const teacherKey = e.personnel_id ? `${day}-${p}-${e.personnel_id}` : null;
            return !occupied.has(slotKey) && (!teacherKey || !teacherBusy.has(teacherKey));
          });

          if (allFree) {
            actEntries.forEach((e) => {
              placeSlot(result, occupied, teacherBusy, subjectSlotCount, slotSubjectMap, e, day, p);
                trackPlacementContext(
                  slotTeacherCategoryMap,
                  dayGroupMap,
                  daySubjectMap,
                  dayTeacherCategoryMap,
                  e,
                  getSubjectGroup(e.subject_name || ""),
                  getTeacherCategoryKey(e),
                  day,
                  p
                );
              activityPlacedKeys.add(`${e.subject_id}-${e.classroom_id}`);
            });
            placed = true;
          }
        }
      }

      if (!placed) {
        for (let dayAttempt = 0; dayAttempt < daysOfWeek.length && !placed; dayAttempt++) {
          const day = daysOfWeek[(fallbackDayIdx - dayAttempt + daysOfWeek.length) % daysOfWeek.length];
          for (let p = fallbackPeriod; p >= 1 && !placed; p--) {
            const allFree = actEntries.every((e) => {
              const slotKey = `${day}-${p}-${e.classroom_id}`;
              const teacherKey = e.personnel_id ? `${day}-${p}-${e.personnel_id}` : null;
              return !occupied.has(slotKey) && (!teacherKey || !teacherBusy.has(teacherKey));
            });

            if (allFree) {
              actEntries.forEach((e) => {
                placeSlot(result, occupied, teacherBusy, subjectSlotCount, slotSubjectMap, e, day, p);
                trackPlacementContext(
                  slotTeacherCategoryMap,
                  dayGroupMap,
                  daySubjectMap,
                  dayTeacherCategoryMap,
                  e,
                  getSubjectGroup(e.subject_name || ""),
                  getTeacherCategoryKey(e),
                  day,
                  p
                );
                activityPlacedKeys.add(`${e.subject_id}-${e.classroom_id}`);
              });
              placed = true;
              fallbackPeriod = p - 1;
              if (fallbackPeriod < 1) {
                fallbackDayIdx--;
                fallbackPeriod = periodsPerDay;
              }
            }
          }
        }
      }
    }
  });

  // ========== Step 2: Place remaining subjects with balanced scheduling ==========
  classroomIds.forEach((classroomId) => {
    const classEntries = (byClassroom.get(classroomId) || []).filter(
      (e) => !activityPlacedKeys.has(`${e.subject_id}-${e.classroom_id}`)
    );

    const pending: PendingItem[] = classEntries.map((e) => ({
      entry: e,
      remaining: e.hours_per_week || 1,
      daysUsed: new Set<number>(),
      periodsOnDay: new Map<number, number>(),
      subjectGroup: getSubjectGroup(e.subject_name || ""),
      teacherCategoryKey: getTeacherCategoryKey(e),
    }));

    // Build group map: subjectGroup -> list of pending items in that group
    const groupMembers = new Map<string, PendingItem[]>();
    pending.forEach((p) => {
      if (p.subjectGroup) {
        const list = groupMembers.get(p.subjectGroup) || [];
        list.push(p);
        groupMembers.set(p.subjectGroup, list);
      }
    });

    const coreSubjects = pending.filter((p) => isCoreDifficult(p.entry.subject_type));
    const skillSubjects = pending.filter((p) => !isCoreDifficult(p.entry.subject_type));

    const sortByRemaining = (list: PendingItem[]) => {
      list.sort((a, b) => b.remaining - a.remaining);
    };

    const morningCutoff = Math.ceil(periodsPerDay / 2);

    for (const day of daysOfWeek) {
      for (let period = 1; period <= periodsPerDay; period++) {
        const slotKey = `${day}-${period}-${classroomId}`;
        if (occupied.has(slotKey)) continue;

        const isMorning = period <= morningCutoff;
        const preferCore = isMorning ? (period % 2 === 1) : (period % 2 === 0);

        const primaryPool = preferCore ? coreSubjects : skillSubjects;
        const fallbackPool2 = preferCore ? skillSubjects : coreSubjects;

        const candidate = findBestCandidate(
          primaryPool, day, period, classroomId, occupied, teacherBusy,
          periodsPerDay, subjectSlotCount, slotSubjectMap, slotTeacherCategoryMap, dayGroupMap, daySubjectMap, dayTeacherCategoryMap, groupMembers
        ) || findBestCandidate(
          fallbackPool2, day, period, classroomId, occupied, teacherBusy,
          periodsPerDay, subjectSlotCount, slotSubjectMap, slotTeacherCategoryMap, dayGroupMap, daySubjectMap, dayTeacherCategoryMap, groupMembers
        );

        if (!candidate) continue;

        const item = candidate;
        const e = item.entry;

        placeSlot(result, occupied, teacherBusy, subjectSlotCount, slotSubjectMap, e, day, period);
        item.remaining--;
        item.daysUsed.add(day);
        item.periodsOnDay.set(day, (item.periodsOnDay.get(day) || 0) + 1);

        trackPlacementContext(
          slotTeacherCategoryMap,
          dayGroupMap,
          daySubjectMap,
          dayTeacherCategoryMap,
          e,
          item.subjectGroup,
          item.teacherCategoryKey,
          day,
          period
        );

        sortByRemaining(coreSubjects);
        sortByRemaining(skillSubjects);
      }
    }
  });

  return result;
}

function trackPlacementContext(
  slotTeacherCategoryMap: Map<string, string>,
  dayGroupMap: Map<string, Set<string>>,
  daySubjectMap: Map<string, Set<string>>,
  dayTeacherCategoryMap: Map<string, Set<string>>,
  entry: SubjectEntry,
  subjectGroup: string,
  teacherCategoryKey: string,
  day: number,
  period: number
) {
  const slotKey = `${day}-${period}-${entry.classroom_id}`;
  if (teacherCategoryKey) {
    slotTeacherCategoryMap.set(slotKey, teacherCategoryKey);
  }

  const dayKey = `${entry.classroom_id}-${day}`;

  if (!dayGroupMap.has(dayKey)) dayGroupMap.set(dayKey, new Set());
  if (subjectGroup) dayGroupMap.get(dayKey)!.add(subjectGroup);

  if (!daySubjectMap.has(dayKey)) daySubjectMap.set(dayKey, new Set());
  daySubjectMap.get(dayKey)!.add(entry.subject_id);

  if (teacherCategoryKey) {
    if (!dayTeacherCategoryMap.has(dayKey)) dayTeacherCategoryMap.set(dayKey, new Set());
    dayTeacherCategoryMap.get(dayKey)!.add(teacherCategoryKey);
  }
}

/** Place a subject in a slot and update tracking data structures */
function placeSlot(
  result: ScheduleSlot[],
  occupied: Set<string>,
  teacherBusy: Set<string>,
  subjectSlotCount: Map<string, number>,
  slotSubjectMap: Map<string, string>,
  e: SubjectEntry,
  day: number,
  period: number
) {
  result.push({
    classroom_id: e.classroom_id,
    subject_id: e.subject_id,
    day_of_week: day,
    period,
    teacher_name: e.teacher_name || "",
  });
  const slotKey = `${day}-${period}-${e.classroom_id}`;
  occupied.add(slotKey);
  slotSubjectMap.set(slotKey, e.subject_id);
  if (e.personnel_id) teacherBusy.add(`${day}-${period}-${e.personnel_id}`);
  const ssk = `${e.subject_id}-${day}-${period}`;
  subjectSlotCount.set(ssk, (subjectSlotCount.get(ssk) || 0) + 1);
}

/**
 * Find the best candidate subject for a given slot with scoring system.
 */
function findBestCandidate(
  pool: PendingItem[],
  day: number,
  period: number,
  classroomId: string,
  occupied: Set<string>,
  teacherBusy: Set<string>,
  periodsPerDay: number,
  subjectSlotCount: Map<string, number>,
  slotSubjectMap: Map<string, string>,
  slotTeacherCategoryMap: Map<string, string>,
  dayGroupMap: Map<string, Set<string>>,
  daySubjectMap: Map<string, Set<string>>,
  dayTeacherCategoryMap: Map<string, Set<string>>,
  groupMembers: Map<string, PendingItem[]>
): PendingItem | null {
  let bestCandidate: PendingItem | null = null;
  let bestScore = -Infinity;

  const dgKey = `${classroomId}-${day}`;
  const dayGroups = dayGroupMap.get(dgKey);
  const daySubjects = daySubjectMap.get(dgKey);
  const dayTeacherCategories = dayTeacherCategoryMap.get(dgKey);

  // Get previous period's subject for consecutive check
  const prevSubjectId = period > 1
    ? slotSubjectMap.get(`${day}-${period - 1}-${classroomId}`) || null
    : null;
  const prevTeacherCategoryKey = period > 1
    ? slotTeacherCategoryMap.get(`${day}-${period - 1}-${classroomId}`) || ""
    : "";

  for (const item of pool) {
    if (item.remaining <= 0) continue;

    const e = item.entry;
    const name = e.subject_name || "";

    // Check teacher availability
    if (e.personnel_id) {
      const teacherKey = `${day}-${period}-${e.personnel_id}`;
      if (teacherBusy.has(teacherKey)) continue;
    }

    // Rule: Max 2 periods of same subject per day
    const currentDayCount = item.periodsOnDay.get(day) || 0;
    if (currentDayCount >= 2) continue;

    // Rule: If already has 1 period today, only allow if consecutive (2-hour block)
    if (currentDayCount === 1 && prevSubjectId !== e.subject_id) continue;

    // Rule: same teacher + same subject category (e.g. ว...) cannot appear twice on the same day
    if (item.teacherCategoryKey && dayTeacherCategories?.has(item.teacherCategoryKey) && !daySubjects?.has(e.subject_id)) {
      continue;
    }

    // Rule: same teacher + same subject category cannot be back-to-back if they are different subjects
    if (
      item.teacherCategoryKey &&
      prevTeacherCategoryKey === item.teacherCategoryKey &&
      prevSubjectId !== e.subject_id
    ) {
      continue;
    }

    let score = 0;

    // Prefer subjects with more remaining hours
    score += item.remaining * 10;

    // Prefer subjects NOT already on this day (spread across days)
    if (!item.daysUsed.has(day)) {
      score += 50;
    }

    // Prefer alternate-day spacing
    if (item.daysUsed.has(day - 1) || item.daysUsed.has(day + 1)) {
      score -= 30;
    }

    // Bonus for core subjects in morning
    if (isCoreDifficult(e.subject_type) && period <= Math.ceil(periodsPerDay / 2)) {
      score += 20;
    }

    // Bonus for skill subjects in afternoon
    if (!isCoreDifficult(e.subject_type) && period > Math.ceil(periodsPerDay / 2)) {
      score += 15;
    }

    // Penalty for same subject already today
    score -= currentDayCount * 40;

    // Cross-classroom distribution penalty
    const ssk = `${e.subject_id}-${day}-${period}`;
    const crossCount = subjectSlotCount.get(ssk) || 0;
    score -= crossCount * 60;

    // === NEW: Base/Additional separation ===
    // If this subject's group already has another member on this day, heavily discourage it
    if (item.subjectGroup && dayGroups?.has(item.subjectGroup)) {
      // Check if it's the same subject (2-hour block) or a different one in the group
      const isOwnSubjectAlready = daySubjects?.has(e.subject_id);
      if (!isOwnSubjectAlready) {
        // Different subject in same group on same day (e.g. base + additional English)
        score -= 160;
      }
    }

    // Hard rule: don't place base immediately after additional (or vice versa) of same group
    if (prevSubjectId && prevSubjectId !== e.subject_id && item.subjectGroup) {
      // Find what group the previous subject belongs to
      const members = groupMembers.get(item.subjectGroup);
      if (members?.some((m) => m.entry.subject_id === prevSubjectId)) {
        // Previous period is same group but different subject — don't place consecutively
        continue;
      }
    }

    // Diversity bonus: penalize if same subject_id already placed today (beyond 2-hour block)
    if (daySubjects?.has(e.subject_id) && currentDayCount === 0) {
      // This shouldn't happen normally but guard against it
      score -= 50;
    }

    // Variety bonus: prefer subjects whose group hasn't appeared today
    if (item.subjectGroup && !dayGroups?.has(item.subjectGroup)) {
      score += 25;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = item;
    }
  }

  return bestCandidate;
}
