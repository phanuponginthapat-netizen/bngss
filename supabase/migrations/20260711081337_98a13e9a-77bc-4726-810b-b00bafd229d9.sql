
-- 1. Tighten alumni_university teacher read: only teachers in the same school as the alumni's student record
DROP POLICY IF EXISTS "alumni_uni_read_teacher" ON public.alumni_university;

CREATE POLICY "alumni_uni_read_teacher_same_school"
ON public.alumni_university
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE s.id = alumni_university.student_id
      AND s.school_id IS NOT NULL
      AND s.school_id = p.school_id
  )
);

-- 2. Replace CMS settings blocklist with an explicit allowlist of known-safe keys
DROP POLICY IF EXISTS "Public can view non-sensitive cms settings" ON public.cms_settings;

CREATE POLICY "Public can view allowlisted cms settings"
ON public.cms_settings
FOR SELECT
TO anon, authenticated
USING (
  key = ANY (ARRAY[
    'ai_bot_avatar_url','ai_bot_greeting','ai_bot_name','ai_bot_persona',
    'app_favicon_url','app_name','app_short_name',
    'director_name','director_title',
    'footer_school_name',
    'garuda_emblem',
    'hero_background','hero_bg_color','hero_height','hero_overlay',
    'id_card_accent_color','id_card_back_note','id_card_bg_image_url','id_card_body_bg_image_url',
    'id_card_card_border_radius','id_card_card_subtitle',
    'id_card_header_color_from','id_card_header_color_to',
    'id_card_logo_url','id_card_logo_url_2','id_card_logo_url_3',
    'id_card_qr_type','id_card_school_address','id_card_school_name','id_card_school_name_en',
    'id_card_school_phone','id_card_show_blood_type','id_card_show_dob',
    'id_card_show_emergency_contact','id_card_show_line_qr','id_card_show_qr',
    'id_card_text_color',
    'mascot_bg_url','mascot_happy_url','mascot_neutral_url',
    'school_address','school_logo','school_name','school_seal',
    'sdq_enabled','show_footer',
    'theme_primary_color','theme_secondary_color'
  ])
);
