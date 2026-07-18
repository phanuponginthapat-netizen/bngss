
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'document',
  reference_id uuid,
  reference_type text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can insert notifications (system creates them)
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admins can manage all notifications
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
