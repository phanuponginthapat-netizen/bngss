import { useCmsSettingsBulk } from "./useCmsSettings";
import defaultHappy from "@/assets/mascot-happy.png";
import defaultNeutral from "@/assets/mascot-neutral.png";
import defaultWorried from "@/assets/mascot-worried.png";
import defaultBg from "@/assets/mascot-bg-school.jpg";

export interface MascotSettings {
  name: string;
  happyUrl: string;
  neutralUrl: string;
  worriedUrl: string;
  backgroundUrl: string;
}

export function useMascotSettings(): MascotSettings {
  const { data } = useCmsSettingsBulk();
  return {
    name: data?.mascot_name || "น้องโรงเรียน",
    happyUrl: data?.mascot_happy_url || defaultHappy,
    neutralUrl: data?.mascot_neutral_url || defaultNeutral,
    worriedUrl: data?.mascot_worried_url || defaultWorried,
    backgroundUrl: data?.mascot_bg_url || defaultBg,
  };
}
