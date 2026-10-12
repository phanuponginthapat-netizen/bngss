-- ค่า CMS บางตัวไม่อยู่ใน allowlist → ผู้ใช้ทั่วไป/หน้าสาธารณะโหลดไม่ได้ (ไม่แตะข้อมูลเดิม)
DROP POLICY IF EXISTS "Public can view allowlisted cms settings" ON public.cms_settings;
CREATE POLICY "Public can view allowlisted cms settings" ON public.cms_settings
FOR SELECT TO anon, authenticated
USING (key = ANY (ARRAY[
  'ai_bot_avatar_url','ai_bot_bg_image_url','ai_bot_greeting','ai_bot_name','ai_bot_persona',
  'app_favicon_url','app_name','app_short_name','director_name','director_title','director_signature',
  'footer_school_name','garuda_emblem','hero_background','hero_bg_color','hero_height','hero_overlay',
  'hero_image','hero_title','hero_subtitle',
  'id_card_accent_color','id_card_back_note','id_card_bg_image_url','id_card_body_bg_image_url',
  'id_card_card_border_radius','id_card_card_subtitle','id_card_header_color_from','id_card_header_color_to',
  'id_card_logo_url','id_card_logo_url_2','id_card_logo_url_3','id_card_qr_type','id_card_school_address',
  'id_card_school_name','id_card_school_name_en','id_card_school_phone','id_card_show_blood_type',
  'id_card_show_dob','id_card_show_emergency_contact','id_card_show_line_qr','id_card_show_qr','id_card_text_color',
  'mascot_name','mascot_bg_url','mascot_happy_url','mascot_neutral_url','mascot_worried_url',
  'school_address','school_email','school_logo','school_name','school_phone','school_seal','school_short_name',
  'sdq_enabled','show_footer','theme_primary_color','theme_secondary_color','public_origin','admin_email'
]::text[]));
