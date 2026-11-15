// @vitest-environment node
import {describe,it,expect} from "vitest";
import {scanLiveCounts} from "../../../supabase/functions/_shared/scanLiveCounts";
import {parentAttendanceStatus} from "../parentAttendance";
describe("all school scan views use the same evidence",()=>{
  it("counts people instead of repeated staff scan events",()=>expect(scanLiveCounts([{present:2,late:1}],[{person_id:"A"},{person_id:"A"},{person_id:"B"},{person_id:null}])).toEqual({students_present:3,staff_present:2}));
  it("an exit alone is not student arrival",()=>expect(parentAttendanceStatus("A",[],[{scan_type:"exit",scan_time:"2026-11-15T03:00:00Z"}],"08:30")).toBeNull());
  it("parents see the same late status as reports",()=>expect(parentAttendanceStatus("A",[],[{scan_type:"entry",scan_time:"2026-11-15T01:30:01Z"}],"08:30")).toBe("late"));
  it("saved late status stays authoritative",()=>expect(parentAttendanceStatus("A",[{status:"late"}],[{scan_type:"entry",scan_time:"2026-11-15T01:00:00Z"}],"08:30")).toBe("late"));
});