-- 직원을 삭제하지 않고 퇴사 처리하며, 과거 기록은 보존합니다.
alter table public.employees
  add column if not exists resign_memo text;

-- 퇴사/비활성 계정의 기존 Auth 세션이 남아 있어도 업무 데이터에 접근하지 못하게 합니다.
create or replace function public.current_employee_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = auth.uid()
    and e.status = 'active'
  limit 1;
$$;

create or replace function public.resign_employee(
  p_employee_id uuid,
  p_resign_date date,
  p_resign_memo text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted_count integer := 0;
  v_target_role text;
begin
  if not public.is_admin() then
    raise exception '관리자만 퇴사 처리할 수 있습니다.' using errcode = '42501';
  end if;
  if p_resign_date is null then
    raise exception '퇴사일을 입력해주세요.' using errcode = '22004';
  end if;

  select role into v_target_role from public.employees where id = p_employee_id for update;
  if not found then
    raise exception '직원 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_target_role = 'admin' then
    raise exception '대표 계정은 퇴사 처리할 수 없습니다.' using errcode = '42501';
  end if;

  update public.employees
  set status = 'resigned',
      resign_date = p_resign_date,
      resign_memo = nullif(btrim(coalesce(p_resign_memo, '')), ''),
      updated_at = now()
  where id = p_employee_id;

  -- 퇴사일까지의 스케줄과 모든 과거 기록은 보존하고, 이후 일정만 정리합니다.
  delete from public.schedules
  where employee_id = p_employee_id
    and date > p_resign_date;
  get diagnostics v_deleted_count = row_count;
  return v_deleted_count;
end;
$$;

create or replace function public.restore_employee(p_employee_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 재직 복구할 수 있습니다.' using errcode = '42501';
  end if;

  update public.employees
  set status = 'active',
      resign_date = null,
      resign_memo = null,
      updated_at = now()
  where id = p_employee_id and status = 'resigned';

  if not found then
    raise exception '복구할 퇴사자 정보를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.resign_employee(uuid,date,text) from public, anon;
grant execute on function public.resign_employee(uuid,date,text) to authenticated;
revoke all on function public.restore_employee(uuid) from public, anon;
grant execute on function public.restore_employee(uuid) to authenticated;

notify pgrst, 'reload schema';
