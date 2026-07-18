
-- Add notification_types column to google_chat_webhooks for event category filtering
ALTER TABLE public.google_chat_webhooks ADD COLUMN IF NOT EXISTS notification_types text[] DEFAULT ARRAY['staff_leave','substitute','document','emergency','attendance','behavior','news','enrollment','assessment','grades']::text[];

-- Add custom_messages jsonb column for per-event message templates
ALTER TABLE public.google_chat_webhooks ADD COLUMN IF NOT EXISTS custom_messages jsonb DEFAULT '{}'::jsonb;
