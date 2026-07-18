INSERT INTO public.school_settings (setting_key, setting_value)
VALUES (
  'channel_category_routing',
  '{"gchat":{"critical":true,"score":true,"health":true,"ict":true,"attendance":true,"behavior":true,"homework":true,"eform":true,"leave":true,"news":true,"other":true},"line":{"critical":true,"score":true,"health":true,"ict":true,"attendance":true,"behavior":true,"homework":true,"eform":true,"leave":true,"news":true,"other":true}}'::jsonb
)
ON CONFLICT (setting_key) DO NOTHING;