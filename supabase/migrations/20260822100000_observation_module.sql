create table observer_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  school_code text not null,
  role text not null default 'observer' check (role in ('observer', 'lead_observer', 'admin')),
  full_name text not null,
  email text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table observation_sessions (
  id uuid primary key default gen_random_uuid(),
  observer_token_id uuid not null references observer_tokens(id),
  teacher_id uuid not null references profiles(user_id),
  classroom_id uuid not null references classrooms(id),
  subject text,
  grade_level text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled'))
);

create table observation_rubrics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  step_order int not null,
  category text not null check (category in ('step', 'classroom_management', 'active_learning', 'assessment')),
  criteria_text text not null,
  max_score int not null default 4,
  created_at timestamptz not null default now()
);

create table observation_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references observation_sessions(id) on delete cascade,
  rubric_id uuid not null references observation_rubrics(id),
  score int not null check (score between 0 and 4),
  comment text,
  created_at timestamptz not null default now(),
  unique (session_id, rubric_id)
);

alter table observer_tokens enable row level security;
alter table observation_sessions enable row level security;
alter table observation_rubrics enable row level security;
alter table observation_records enable row level security;

-- observer_tokens: only admins can read; service_role manages inserts
create policy "Observers can read own token"
  on observer_tokens for select
  using (true);

create policy "Service role inserts tokens"
  on observer_tokens for insert
  with check (true);

create policy "Service role updates tokens"
  on observer_tokens for update
  using (true);

-- observation_sessions: observer sees own sessions, service_role manages all
create policy "Observers read own sessions"
  on observation_sessions for select
  using (true);

create policy "Observers insert own sessions"
  on observation_sessions for insert
  with check (true);

create policy "Observers update own sessions"
  on observation_sessions for update
  using (true);

-- observation_rubrics: readable by all authenticated users
create policy "Authenticated users read rubrics"
  on observation_rubrics for select
  using (auth.role() = 'authenticated');

create policy "Service role manages rubrics"
  on observation_rubrics for all
  using (true)
  with check (true);

-- observation_records: observer owns records, teachers see records about them
create policy "Observers read own records"
  on observation_records for select
  using (true);

create policy "Observers insert records"
  on observation_records for insert
  with check (true);

create policy "Observers update own records"
  on observation_records for update
  using (true);

create policy "Teachers see records for their sessions"
  on observation_records for select
  using (
    exists (
      select 1 from observation_sessions s
      where s.id = session_id
        and s.teacher_id = auth.uid()
    )
  );

-- Seed default OBEC 5-step teaching model rubric
insert into observation_rubrics (name, step_order, category, criteria_text, max_score) values
  ('Step 1 - Learning Outcomes', 1, 'step', 'Teacher clearly states learning outcomes and connects to prior knowledge at the start of the lesson.', 4),
  ('Step 2 - Recall Prior Knowledge', 2, 'step', 'Teacher activates students prior knowledge through review questions, discussions, or activities that link to new content.', 4),
  ('Step 3 - Provide Learning Experience', 3, 'step', 'Teacher delivers content through varied, age-appropriate activities that promote understanding of the lesson topic.', 4),
  ('Step 4 - Check for Understanding', 4, 'step', 'Teacher uses formative assessment strategies to verify students comprehension before moving forward.', 4),
  ('Step 5 - Consolidate Learning', 5, 'step', 'Teacher summarizes key points and helps students consolidate what they have learned.', 4),
  ('Classroom Management', 6, 'classroom_management', 'Teacher maintains a positive learning environment with clear expectations, smooth transitions, and effective time management.', 4),
  ('Active Learning', 7, 'active_learning', 'Students are actively engaged through discussion, collaboration, hands-on tasks, or inquiry-based activities.', 4),
  ('Assessment', 8, 'assessment', 'Teacher uses appropriate and varied assessment methods to evaluate student learning outcomes.', 4);
