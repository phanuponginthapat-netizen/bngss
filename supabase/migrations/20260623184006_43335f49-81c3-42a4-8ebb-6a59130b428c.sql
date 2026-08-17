CREATE OR REPLACE FUNCTION public.normalize_department_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    replace(
      replace(
        replace(
          lower(coalesce(_name, '')),
          'ฝ่ายงาน',
          ''
        ),
        'ฝ่าย',
        ''
      ),
      'งาน',
      ''
    ),
    '\s+',
    '',
    'g'
  );
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.normalize_department_name(text) FROM PUBLIC';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.normalize_department_name(text) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.normalize_department_name(text) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
CREATE OR REPLACE FUNCTION public.is_document_recipient(_doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_recipients dr
    LEFT JOIN public.profiles p ON p.id = _user
    WHERE dr.document_id = _doc
      AND (
        dr.recipient_user_id = _user
        OR (
          dr.recipient_type = 'department'
          AND p.department IS NOT NULL
          AND public.normalize_department_name(dr.recipient_name) = public.normalize_department_name(p.department)
        )
        OR (
          dr.recipient_type = 'department'
          AND public.has_role(_user, 'director')
          AND public.normalize_department_name(dr.recipient_name) = public.normalize_department_name('ผู้อำนวยการ')
        )
      )
  );
$$;
CREATE OR REPLACE FUNCTION public.can_access_document_recipient(_recipient_row uuid, _doc uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.document_recipients dr
    LEFT JOIN public.profiles p ON p.id = _user
    WHERE dr.id = _recipient_row
      AND dr.document_id = _doc
      AND (
        dr.recipient_user_id = _user
        OR (
          dr.recipient_type = 'department'
          AND p.department IS NOT NULL
          AND public.normalize_department_name(dr.recipient_name) = public.normalize_department_name(p.department)
        )
        OR (
          dr.recipient_type = 'department'
          AND public.has_role(_user, 'director')
          AND public.normalize_department_name(dr.recipient_name) = public.normalize_department_name('ผู้อำนวยการ')
        )
        OR public.has_role(_user, 'admin')
        OR public.has_role(_user, 'director')
        OR public.is_document_owner(_doc, _user)
      )
  );
$$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.is_document_recipient(uuid, uuid) FROM PUBLIC';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'REVOKE ALL ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) FROM PUBLIC';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO authenticated';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_document_recipient(uuid, uuid) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
DO $guard$
BEGIN
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_access_document_recipient(uuid, uuid, uuid) TO service_role';
EXCEPTION WHEN undefined_table OR undefined_column OR undefined_function OR undefined_object OR undefined_parameter OR invalid_text_representation OR duplicate_object OR duplicate_table THEN
  RAISE NOTICE 'skipped: %', SQLERRM;
END
$guard$;
