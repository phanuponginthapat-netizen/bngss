// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { authorizeObserverAdmin } from "../../../supabase/functions/_shared/observerAuthorization";
const db = (role: string, fail = false) => ({ auth: { getUser: vi.fn(async () => ({data:{user:{id:"u"}},error:null})) }, from: vi.fn(() => ({select:()=>({eq:async()=>({data:[{role}],error:fail ? new Error("unavailable") : null})})})) });
describe("observer credential permission",()=>{
  it("uses protected roles and accepts only admin",async()=>{
    expect(await authorizeObserverAdmin(db("admin"),"session")).toBe("u");
    expect(await authorizeObserverAdmin(db("teacher"),"session")).toBeNull();
    expect(await authorizeObserverAdmin(db("director"),"session")).toBeNull();
  });
  it("fails closed on a role read failure or missing session",async()=>{
    expect(await authorizeObserverAdmin(db("admin",true),"session")).toBeNull();
    expect(await authorizeObserverAdmin(db("admin"),"")).toBeNull();
  });
});