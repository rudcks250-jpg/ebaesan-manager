-- 5초 내 검색/등록을 위한 원자적 신규·추가 선결제 함수
create or replace function public.create_or_add_prepaid_deposit(
  p_name text,
  p_phone text,
  p_amount bigint,
  p_transaction_date date,
  p_memo text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
  v_customer public.prepaid_customers;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if nullif(btrim(p_name), '') is null then raise exception '고객 이름을 입력해주세요.'; end if;
  if p_amount <= 0 then raise exception '선결제 금액은 0원보다 커야 합니다.'; end if;
  if p_transaction_date is null then raise exception '선결제 날짜를 입력해주세요.'; end if;

  -- 전화번호가 같으면 우선 동일 고객, 전화번호가 없으면 이름이 정확히 같은 고객을 찾습니다.
  select * into v_customer
  from public.prepaid_customers c
  where c.deleted_at is null
    and (
      (nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
       and regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
      or lower(btrim(c.name)) = lower(btrim(p_name))
    )
  order by
    case when regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')
      then 0 else 1 end,
    c.created_at
  limit 1
  for update;

  select * into v_employee from public.employees where id = public.current_employee_id();

  if v_customer.id is null then
    insert into public.prepaid_customers(
      name, phone, created_by, created_by_name
    ) values (
      btrim(p_name), regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'),
      v_employee.id, v_employee.name
    )
    returning * into v_customer;
  elsif nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
    and nullif(v_customer.phone, '') is null then
    update public.prepaid_customers
    set phone = regexp_replace(p_phone, '\D', '', 'g')
    where id = v_customer.id;
  end if;

  perform public.save_prepaid_transaction(
    v_customer.id, 'deposit', p_amount, p_transaction_date,
    nullif(btrim(p_memo), ''), null, null
  );

  return v_customer.id;
end;
$$;

revoke all on function public.create_or_add_prepaid_deposit(text,text,bigint,date,text) from public, anon;
grant execute on function public.create_or_add_prepaid_deposit(text,text,bigint,date,text) to authenticated;
