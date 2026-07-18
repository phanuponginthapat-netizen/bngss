// One-line admin client factory for edge functions.
// Usage: import { makeAdmin } from "../_shared/supabaseAdmin.ts";
//        const admin = makeAdmin();
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function makeAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
