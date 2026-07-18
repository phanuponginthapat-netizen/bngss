import { useCmsSettingsBulk } from "./useCmsSettings";

export interface IdCardSettings {
  school_name: string;
  school_name_en: string;
  school_address: string;
  school_phone: string;
  header_color_from: string;
  header_color_to: string;
  text_color: string;
  logo_url: string;
  logo_url_2: string;
  logo_url_3: string;
  bg_image_url: string;
  body_bg_image_url: string;
  accent_color: string;
  card_subtitle: string;
  show_qr: boolean;
  qr_type: string;
  show_blood_type: boolean;
  show_dob: boolean;
  show_emergency_contact: boolean;
  show_line_qr: boolean;
  card_border_radius: string;
  back_note: string;
}

export const DEFAULT_ID_CARD_SETTINGS: IdCardSettings = {
  school_name: "โรงเรียนสมาร์ทสคูล",
  school_name_en: "Smart School",
  school_address: "",
  school_phone: "",
  header_color_from: "#1e40af",
  header_color_to: "#3b82f6",
  text_color: "#ffffff",
  logo_url: "",
  logo_url_2: "",
  logo_url_3: "",
  bg_image_url: "",
  body_bg_image_url: "",
  accent_color: "#1e40af",
  card_subtitle: "บัตรประจำตัวนักเรียน",
  show_qr: true,
  qr_type: "sdq",
  show_blood_type: true,
  show_dob: true,
  show_emergency_contact: true,
  show_line_qr: true,
  card_border_radius: "12",
  back_note: "บัตรนี้เป็นสมบัติของโรงเรียน หากพบกรุณาส่งคืน",
};

export function useIdCardSettings() {
  const { data: bulk, ...rest } = useCmsSettingsBulk();
  const rawSettings: Record<string, string> = {};
  if (bulk) {
    for (const k of Object.keys(bulk)) {
      if (k.startsWith("id_card_") && bulk[k]) {
        rawSettings[k.replace("id_card_", "")] = bulk[k];
      }
    }
  }

  const settings: IdCardSettings = {
    school_name: rawSettings?.school_name || bulk?.school_name || DEFAULT_ID_CARD_SETTINGS.school_name,
    school_name_en: rawSettings?.school_name_en || DEFAULT_ID_CARD_SETTINGS.school_name_en,
    school_address: rawSettings?.school_address || bulk?.school_address || DEFAULT_ID_CARD_SETTINGS.school_address,
    school_phone: rawSettings?.school_phone || bulk?.school_phone || DEFAULT_ID_CARD_SETTINGS.school_phone,
    header_color_from: rawSettings?.header_color_from || DEFAULT_ID_CARD_SETTINGS.header_color_from,
    header_color_to: rawSettings?.header_color_to || DEFAULT_ID_CARD_SETTINGS.header_color_to,
    text_color: rawSettings?.text_color || DEFAULT_ID_CARD_SETTINGS.text_color,
    logo_url: rawSettings?.logo_url || bulk?.school_logo || DEFAULT_ID_CARD_SETTINGS.logo_url,
    logo_url_2: rawSettings?.logo_url_2 || DEFAULT_ID_CARD_SETTINGS.logo_url_2,
    logo_url_3: rawSettings?.logo_url_3 || DEFAULT_ID_CARD_SETTINGS.logo_url_3,
    bg_image_url: rawSettings?.bg_image_url || DEFAULT_ID_CARD_SETTINGS.bg_image_url,
    body_bg_image_url: rawSettings?.body_bg_image_url || DEFAULT_ID_CARD_SETTINGS.body_bg_image_url,
    accent_color: rawSettings?.accent_color || DEFAULT_ID_CARD_SETTINGS.accent_color,
    card_subtitle: rawSettings?.card_subtitle || DEFAULT_ID_CARD_SETTINGS.card_subtitle,
    show_qr: rawSettings?.show_qr !== "false",
    qr_type: rawSettings?.qr_type || DEFAULT_ID_CARD_SETTINGS.qr_type,
    show_blood_type: rawSettings?.show_blood_type !== "false",
    show_dob: rawSettings?.show_dob !== "false",
    show_emergency_contact: rawSettings?.show_emergency_contact !== "false",
    show_line_qr: rawSettings?.show_line_qr !== "false",
    card_border_radius: rawSettings?.card_border_radius || DEFAULT_ID_CARD_SETTINGS.card_border_radius,
    back_note: rawSettings?.back_note || DEFAULT_ID_CARD_SETTINGS.back_note,
  };

  return { settings, rawSettings, ...rest };
}
