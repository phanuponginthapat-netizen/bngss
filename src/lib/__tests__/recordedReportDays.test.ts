// @vitest-environment node
import {it,expect} from "vitest";
import {aggregatePublicAttendance} from "../../../supabase/functions/_shared/publicAttendance";
it("includes a real Sunday kiosk scan in the same daily summary",()=>{
 const rows=aggregatePublicAttendance(["A"],["2026-11-15"],[],[{student_id:"A",scan_date:"2026-11-15",scan_type:"entry",scan_time:"2026-11-15T02:48:57Z"}],"2026-11-15","10:20:00","08:30","08:30");
 expect(rows[0]).toMatchObject({present:0,late:1,evidence:true,total:1});
});