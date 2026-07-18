import { useCmsSettingsBulk } from "./useCmsSettings";

export interface AiBotSettings {
  name: string;
  avatarUrl: string;
  greeting: string;
  userColor: string;
  assistantColor: string;
  bgColor: string;
  bgImageUrl: string;
  headerGradient: string;
}

const DEFAULTS: AiBotSettings = {
  name: "น้องโรงเรียน",
  avatarUrl: "",
  greeting:
    "สวัสดีค่ะ 👋 น้องโรงเรียนช่วยอะไรได้บ้างคะ? ถามการบ้าน, วิธีใช้ระบบ, หรือข้อมูลโรงเรียนได้เลยค่ะ",
  userColor: "#2563eb",
  assistantColor: "#f1f5f9",
  bgColor: "#ffffff",
  bgImageUrl: "",
  headerGradient: "linear-gradient(90deg, rgba(37,99,235,0.10), rgba(245,158,11,0.10))",
};

export function useAiBotSettings(): AiBotSettings {
  const { data } = useCmsSettingsBulk();
  return {
    name: data?.ai_bot_name || DEFAULTS.name,
    avatarUrl: data?.ai_bot_avatar_url || DEFAULTS.avatarUrl,
    greeting: data?.ai_bot_greeting || DEFAULTS.greeting,
    userColor: data?.ai_bot_user_color || DEFAULTS.userColor,
    assistantColor: data?.ai_bot_assistant_color || DEFAULTS.assistantColor,
    bgColor: data?.ai_bot_bg_color || DEFAULTS.bgColor,
    bgImageUrl: data?.ai_bot_bg_image_url || DEFAULTS.bgImageUrl,
    headerGradient: data?.ai_bot_header_gradient || DEFAULTS.headerGradient,
  };
}
