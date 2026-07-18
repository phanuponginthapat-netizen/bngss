
-- =========================================
-- PHASE 1: FINANCE
-- =========================================
CREATE TABLE public.tuition_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  invoice_no text UNIQUE NOT NULL DEFAULT ('INV-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6)),
  title text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  academic_year text,
  semester int,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled','refunded')),
  paid_at timestamptz,
  paid_amount numeric(12,2),
  payment_method text,
  payment_ref text,
  qr_payload text,
  receipt_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tuition_invoices_student ON public.tuition_invoices(student_id);
CREATE INDEX idx_tuition_invoices_status ON public.tuition_invoices(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tuition_invoices TO authenticated;
GRANT ALL ON public.tuition_invoices TO service_role;
ALTER TABLE public.tuition_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_director_all_tuition" ON public.tuition_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "student_own_tuition_read" ON public.tuition_invoices FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid()));
CREATE POLICY "parent_child_tuition_read" ON public.tuition_invoices FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.scholarships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('general','kyoso','poor','talent','sports','academic','other')),
  amount_per_award numeric(12,2) NOT NULL DEFAULT 0,
  total_budget numeric(12,2),
  quota int,
  criteria text,
  academic_year text,
  apply_start date,
  apply_end date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('draft','open','closed','archived')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarships TO authenticated;
GRANT ALL ON public.scholarships TO service_role;
ALTER TABLE public.scholarships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scholarships_read_all" ON public.scholarships FOR SELECT TO authenticated USING (true);
CREATE POLICY "scholarships_admin_manage" ON public.scholarships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.scholarship_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scholarship_id uuid NOT NULL REFERENCES public.scholarships(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','disbursed','rejected','cancelled')),
  awarded_at timestamptz DEFAULT now(),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scholarship_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scholarship_awards TO authenticated;
GRANT ALL ON public.scholarship_awards TO service_role;
ALTER TABLE public.scholarship_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa_admin_all" ON public.scholarship_awards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "sa_student_read" ON public.scholarship_awards FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.coop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  member_no text UNIQUE NOT NULL,
  full_name text NOT NULL,
  shares int NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  loan_balance numeric(12,2) NOT NULL DEFAULT 0,
  joined_at date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','resigned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coop_members TO authenticated;
GRANT ALL ON public.coop_members TO service_role;
ALTER TABLE public.coop_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_members_admin" ON public.coop_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "coop_members_self_read" ON public.coop_members FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.coop_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.coop_members(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('deposit','withdraw','share_buy','share_sell','loan','repay','dividend','fee')),
  amount numeric(12,2) NOT NULL,
  balance_after numeric(12,2),
  reference text,
  notes text,
  performed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coop_transactions TO authenticated;
GRANT ALL ON public.coop_transactions TO service_role;
ALTER TABLE public.coop_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coop_tx_admin" ON public.coop_transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "coop_tx_self_read" ON public.coop_transactions FOR SELECT TO authenticated
  USING (member_id IN (SELECT id FROM public.coop_members WHERE user_id = auth.uid()));

-- =========================================
-- PHASE 2: OPERATIONS
-- =========================================
CREATE TABLE public.library_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  barcode text UNIQUE,
  isbn text,
  title text NOT NULL,
  author text,
  publisher text,
  category text,
  language text DEFAULT 'th',
  cover_url text,
  copies_total int NOT NULL DEFAULT 1 CHECK (copies_total >= 0),
  copies_available int NOT NULL DEFAULT 1 CHECK (copies_available >= 0),
  location text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_books TO authenticated;
GRANT ALL ON public.library_books TO service_role;
ALTER TABLE public.library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "library_books_read_all" ON public.library_books FOR SELECT TO authenticated USING (true);
CREATE POLICY "library_books_staff_manage" ON public.library_books FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE TABLE public.library_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES public.library_books(id) ON DELETE CASCADE,
  borrower_user_id uuid REFERENCES auth.users(id),
  borrower_student_id uuid REFERENCES public.students(id),
  loaned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz,
  fine_amount numeric(10,2) DEFAULT 0,
  fine_paid boolean DEFAULT false,
  notes text,
  loaned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_loans_book ON public.library_loans(book_id);
CREATE INDEX idx_loans_borrower ON public.library_loans(borrower_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.library_loans TO authenticated;
GRANT ALL ON public.library_loans TO service_role;
ALTER TABLE public.library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loans_staff_all" ON public.library_loans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "loans_self_read" ON public.library_loans FOR SELECT TO authenticated
  USING (borrower_user_id = auth.uid()
    OR borrower_student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.cafeteria_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  menu_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'lunch' CHECK (meal_type IN ('breakfast','lunch','snack')),
  name text NOT NULL,
  description text,
  price numeric(8,2) NOT NULL DEFAULT 0,
  capacity int,
  ordered_count int NOT NULL DEFAULT 0,
  image_url text,
  allergens text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_menus_date ON public.cafeteria_menus(menu_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafeteria_menus TO authenticated;
GRANT ALL ON public.cafeteria_menus TO service_role;
ALTER TABLE public.cafeteria_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "menus_read_all" ON public.cafeteria_menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "menus_staff_manage" ON public.cafeteria_menus FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE TABLE public.cafeteria_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.cafeteria_menus(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id),
  ordered_by uuid REFERENCES auth.users(id),
  qty int NOT NULL DEFAULT 1 CHECK (qty > 0),
  total_price numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','served','cancelled')),
  paid boolean NOT NULL DEFAULT false,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_menu ON public.cafeteria_orders(menu_id);
CREATE INDEX idx_orders_student ON public.cafeteria_orders(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cafeteria_orders TO authenticated;
GRANT ALL ON public.cafeteria_orders TO service_role;
ALTER TABLE public.cafeteria_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_staff_all" ON public.cafeteria_orders FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "orders_self_manage" ON public.cafeteria_orders FOR ALL TO authenticated
  USING (ordered_by = auth.uid() OR student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()))
  WITH CHECK (ordered_by = auth.uid() OR student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.bus_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  driver_personnel_id uuid REFERENCES public.personnel(id),
  vehicle_plate text,
  vehicle_color text,
  capacity int,
  monthly_fee numeric(10,2) DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_routes TO authenticated;
GRANT ALL ON public.bus_routes TO service_role;
ALTER TABLE public.bus_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bus_routes_read_all" ON public.bus_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "bus_routes_admin" ON public.bus_routes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.bus_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE,
  name text NOT NULL,
  lat double precision,
  lng double precision,
  sequence int NOT NULL DEFAULT 1,
  pickup_time time,
  dropoff_time time,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_stops TO authenticated;
GRANT ALL ON public.bus_stops TO service_role;
ALTER TABLE public.bus_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bus_stops_read_all" ON public.bus_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "bus_stops_admin" ON public.bus_stops FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.bus_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id uuid NOT NULL REFERENCES public.bus_routes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pickup_stop_id uuid REFERENCES public.bus_stops(id),
  dropoff_stop_id uuid REFERENCES public.bus_stops(id),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(route_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_students TO authenticated;
GRANT ALL ON public.bus_students TO service_role;
ALTER TABLE public.bus_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bus_students_admin" ON public.bus_students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "bus_students_self_read" ON public.bus_students FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

-- =========================================
-- PHASE 3: ACADEMIC+
-- =========================================
CREATE TABLE public.question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id),
  subject_name text,
  grade_level text,
  topic text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  question_type text NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq','tf','short','essay','fill')),
  question text NOT NULL,
  choices jsonb,
  correct_answer text,
  explanation text,
  tags text[],
  bloom_level text,
  owner_id uuid REFERENCES auth.users(id),
  is_public boolean NOT NULL DEFAULT true,
  usage_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_qb_subject ON public.question_bank(subject_id);
CREATE INDEX idx_qb_grade ON public.question_bank(grade_level);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank TO authenticated;
GRANT ALL ON public.question_bank TO service_role;
ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "qb_read_public_or_own" ON public.question_bank FOR SELECT TO authenticated
  USING (is_public = true OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "qb_teacher_insert" ON public.question_bank FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher')));
CREATE POLICY "qb_owner_update" ON public.question_bank FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qb_owner_delete" ON public.question_bank FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.tutoring_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) NOT NULL,
  subject_name text NOT NULL,
  topic text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  online_url text,
  capacity int NOT NULL DEFAULT 20 CHECK (capacity > 0),
  booked_count int NOT NULL DEFAULT 0,
  grade_levels text[],
  is_free boolean NOT NULL DEFAULT true,
  fee numeric(10,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','full','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoring_sessions TO authenticated;
GRANT ALL ON public.tutoring_sessions TO service_role;
ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tutoring_read_all" ON public.tutoring_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tutoring_teacher_manage" ON public.tutoring_sessions FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.tutoring_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tutoring_sessions(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id),
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked','attended','no_show','cancelled')),
  booked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutoring_bookings TO authenticated;
GRANT ALL ON public.tutoring_bookings TO service_role;
ALTER TABLE public.tutoring_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tb_staff_all" ON public.tutoring_bookings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "tb_self_manage" ON public.tutoring_bookings FOR ALL TO authenticated
  USING (user_id = auth.uid() OR student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()))
  WITH CHECK (user_id = auth.uid() OR student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.guidance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  counselor_id uuid REFERENCES auth.users(id),
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('career','personal','academic','family','health','general')),
  session_date date NOT NULL DEFAULT current_date,
  topic text NOT NULL,
  notes text,
  follow_up_at date,
  is_confidential boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guidance_records TO authenticated;
GRANT ALL ON public.guidance_records TO service_role;
ALTER TABLE public.guidance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guidance_staff_all" ON public.guidance_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR counselor_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR counselor_id = auth.uid());
CREATE POLICY "guidance_student_self_read_nonconf" ON public.guidance_records FOR SELECT TO authenticated
  USING (is_confidential = false AND student_id IN (SELECT id FROM public.students WHERE auth_user_id = auth.uid() OR parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

CREATE TABLE public.alumni_university (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.students(id),
  graduation_year int NOT NULL,
  university text NOT NULL,
  faculty text,
  major text,
  degree text,
  current_position text,
  current_company text,
  is_employed boolean DEFAULT false,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alumni_university TO authenticated;
GRANT ALL ON public.alumni_university TO service_role;
ALTER TABLE public.alumni_university ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alumni_uni_read_all" ON public.alumni_university FOR SELECT TO authenticated USING (true);
CREATE POLICY "alumni_uni_self_manage" ON public.alumni_university FOR ALL TO authenticated
  USING (alumni_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (alumni_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- =========================================
-- PHASE 4: ADMIN
-- =========================================
CREATE TABLE public.saraban_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('incoming','outgoing','internal')),
  book_no text,
  doc_no text NOT NULL,
  doc_date date NOT NULL,
  received_date date,
  subject text NOT NULL,
  from_org text,
  to_dept text,
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','urgent','very_urgent','immediate')),
  secrecy text NOT NULL DEFAULT 'normal' CHECK (secrecy IN ('normal','confidential','secret','top_secret')),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','assigned','in_progress','completed','archived')),
  assigned_to uuid REFERENCES auth.users(id),
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saraban_direction ON public.saraban_documents(direction);
CREATE INDEX idx_saraban_status ON public.saraban_documents(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saraban_documents TO authenticated;
GRANT ALL ON public.saraban_documents TO service_role;
ALTER TABLE public.saraban_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saraban_staff_all" ON public.saraban_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE TABLE public.mou_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  partner_name text NOT NULL,
  partner_contact text,
  subject text,
  scope text,
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','expired','terminated')),
  responsible_person uuid REFERENCES auth.users(id),
  file_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mou_records TO authenticated;
GRANT ALL ON public.mou_records TO service_role;
ALTER TABLE public.mou_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mou_read_all_staff" ON public.mou_records FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "mou_admin_manage" ON public.mou_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.room_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.special_rooms(id) ON DELETE CASCADE,
  room_name text,
  booked_by uuid REFERENCES auth.users(id) NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  purpose text NOT NULL,
  attendees_count int,
  equipment_needed text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by uuid REFERENCES auth.users(id),
  approval_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_room_bookings_room_time ON public.room_bookings(room_id, start_time);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_bookings TO authenticated;
GRANT ALL ON public.room_bookings TO service_role;
ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rb_read_all" ON public.room_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "rb_self_insert" ON public.room_bookings FOR INSERT TO authenticated WITH CHECK (booked_by = auth.uid());
CREATE POLICY "rb_self_update" ON public.room_bookings FOR UPDATE TO authenticated
  USING (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "rb_self_delete" ON public.room_bookings FOR DELETE TO authenticated
  USING (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.vehicle_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  vehicle_name text NOT NULL,
  vehicle_plate text,
  booked_by uuid REFERENCES auth.users(id) NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  destination text NOT NULL,
  purpose text NOT NULL,
  driver_name text,
  passengers_count int,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','in_use','completed','cancelled')),
  approved_by uuid REFERENCES auth.users(id),
  approval_notes text,
  odometer_start int,
  odometer_end int,
  fuel_cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_bookings TO authenticated;
GRANT ALL ON public.vehicle_bookings TO service_role;
ALTER TABLE public.vehicle_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vb_read_all" ON public.vehicle_bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "vb_self_insert" ON public.vehicle_bookings FOR INSERT TO authenticated WITH CHECK (booked_by = auth.uid());
CREATE POLICY "vb_self_update" ON public.vehicle_bookings FOR UPDATE TO authenticated
  USING (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));
CREATE POLICY "vb_self_delete" ON public.vehicle_bookings FOR DELETE TO authenticated
  USING (booked_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.sar_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  standard_no int NOT NULL CHECK (standard_no IN (1,2,3)),
  indicator_no text NOT NULL,
  indicator_name text NOT NULL,
  evidence_title text NOT NULL,
  description text,
  evidence_url text,
  quality_level text CHECK (quality_level IN ('excellent','very_good','good','fair','need_improve')),
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sar_year_std ON public.sar_evidences(academic_year, standard_no);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sar_evidences TO authenticated;
GRANT ALL ON public.sar_evidences TO service_role;
ALTER TABLE public.sar_evidences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sar_read_all_staff" ON public.sar_evidences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "sar_staff_manage" ON public.sar_evidences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

-- =========================================
-- PHASE 5: SECURITY+AI
-- =========================================
CREATE TABLE public.mfa_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_secret text,
  enabled boolean NOT NULL DEFAULT false,
  backup_codes text[],
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_settings TO authenticated;
GRANT ALL ON public.mfa_settings TO service_role;
ALTER TABLE public.mfa_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mfa_self_only" ON public.mfa_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  visitor_name text NOT NULL,
  visitor_phone text,
  id_card_last4 text,
  organization text,
  purpose text NOT NULL,
  contact_personnel_id uuid REFERENCES public.personnel(id),
  contact_person_name text,
  badge_no text,
  vehicle_plate text,
  check_in timestamptz NOT NULL DEFAULT now(),
  check_out timestamptz,
  photo_url text,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_visitor_checkin ON public.visitor_logs(check_in);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_logs TO authenticated;
GRANT ALL ON public.visitor_logs TO service_role;
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor_staff_all" ON public.visitor_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));

CREATE TABLE public.cctv_cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  location text NOT NULL,
  rtsp_url text,
  hls_url text,
  snapshot_url text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cctv_cameras TO authenticated;
GRANT ALL ON public.cctv_cameras TO service_role;
ALTER TABLE public.cctv_cameras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cctv_admin_only" ON public.cctv_cameras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.pdpa_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('access','correct','delete','export','restrict','withdraw_consent')),
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewing','approved','rejected','completed')),
  response_notes text,
  processed_by uuid REFERENCES auth.users(id),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdpa_requests TO authenticated;
GRANT ALL ON public.pdpa_requests TO service_role;
ALTER TABLE public.pdpa_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdpa_self_manage" ON public.pdpa_requests FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director'));

CREATE TABLE public.early_warning_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  alert_type text NOT NULL CHECK (alert_type IN ('attendance','grades','behavior','health','dropout_risk','combined')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  risk_score numeric(5,2) NOT NULL DEFAULT 0,
  factors jsonb,
  recommendation text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','intervening','resolved','dismissed')),
  assigned_to uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ew_student ON public.early_warning_alerts(student_id);
CREATE INDEX idx_ew_severity ON public.early_warning_alerts(severity, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.early_warning_alerts TO authenticated;
GRANT ALL ON public.early_warning_alerts TO service_role;
ALTER TABLE public.early_warning_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ew_staff_all" ON public.early_warning_alerts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director') OR public.has_role(auth.uid(),'teacher'));
CREATE POLICY "ew_parent_read" ON public.early_warning_alerts FOR SELECT TO authenticated
  USING (student_id IN (SELECT id FROM public.students WHERE parent_user_id = auth.uid() OR parent_user_id_2 = auth.uid()));

-- updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='update_updated_at_column' AND pronamespace='public'::regnamespace) THEN
    CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
  END IF;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tuition_invoices','scholarships','scholarship_awards','coop_members',
    'library_books','library_loans','cafeteria_menus','cafeteria_orders',
    'bus_routes','bus_stops','bus_students',
    'question_bank','tutoring_sessions','guidance_records','alumni_university',
    'saraban_documents','mou_records','room_bookings','vehicle_bookings','sar_evidences',
    'mfa_settings','cctv_cameras','pdpa_requests','early_warning_alerts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- realtime publication
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tuition_invoices','scholarships','scholarship_awards','coop_members','coop_transactions',
    'library_books','library_loans','cafeteria_menus','cafeteria_orders',
    'bus_routes','bus_stops','bus_students',
    'question_bank','tutoring_sessions','tutoring_bookings','guidance_records','alumni_university',
    'saraban_documents','mou_records','room_bookings','vehicle_bookings','sar_evidences',
    'mfa_settings','visitor_logs','cctv_cameras','pdpa_requests','early_warning_alerts'
  ]
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
