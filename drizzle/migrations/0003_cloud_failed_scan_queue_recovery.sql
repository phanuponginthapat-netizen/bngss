CREATE TABLE IF NOT EXISTS public.offline_failed_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 queue_name text NOT NULL,
 payload jsonb NOT NULL,
 error text,
 attempts integer DEFAULT 0,
 created_at timestamptz DEFAULT now(),
 created_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, DELETE ON public.offline_failed_queue TO authenticated;
GRANT ALL ON public.offline_failed_queue TO service_role;
ALTER TABLE public.offline_failed_queue ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.offline_failed_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth all offline_failed" ON public.offline_failed_queue;
CREATE POLICY failed_queue_read ON public.offline_failed_queue FOR SELECT TO authenticated USING (created_by = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'director'));
CREATE POLICY failed_queue_insert ON public.offline_failed_queue FOR INSERT TO authenticated WITH CHECK (created_by = (SELECT auth.uid()) AND (public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'director') OR public.has_role((SELECT auth.uid()),'teacher')));
CREATE POLICY failed_queue_delete ON public.offline_failed_queue FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()),'admin') OR public.has_role((SELECT auth.uid()),'director'));
CREATE INDEX IF NOT EXISTS offline_failed_queue_name_created ON public.offline_failed_queue(queue_name,created_at DESC);