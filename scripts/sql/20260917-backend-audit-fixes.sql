-- 2026-09-17 backend audit fixes (already applied on gwmszzoqqxmejefhayqf)
-- 1) Pin search_path on functions flagged by the security advisor
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'calculate_leave_balances','update_leave_used_days',
        'set_grade_lock_updated_at','set_grade_remediation_updated_at',
        'is_holiday','attendance_rate_excluding_holidays')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- 2) Drop duplicate indexes (identical to the kept ones)
drop index if exists public.idx_cert_issues_student;
drop index if exists public.game_hub_scores_student_idx;
drop index if exists public.idx_lc_owner;
drop index if exists public.idx_padlet_boards_owner;
drop index if exists public.idx_enroll_hist_student;
