-- 월차 신청: 대상 직원과 월별 1회 사용 규칙을 DB에서도 강제합니다.
alter table public.employees
  add column if not exists monthly_leave_eligible boolean not null default false;

update public.employees
set monthly_leave_eligible = true,
    updated_at = now()
where lower(btrim(name)) in (lower(btrim('김경재')), lower(btrim('김하은')));

alter table public.leave_requests
  add column if not exists leave_type text not null default 'regular';

alter table public.leave_requests
  drop constraint if exists leave_requests_leave_type_check;

alter table public.leave_requests
  add constraint leave_requests_leave_type_check
  check (leave_type in ('regular', 'monthly'));

create unique index if not exists uq_leave_requests_monthly_active
  on public.leave_requests (
    employee_id,
    (extract(year from requested_date)),
    (extract(month from requested_date))
  )
  where leave_type = 'monthly' and status <> 'rejected';

create or replace function public.validate_monthly_leave_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eligible boolean;
begin
  if new.leave_type <> 'monthly' then
    return new;
  end if;

  select e.monthly_leave_eligible
  into v_eligible
  from public.employees e
  where e.id = new.employee_id;

  if coalesce(v_eligible, false) is not true then
    raise exception '월차 신청 권한이 없습니다.';
  end if;

  if new.status <> 'rejected' and exists (
    select 1
    from public.leave_requests lr
    where lr.employee_id = new.employee_id
      and lr.leave_type = 'monthly'
      and lr.status <> 'rejected'
      and extract(year from lr.requested_date) = extract(year from new.requested_date)
      and extract(month from lr.requested_date) = extract(month from new.requested_date)
      and lr.id <> coalesce(new.id, gen_random_uuid())
  ) then
    raise exception '해당 월의 월차를 이미 신청하거나 사용했습니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_monthly_leave_request on public.leave_requests;
create trigger trg_validate_monthly_leave_request
before insert or update of employee_id, requested_date, leave_type, status
on public.leave_requests
for each row execute function public.validate_monthly_leave_request();
