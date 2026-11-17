import { supabase } from "@/integrations/supabase/client";
import { uploadPublicFileWithFallback } from "@/lib/uploadFallback";
import { makeTransparentSignature } from "@/lib/signatureImage";

/** Write both supported keys together so legacy print consumers cannot diverge. */
export async function uploadDirectorSignature(file: File): Promise<string> {
  const png = await makeTransparentSignature(file);
  const result = await uploadPublicFileWithFallback("cms-images",
    `signatures/director_${crypto.randomUUID()}.png`, png, { contentType: "image/png", upsert: false });
  const { error } = await supabase.from("cms_settings").upsert([
    { key: "director_signature", value: result.publicUrl },
    { key: "director_signature_url", value: result.publicUrl },
  ], { onConflict: "key" });
  if (error) throw error;
  return result.publicUrl;
}