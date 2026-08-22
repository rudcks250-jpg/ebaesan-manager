-- 승인 요청 방식을 직원 본인 즉시 사용 방식으로 전환합니다.
alter table public.employee_discount_requests add column if not exists memo text;

update public.employee_discount_requests
set status = 'cancelled', updated_at = now()
where status = 'pending';

create or replace function public.use_employee_discount(p_original_amount integer, p_memo text default null)
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
  if v_employee.id is null or v_employee.status <> 'active' then
    raise exception '재직 중인 직원만 사용할 수 있습니다.' using errcode='P0001';
  end if;
  if p_original_amount is null or p_original_amount <= 0 then
    raise exception '결제 전 금액을 입력해주세요.' using errcode='P0001';
  end if;
  select coalesce(monthly_limit,2), coalesce(discount_rate,0.20) into v_limit,v_rate
    from employee_discount_settings where employee_id=v_employee.id;
  if not found then v_limit:=2; v_rate:=0.20; end if;
  select count(*) into v_used from employee_discount_requests
    where employee_id=v_employee.id and status='completed'
      and requested_at >= date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul'
      and requested_at < (date_trunc('month', now() at time zone 'Asia/Seoul') + interval '1 month') at time zone 'Asia/Seoul';
  if v_used >= v_limit then
    raise exception '이번 달 할인 횟수를 모두 사용했습니다.' using errcode='P0001';
  end if;
  insert into employee_discount_requests(
    employee_id, requested_at, expires_at, status, original_amount, discount_rate,
    discount_amount, final_amount, processed_at, processed_by, memo
  ) values (
    v_employee.id, now(), now(), 'completed', p_original_amount, v_rate,
    round(p_original_amount*v_rate), p_original_amount-round(p_original_amount*v_rate),
    now(), v_employee.id, nullif(trim(p_memo),'')
  ) returning * into v_result;
  return v_result;
end $$;

revoke all on function public.use_employee_discount(integer,text) from public,anon;
grant execute on function public.use_employee_discount(integer,text) to authenticated;

-- 관리자 수정 함수에 메모를 포함합니다. 기존 호출과 호환되도록 기본값을 둡니다.
create or replace function public.admin_save_employee_discount(
  p_request_id uuid, p_employee_id uuid, p_requested_at timestamptz,
  p_original_amount integer, p_memo text default null
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
    insert into employee_discount_requests(employee_id,requested_at,expires_at,status,original_amount,discount_rate,discount_amount,final_amount,processed_at,processed_by,memo)
    values(p_employee_id,p_requested_at,p_requested_at,'completed',p_original_amount,v_rate,round(p_original_amount*v_rate),p_original_amount-round(p_original_amount*v_rate),now(),v_actor,nullif(trim(p_memo),''))
    returning * into v_result;
  else
    update employee_discount_requests set employee_id=p_employee_id,requested_at=p_requested_at,original_amount=p_original_amount,
      discount_rate=v_rate,discount_amount=round(p_original_amount*v_rate),final_amount=p_original_amount-round(p_original_amount*v_rate),memo=nullif(trim(p_memo),'')
      where id=p_request_id returning * into v_result;
  end if;
  return v_result;
end $$;

revoke all on function public.admin_save_employee_discount(uuid,uuid,timestamptz,integer,text) from public,anon;
grant execute on function public.admin_save_employee_discount(uuid,uuid,timestamptz,integer,text) to authenticated;
