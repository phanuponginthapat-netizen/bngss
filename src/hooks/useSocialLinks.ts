import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SOCIAL_LINKS_SETTING_KEY, type SocialLink } from "@/lib/socialPlatforms";

export function useSocialLinks() {
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("school_settings")
      .select("setting_value")
      .eq("setting_key", SOCIAL_LINKS_SETTING_KEY)
      .maybeSingle();
    try {
      const parsed = data?.setting_value ? JSON.parse(data.setting_value) : [];
      setLinks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setLinks([]);
    }
    setLoading(false);
  }, []);

  const save = useCallback(async (next: SocialLink[]) => {
    const { error } = await supabase
      .from("school_settings")
      .upsert(
        { setting_key: SOCIAL_LINKS_SETTING_KEY, setting_value: JSON.stringify(next) },
        { onConflict: "setting_key" }
      );
    if (!error) setLinks(next);
    return { error };
  }, []);

  useEffect(() => { load(); }, [load]);

  return { links, loading, reload: load, save };
}
