
ALTER TABLE public.home_visits
  ADD COLUMN IF NOT EXISTS academic_year integer,
  ADD COLUMN IF NOT EXISTS semester integer,
  ADD COLUMN IF NOT EXISTS form_code text DEFAULT 'นร./กสศ.01',
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS family_marital_status text,
  ADD COLUMN IF NOT EXISTS guardian_prefix text,
  ADD COLUMN IF NOT EXISTS guardian_first_name text,
  ADD COLUMN IF NOT EXISTS guardian_last_name text,
  ADD COLUMN IF NOT EXISTS guardian_relation text,
  ADD COLUMN IF NOT EXISTS guardian_education text,
  ADD COLUMN IF NOT EXISTS guardian_occupation text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_id_card text,
  ADD COLUMN IF NOT EXISTS guardian_no_id_card boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_state_welfare boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS household_members jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS household_status jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS travel_time_minutes integer,
  ADD COLUMN IF NOT EXISTS travel_cost_per_month numeric,
  ADD COLUMN IF NOT EXISTS student_money_per_day numeric,
  ADD COLUMN IF NOT EXISTS officer_name text,
  ADD COLUMN IF NOT EXISTS officer_id_card text,
  ADD COLUMN IF NOT EXISTS officer_position text,
  ADD COLUMN IF NOT EXISTS officer_certified boolean,
  ADD COLUMN IF NOT EXISTS officer_reject_reason text;

CREATE INDEX IF NOT EXISTS idx_home_visits_year_sem ON public.home_visits(academic_year, semester);
CREATE INDEX IF NOT EXISTS idx_home_visits_created_by ON public.home_visits(created_by);
