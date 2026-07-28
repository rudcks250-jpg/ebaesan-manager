-- 관리자와 직원 모두 이 단일 RPC를 사용해 완전히 동일한 주간 스케줄을 조회합니다.
create or replace function public.get_schedule_week_board(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if public.current_employee_id() is null then
    raise exception '인증된 직원만 스케줄을 조회할 수 있습니다.';
  end if;

  return jsonb_build_object(
    'employees',
    coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.name)
      from public.employees e
      where e.status = 'active'
    ), '[]'::jsonb),
    'shifts',
    coalesce((
      select jsonb_agg(to_jsonb(s) order by s.date, s.employee_id)
      from public.schedules s
      where s.date between p_start_date and p_end_date
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_schedule_week_board(date, date) from public, anon;
grant execute on function public.get_schedule_week_board(date, date) to authenticated;
