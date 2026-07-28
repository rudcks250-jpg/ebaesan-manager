-- 직원에게는 개인정보를 제외한 스케줄용 직원 목록만 제공합니다.
create or replace function public.list_schedule_employees()
returns table(id uuid, name text)
language sql
security definer
stable
set search_path = public
as $$
  select e.id, e.name
  from public.employees e
  where e.status = 'active'
    and public.current_employee_id() is not null
  order by e.name;
$$;

revoke all on function public.list_schedule_employees() from public, anon;
grant execute on function public.list_schedule_employees() to authenticated;

-- 인증된 직원은 모든 직원의 스케줄을 조회할 수 있지만 쓰기 정책은 없습니다.
drop policy if exists schedules_self_select on public.schedules;
drop policy if exists schedules_staff_select_all on public.schedules;
create policy schedules_staff_select_all on public.schedules
  for select using (public.current_employee_id() is not null);
