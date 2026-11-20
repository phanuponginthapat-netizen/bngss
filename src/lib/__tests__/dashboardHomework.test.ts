// @vitest-environment node
import { describe,expect,it,vi } from "vitest";
vi.mock("@/integrations/supabase/client",()=>({supabase:{}}));
import { taskFamilySubmission } from "../dashboardHomework";
import { familyHomeworkScore, familyHomeworkStatus } from "../homeworkFamilyStatus";
describe("family widget homework",()=>{
  const task = {assigned_to_student_id:null,status:"pending",grade:null,submitted_at:null,submissions:{child:{status:"graded",grade:8},other:{status:"submitted"}}};
  it("shows child's submitted classroom work and teacher score",()=>{
    const mine=taskFamilySubmission(task,"child");
    expect(familyHomeworkStatus(mine)).toBe("graded");
    expect(familyHomeworkScore(mine)).toBe(8);
  });
  it("never attributes another child's submission",()=>{
    expect(familyHomeworkStatus(taskFamilySubmission(task,"missing"))).toBe("not_submitted");
    expect(familyHomeworkScore(taskFamilySubmission(task,"other"))).toBeNull();
  });
  it("keeps legacy individual submitted work and measured zero grade",()=>{
    const mine=taskFamilySubmission({...task,assigned_to_student_id:"child",grade:0,submitted_at:"2026-11-20"},"child");
    expect(familyHomeworkStatus(mine)).toBe("graded");expect(familyHomeworkScore(mine)).toBe(0);
  });
});