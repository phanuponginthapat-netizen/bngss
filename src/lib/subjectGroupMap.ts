// Map Thai subject group label (stored on personnel.subject_group / profile)
// to the subject_group_heads code used by the subject_group_heads table.

export type SubjectGroupCode =
  | "thai" | "math" | "science" | "social"
  | "health_pe" | "arts" | "occupation" | "foreign_lang" | "special_ed";

export const SUBJECT_GROUP_DEFS: { code: SubjectGroupCode; th: string; en: string }[] = [
  { code: "thai", th: "ภาษาไทย", en: "Thai Language" },
  { code: "math", th: "คณิตศาสตร์", en: "Mathematics" },
  { code: "science", th: "วิทยาศาสตร์และเทคโนโลยี", en: "Science & Technology" },
  { code: "social", th: "สังคมศึกษา ศาสนาและวัฒนธรรม", en: "Social Studies" },
  { code: "foreign_lang", th: "ภาษาต่างประเทศ", en: "Foreign Languages" },
  { code: "health_pe", th: "สุขศึกษาและพลศึกษา", en: "Health & PE" },
  { code: "arts", th: "ศิลปะ", en: "Arts" },
  { code: "occupation", th: "การงานอาชีพ", en: "Occupations" },
  { code: "special_ed", th: "งานเด็กพิเศษ", en: "Special Education" },
];

/** Convert a Thai (or English) subject-group label to its code. */
export function toSubjectGroupCode(raw: string | null | undefined): SubjectGroupCode | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  for (const d of SUBJECT_GROUP_DEFS) {
    if (s === d.code) return d.code;
    if (s === d.th.toLowerCase()) return d.code;
    if (s === d.en.toLowerCase()) return d.code;
  }
  // Fuzzy: any def whose Thai label is contained in the raw value, or vice-versa
  for (const d of SUBJECT_GROUP_DEFS) {
    if (raw.includes(d.th) || d.th.includes(raw)) return d.code;
  }
  return null;
}

export function subjectGroupLabel(code: SubjectGroupCode, lang: "th" | "en" = "th"): string {
  const d = SUBJECT_GROUP_DEFS.find((x) => x.code === code);
  return d ? (lang === "en" ? d.en : d.th) : code;
}
