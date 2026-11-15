export function scanLiveCounts(classes: {present:number;late:number}[], staff: {person_id:string|null}[]) {
  return {students_present:classes.reduce((sum,row)=>sum+row.present+row.late,0),staff_present:new Set(staff.map(r=>r.person_id).filter(Boolean)).size};
}