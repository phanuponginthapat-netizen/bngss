CREATE OR REPLACE FUNCTION public.compare_write_task_json(_task_id uuid, _column text, _expected jsonb, _next jsonb)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF _column = 'submissions' THEN
    RETURN QUERY UPDATE public.task_assignments SET submissions = _next
      WHERE id = _task_id AND submissions IS NOT DISTINCT FROM _expected RETURNING id;
  ELSIF _column = 'replies' THEN
    RETURN QUERY UPDATE public.task_assignments SET replies = _next
      WHERE id = _task_id AND replies IS NOT DISTINCT FROM _expected RETURNING id;
  ELSE
    RAISE EXCEPTION 'Invalid column';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.compare_write_task_json(uuid,text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compare_write_task_json(uuid,text,jsonb,jsonb) TO authenticated, service_role;