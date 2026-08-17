
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL DEFAULT 'homework',
  title TEXT NOT NULL,
  description TEXT,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_student_id UUID,
  subject_id UUID,
  classroom_id UUID,
  assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

-- Everyone can view their own tasks
DROP POLICY IF EXISTS "Users can view own tasks" ON public.task_assignments;
CREATE POLICY "Users can view own tasks"
ON public.task_assignments FOR SELECT
TO authenticated
USING (
  assigned_to_user_id = auth.uid()
  OR assigned_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

-- Teachers can create tasks
DROP POLICY IF EXISTS "Staff can create tasks" ON public.task_assignments;
CREATE POLICY "Staff can create tasks"
ON public.task_assignments FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
  OR has_role(auth.uid(), 'teacher'::app_role)
);

-- Creators and admins can update
DROP POLICY IF EXISTS "Creators and admins can update tasks" ON public.task_assignments;
CREATE POLICY "Creators and admins can update tasks"
ON public.task_assignments FOR UPDATE
TO authenticated
USING (
  assigned_by = auth.uid()
  OR assigned_to_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

-- Creators and admins can delete
DROP POLICY IF EXISTS "Creators and admins can delete tasks" ON public.task_assignments;
CREATE POLICY "Creators and admins can delete tasks"
ON public.task_assignments FOR DELETE
TO authenticated
USING (
  assigned_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'director'::app_role)
);

DROP TRIGGER IF EXISTS update_task_assignments_updated_at ON public.task_assignments;
CREATE TRIGGER update_task_assignments_updated_at
BEFORE UPDATE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
