// @vitest-environment node
import {describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({upload:vi.fn()}));
vi.mock("@/integrations/supabase/client",()=>({supabase:{storage:{from:()=>({upload:mocks.upload})}}}));
import {uploadFaceScanSnapshot} from "../faceScanUpload";
describe("durable scan image evidence",()=>{
  it("stores a durable path rather than a signed link",async()=>{
    mocks.upload.mockResolvedValueOnce({error:null});
    const result=await uploadFaceScanSnapshot("data:image/png;base64,aGVsbG8=","A");
    expect(result).toMatch(/^scans\/\d{4}-\d{2}-\d{2}\/A-\d+\.png$/);
    expect(result).not.toContain("token=");
  });
});