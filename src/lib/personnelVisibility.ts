type PersonnelIdentity = {
  employee_code?: string | null;
  department?: string | null;
  position?: string | null;
  position_title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

/** Presentation only: never changes accounts, assignments or authorization. */
export function isVisibleSchoolPersonnel(person: PersonnelIdentity): boolean {
  const code = person.employee_code?.trim().toLowerCase();
  const department = person.department?.trim();
  const position = (person.position_title || person.position || "").trim();
  const observerAccount = person.first_name?.trim() === "ผู้สังเกตการณ์"
    && person.last_name?.trim() === "ศึกษานิเทศก์";
  const adminAccount = person.first_name?.trim().toLowerCase() === "admin"
    && person.last_name?.trim() === "ระบบ";
  return code !== "kiosk" && department !== "ระบบ"
    && position !== "อุปกรณ์ระบบ" && !observerAccount && !adminAccount;
}