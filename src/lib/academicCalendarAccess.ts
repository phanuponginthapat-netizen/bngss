export function canCreateAcademicEvent(isStaff: boolean, readOnly: boolean): boolean {
  return isStaff && !readOnly;
}