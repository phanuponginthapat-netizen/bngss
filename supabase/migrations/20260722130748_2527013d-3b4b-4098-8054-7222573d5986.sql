-- Add public_origin and admin_email to CMS so all modules read one source
INSERT INTO public.cms_settings (key, value) VALUES
  ('public_origin', 'https://bngss.lovable.app'),
  ('admin_email',   'admin@school.com')
ON CONFLICT (key) DO NOTHING;
-- Extend public allowlist policy so anon/authenticated can read these two keys
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Public can view allowlisted cms settings" ON public.cms_settings';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'DROP POLICY IF EXISTS "Public can view allowlisted cms settings" ON public.cms_settings';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
DO $guard$
DECLARE
  _ddl_try int := 0;
BEGIN
  LOOP
    BEGIN
    SET LOCAL lock_timeout = '5s';
      EXECUTE 'CREATE POLICY "Public can view allowlisted cms settings"
    ON public.cms_settings FOR SELECT
    TO anon, authenticated
    USING (key = ANY (ARRAY[
      ''ai_bot_avatar_url'',''ai_bot_greeting'',''ai_bot_name'',''ai_bot_persona'',
      ''app_favicon_url'',''app_name'',''app_short_name'',
      ''director_name'',''director_title'',''footer_school_name'',''garuda_emblem'',
      ''hero_background'',''hero_bg_color'',''hero_height'',''hero_overlay'',
      ''id_card_accent_color'',''id_card_back_note'',''id_card_bg_image_url'',
      ''id_card_body_bg_image_url'',''id_card_card_border_radius'',''id_card_card_subtitle'',
      ''id_card_header_color_from'',''id_card_header_color_to'',''id_card_logo_url'',
      ''id_card_logo_url_2'',''id_card_logo_url_3'',''id_card_qr_type'',
      ''id_card_school_address'',''id_card_school_name'',''id_card_school_name_en'',
      ''id_card_school_phone'',''id_card_show_blood_type'',''id_card_show_dob'',
      ''id_card_show_emergency_contact'',''id_card_show_line_qr'',''id_card_show_qr'',
      ''id_card_text_color'',
      ''mascot_bg_url'',''mascot_happy_url'',''mascot_neutral_url'',
      ''school_address'',''school_logo'',''school_name'',''school_phone'',''school_seal'',
      ''sdq_enabled'',''show_footer'',
      ''theme_primary_color'',''theme_secondary_color'',
      ''public_origin'',''admin_email''
    ]))';
    EXIT;
    EXCEPTION
      WHEN deadlock_detected OR lock_not_available THEN
        _ddl_try := _ddl_try + 1;
        IF _ddl_try >= 10 THEN
          RAISE NOTICE 'giving up after lock contention: %', SQLERRM;
          EXIT;
        END IF;
        PERFORM pg_sleep(0.4 * _ddl_try);
      WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
        RAISE NOTICE 'skipped: %', SQLERRM;
        EXIT;
    END;
  END LOOP;
END
$guard$;
