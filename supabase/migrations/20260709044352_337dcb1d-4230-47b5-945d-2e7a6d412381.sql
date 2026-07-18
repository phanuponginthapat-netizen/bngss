
ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS post_reflection_outcomes text,
  ADD COLUMN IF NOT EXISTS post_reflection_problems text,
  ADD COLUMN IF NOT EXISTS post_reflection_improvements text,
  ADD COLUMN IF NOT EXISTS post_reflection_notes text,
  ADD COLUMN IF NOT EXISTS post_reflection_taught_at date,
  ADD COLUMN IF NOT EXISTS post_reflection_updated_at timestamptz;
