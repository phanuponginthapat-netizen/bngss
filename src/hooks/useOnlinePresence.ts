import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "./useUserRole";

/**
 * Global online presence tracker via Supabase Realtime.
 * ทุกคนที่เข้าเว็บจะ join channel "online-users" และ track user_id ของตัวเอง
 * คืนค่า Set ของ user_id ที่กำลังออนไลน์
 */
let onlineIdsCache = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();
let channelStarted = false;

function broadcast() {
  listeners.forEach((cb) => cb(new Set(onlineIdsCache)));
}

export function useOnlinePresence() {
  const { userId } = useUserRole();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set(onlineIdsCache));

  useEffect(() => {
    listeners.add(setOnlineIds);
    return () => {
      listeners.delete(setOnlineIds);
    };
  }, []);

  useEffect(() => {
    if (!userId || channelStarted) return;
    channelStarted = true;

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState();
      onlineIdsCache = new Set(Object.keys(state));
      broadcast();
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        channel.track({ user_id: userId, online_at: new Date().toISOString() });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      supabase.removeChannel(channel);
      channelStarted = false;
      onlineIdsCache = new Set();
      broadcast();
    };
  }, [userId]);

  return { onlineIds, isOnline: (id: string) => onlineIds.has(id) };
}
