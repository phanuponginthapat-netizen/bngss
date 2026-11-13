ALTER TABLE public.kiosk_commands DROP CONSTRAINT kiosk_commands_action_check;
ALTER TABLE public.kiosk_commands ADD CONSTRAINT kiosk_commands_action_check CHECK(action IN ('screen_on','screen_off','sleep','shutdown','cancel','wake','open','free','lock','prepare_voice','test_voice')) NOT VALID;
ALTER TABLE public.kiosk_commands VALIDATE CONSTRAINT kiosk_commands_action_check;