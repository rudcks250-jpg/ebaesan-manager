-- 직원 이름을 로그인 아이디로 사용하므로 정규화된 이름의 중복을 차단합니다.
create unique index if not exists uq_employees_login_name
  on public.employees (lower(btrim(name)));

create or replace function public.lookup_login_email(p_name text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select login_email
  from public.employees
  where lower(btrim(name)) = lower(btrim(p_name))
    and status <> 'resigned'
  limit 1;
$$;

grant execute on function public.lookup_login_email(text) to anon, authenticated;

create or replace function public.complete_first_login(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.employees
  set is_first_login = false
  where id = p_employee_id and auth_user_id = auth.uid();

  if not found then
    raise exception '직원 정보를 확인할 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.complete_first_login(uuid) from public, anon;
grant execute on function public.complete_first_login(uuid) to authenticated;

drop policy if exists employees_self_update_first_login on public.employees;
