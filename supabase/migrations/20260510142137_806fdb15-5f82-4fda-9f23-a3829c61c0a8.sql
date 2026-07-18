-- Reassign ~15 schedule rows to test teacher "นายทดสอบ ครู" so "My Schedule" populates
WITH picked AS (
  SELECT id FROM public.schedules
  ORDER BY classroom_id, day_of_week, period
  LIMIT 18
)
UPDATE public.schedules s
SET teacher_name = 'นายทดสอบ ครู'
FROM picked
WHERE s.id = picked.id;