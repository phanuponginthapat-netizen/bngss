-- 1) ฟังก์ชันฝั่งแอดมินที่มีการตรวจสิทธิ์ในตัวอยู่แล้ว — คืนสิทธิ์เรียกให้ผู้ใช้ที่ล็อกอิน
GRANT EXECUTE ON FUNCTION public.get_cloud_usage_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_purge_preview(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_and_purge_old_data(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_old_data() TO authenticated;

-- 2) get_db_schema: ใส่การตรวจสิทธิ์ admin/director ไว้ในตัวฟังก์ชัน แล้วเปิดให้เรียกได้
CREATE OR REPLACE FUNCTION public.get_db_schema()
RETURNS TABLE(table_name text, columns jsonb, col_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'director')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT c.table_name::text,
         jsonb_agg(jsonb_build_object(
           'name', c.column_name, 'type', c.data_type,
           'nullable', c.is_nullable, 'default', c.column_default
         ) ORDER BY c.ordinal_position) AS columns,
         count(*)::int AS col_count
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name
  ORDER BY c.table_name;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_db_schema() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_db_schema() TO authenticated, service_role;

-- 3) หน้า /find (สาธารณะ) ต้องค้นรหัสได้โดยไม่ต้องล็อกอิน
GRANT EXECUTE ON FUNCTION public.find_profile_id_by_code(text) TO anon;
