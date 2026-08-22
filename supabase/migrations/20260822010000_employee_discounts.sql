-- 직원 식사 할인: 월별 잔여 횟수는 완료 기록을 기준으로 계산해 이월 없이 자동 초기화합니다.
create table if not exists public.employee_discount_settings (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  monthly_limit integer not null default 2 check (monthly_limit >= 0 and monthly_limit <= 31),
  discount_rate numeric(5,4) not null default 0.20 check (discount_rate >= 0 and discount_rate <= 1),
  updated_by uuid references public.employees(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_discount_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  status text not null default 'pending' check (status in ('pending','completed','cancelled','expired')),
  original_amount integer check (original_amount is null or original_amount >= 0),
  discount_rate numeric(5,4) not null default 0.20 check (discount_rate >= 0 and discount_rate <= 1),
  discount_amount integer check (discount_amount is null or discount_amount >= 0),
  final_amount integer check (final_amount is null or final_amount >= 0),
  processed_at timestamptz,
  processed_by uuid references public.employees(id) on delete set null,
  restored_at timestamptz,
  restored_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employee_discount_employee_month
  on public.employee_discount_requests(employee_id, requested_at desc);
create index if not exists idx_employee_discount_today
  on public.employee_discount_requests(requested_at desc, status);
create unique index if not exists idx_employee_discount_one_pending
  on public.employee_discount_requests(employee_id) where status = 'pending';

drop trigger if exists trg_employee_discount_settings_updated_at on public.employee_discount_settings;
create trigger trg_employee_discount_settings_updated_at before update on public.employee_discount_settings
for each row execute function public.set_updated_at();
drop trigger if exists trg_employee_discount_requests_updated_at on public.employee_discount_requests;
create trigger trg_employee_discount_requests_updated_at before update on public.employee_discount_requests
for each row execute function public.set_updated_at();

alter table public.employee_discount_settings enable row level security;
alter table public.employee_discount_requests enable row level security;

drop policy if exists employee_discount_settings_read on public.employee_discount_settings;
create policy employee_discount_settings_read on public.employee_discount_settings for select to authenticated
using (employee_id = public.current_employee_id() or public.is_admin());
drop policy if exists employee_discount_settings_admin on public.employee_discount_settings;
create policy employee_discount_settings_admin on public.employee_discount_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists employee_discount_requests_read on public.employee_discount_requests;
create policy employee_discount_requests_read on public.employee_discount_requests for select to authenticated
using (
  employee_id = public.current_employee_id()
  or public.is_admin()
  or requested_at >= date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
);
drop policy if exists employee_discount_requests_create on public.employee_discount_requests;
create policy employee_discount_requests_create on public.employee_discount_requests for insert to authenticated
with check (employee_id = public.current_employee_id());
drop policy if exists employee_discount_requests_admin on public.employee_discount_requests;
create policy employee_discount_requests_admin on public.employee_discount_requests for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.create_employee_discount_request()
returns public.employee_discount_requests
language plpgsql security definer set search_path = public
as $$
declare
  v_employee employees%rowtype;
  v_limit integer;
  v_rate numeric;
  v_used integer;
  v_result employee_discount_requests%rowtype;
begin
  select * into v_employee from employees where auth_user_id = auth.uid() for update;
  if v_employee.id is null or v_employee.status <> 'active' then raise exception '재직 중인 직원만 사용할 수 있습니다.' using errcode='P0001'; end if;
  update employee_discount_requests set status='expired'
    where employee_id=v_employee.id and status='pending' and expires_at <= now();
  if exists(select 1 from employee_discount_requests where employee_id=v_employee.id and status='pending') then
    raise exception '이미 진행 중인 할인 요청이 있습니다.' using errcode='P0001';
  end if;
  select coalesce(monthly_limit,2), coalesce(discount_rate,0.20) into v_limit,v_rate
    from employee_discount_settings where employee_id=v_employee.id;
  if not found then v_limit:=2; v_rate:=0.20; end if;
  select count(*) into v_used from employee_discount_requests
    where employee_id=v_employee.id and status='completed'
      and requested_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
      and requested_at < (date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul';
  if v_used >= v_limit then raise exception '이번 달 할인 횟수를 모두 사용했습니다.' using errcode='P0001'; end if;
  insert into employee_discount_requests(employee_id,discount_rate) values(v_employee.id,v_rate) returning * into v_result;
  return v_result;
end $$;

create or replace function public.complete_employee_discount_request(p_request_id uuid, p_original_amount integer)
returns public.employee_discount_requests
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid; v_request employee_discount_requests%rowtype; v_limit integer; v_used integer;
begin
  v_actor:=public.current_employee_id();
  if v_actor is null then raise exception '로그인이 필요합니다.' using errcode='P0001'; end if;
  select * into v_request from employee_discount_requests where id=p_request_id for update;
  if v_request.id is null then raise exception '요청을 찾을 수 없습니다.' using errcode='P0001'; end if;
  if v_request.status <> 'pending' then raise exception '이미 처리된 요청입니다.' using errcode='P0001'; end if;
  if v_request.expires_at <= now() then
    update employee_discount_requests set status='expired' where id=p_request_id returning * into v_request;
    return v_request;
  end if;
  if p_original_amount <= 0 then raise exception '결제 전 금액을 입력해주세요.' using errcode='P0001'; end if;
  select coalesce(monthly_limit,2) into v_limit from employee_discount_settings where employee_id=v_request.employee_id;
  if not found then v_limit:=2; end if;
  select count(*) into v_used from employee_discount_requests
    where employee_id=v_request.employee_id and status='completed'
      and requested_at >= date_trunc('month', v_request.requested_at at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
      and requested_at < (date_trunc('month', v_request.requested_at at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul';
  if v_used >= v_limit then raise exception '해당 직원의 이번 달 할인 횟수가 없습니다.' using errcode='P0001'; end if;
  update employee_discount_requests set status='completed', original_amount=p_original_amount,
    discount_amount=round(p_original_amount*discount_rate), final_amount=p_original_amount-round(p_original_amount*discount_rate),
    processed_at=now(), processed_by=v_actor where id=p_request_id returning * into v_request;
  return v_request;
end $$;

create or replace function public.cancel_employee_discount_request(p_request_id uuid)
returns public.employee_discount_requests
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid; v_admin boolean; v_request employee_discount_requests%rowtype;
begin
  v_actor:=public.current_employee_id(); v_admin:=public.is_admin();
  select * into v_request from employee_discount_requests where id=p_request_id for update;
  if v_request.id is null then raise exception '요청을 찾을 수 없습니다.' using errcode='P0001'; end if;
  if v_request.status='completed' and not v_admin then raise exception '완료 내역 취소는 관리자만 가능합니다.' using errcode='42501'; end if;
  if v_request.status not in ('pending','completed') then raise exception '취소할 수 없는 요청입니다.' using errcode='P0001'; end if;
  update employee_discount_requests set status='cancelled', restored_at=case when v_request.status='completed' then now() else null end,
    restored_by=case when v_request.status='completed' then v_actor else null end where id=p_request_id returning * into v_request;
  return v_request;
end $$;

create or replace function public.admin_save_employee_discount(
  p_request_id uuid, p_employee_id uuid, p_requested_at timestamptz, p_original_amount integer
)
returns public.employee_discount_requests
language plpgsql security definer set search_path = public
as $$
declare v_rate numeric; v_actor uuid; v_result employee_discount_requests%rowtype;
begin
  if not public.is_admin() then raise exception '관리자만 수정할 수 있습니다.' using errcode='42501'; end if;
  if p_original_amount <= 0 then raise exception '결제 전 금액을 입력해주세요.' using errcode='P0001'; end if;
  v_actor:=public.current_employee_id();
  select coalesce(discount_rate,0.20) into v_rate from employee_discount_settings where employee_id=p_employee_id;
  if not found then v_rate:=0.20; end if;
  if p_request_id is null then
    insert into employee_discount_requests(employee_id,requested_at,expires_at,status,original_amount,discount_rate,discount_amount,final_amount,processed_at,processed_by)
    values(p_employee_id,p_requested_at,p_requested_at,'completed',p_original_amount,v_rate,round(p_original_amount*v_rate),p_original_amount-round(p_original_amount*v_rate),now(),v_actor)
    returning * into v_result;
  else
    update employee_discount_requests set employee_id=p_employee_id,requested_at=p_requested_at,original_amount=p_original_amount,
      discount_rate=v_rate,discount_amount=round(p_original_amount*v_rate),final_amount=p_original_amount-round(p_original_amount*v_rate)
      where id=p_request_id returning * into v_result;
  end if;
  return v_result;
end $$;

revoke all on function public.create_employee_discount_request() from public,anon;
revoke all on function public.complete_employee_discount_request(uuid,integer) from public,anon;
revoke all on function public.cancel_employee_discount_request(uuid) from public,anon;
revoke all on function public.admin_save_employee_discount(uuid,uuid,timestamptz,integer) from public,anon;
grant execute on function public.create_employee_discount_request() to authenticated;
grant execute on function public.complete_employee_discount_request(uuid,integer) to authenticated;
grant execute on function public.cancel_employee_discount_request(uuid) to authenticated;
grant execute on function public.admin_save_employee_discount(uuid,uuid,timestamptz,integer) to authenticated;
