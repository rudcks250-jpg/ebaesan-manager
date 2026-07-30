-- 선결제를 고객별 입금/사용 거래 원장 방식으로 전환합니다.
create table if not exists public.prepaid_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  contact_person text,
  phone text not null,
  memo text,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prepaid_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.prepaid_customers(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit', 'usage')),
  amount bigint not null check (amount > 0),
  transaction_date date not null default current_date,
  memo text,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prepaid_customers_name
  on public.prepaid_customers(name);
create index if not exists idx_prepaid_transactions_customer_date
  on public.prepaid_transactions(customer_id, transaction_date desc, created_at desc);

drop trigger if exists trg_prepaid_customers_updated_at on public.prepaid_customers;
create trigger trg_prepaid_customers_updated_at
  before update on public.prepaid_customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prepaid_transactions_updated_at on public.prepaid_transactions;
create trigger trg_prepaid_transactions_updated_at
  before update on public.prepaid_transactions
  for each row execute function public.set_updated_at();

-- 기존 회사형 선결제 데이터를 고객/거래 원장으로 안전하게 이전합니다.
insert into public.prepaid_customers (
  id, name, company_name, contact_person, phone, memo,
  created_by, created_by_name, created_at, updated_at
)
select
  a.id,
  a.contact_person,
  a.company_name,
  a.contact_person,
  coalesce(a.phone, ''),
  a.memo,
  a.created_by,
  a.created_by_name,
  a.created_at,
  a.updated_at
from public.prepaid_accounts a
on conflict (id) do nothing;

insert into public.prepaid_transactions (
  id, customer_id, transaction_type, amount, transaction_date, memo,
  created_by, created_by_name, created_at, updated_at
)
select
  gen_random_uuid(),
  a.id,
  'deposit',
  a.initial_amount,
  (a.created_at at time zone 'Asia/Seoul')::date,
  '기존 선결제 데이터 이전',
  a.created_by,
  a.created_by_name,
  a.created_at,
  a.created_at
from public.prepaid_accounts a
where not exists (
  select 1 from public.prepaid_transactions t
  where t.customer_id = a.id and t.memo = '기존 선결제 데이터 이전'
);

insert into public.prepaid_transactions (
  id, customer_id, transaction_type, amount, transaction_date, memo,
  created_by, created_by_name, created_at, updated_at
)
select
  u.id,
  u.account_id,
  'usage',
  u.amount,
  (u.used_at at time zone 'Asia/Seoul')::date,
  u.memo,
  u.used_by,
  u.used_by_name,
  u.used_at,
  u.used_at
from public.prepaid_usages u
on conflict (id) do nothing;

create or replace function public.assert_prepaid_ledger_valid(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_balance bigint;
begin
  select min(running_balance)
  into v_min_balance
  from (
    select sum(
      case when transaction_type = 'deposit' then amount else -amount end
    ) over (
      order by transaction_date, created_at, id
      rows between unbounded preceding and current row
    ) as running_balance
    from public.prepaid_transactions
    where customer_id = p_customer_id
  ) ledger;

  if coalesce(v_min_balance, 0) < 0 then
    raise exception '잔액이 부족합니다.';
  end if;
end;
$$;

create or replace function public.save_prepaid_transaction(
  p_customer_id uuid,
  p_transaction_type text,
  p_amount bigint,
  p_transaction_date date,
  p_memo text default null,
  p_transaction_id uuid default null
)
returns public.prepaid_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
  v_transaction public.prepaid_transactions;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if p_transaction_type not in ('deposit', 'usage') then raise exception '거래 종류가 올바르지 않습니다.'; end if;
  if p_amount <= 0 then raise exception '금액은 0원보다 커야 합니다.'; end if;
  if p_transaction_date is null then raise exception '거래일을 입력해주세요.'; end if;

  perform 1 from public.prepaid_customers where id = p_customer_id for update;
  if not found then raise exception '고객을 찾을 수 없습니다.'; end if;
  select * into v_employee from public.employees where id = public.current_employee_id();

  if p_transaction_id is null then
    insert into public.prepaid_transactions (
      customer_id, transaction_type, amount, transaction_date, memo, created_by, created_by_name
    )
    values (
      p_customer_id, p_transaction_type, p_amount, p_transaction_date,
      nullif(btrim(p_memo), ''), v_employee.id, v_employee.name
    )
    returning * into v_transaction;
  else
    update public.prepaid_transactions
    set transaction_type = p_transaction_type,
        amount = p_amount,
        transaction_date = p_transaction_date,
        memo = nullif(btrim(p_memo), '')
    where id = p_transaction_id and customer_id = p_customer_id
    returning * into v_transaction;
    if not found then raise exception '거래내역을 찾을 수 없습니다.'; end if;
  end if;

  perform public.assert_prepaid_ledger_valid(p_customer_id);
  return v_transaction;
end;
$$;

create or replace function public.delete_prepaid_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  select customer_id into v_customer_id
  from public.prepaid_transactions
  where id = p_transaction_id
  for update;
  if not found then raise exception '거래내역을 찾을 수 없습니다.'; end if;

  perform 1 from public.prepaid_customers where id = v_customer_id for update;
  delete from public.prepaid_transactions where id = p_transaction_id;
  perform public.assert_prepaid_ledger_valid(v_customer_id);
end;
$$;

revoke all on function public.assert_prepaid_ledger_valid(uuid) from public, anon, authenticated;
revoke all on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid) from public, anon;
grant execute on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid) to authenticated;
revoke all on function public.delete_prepaid_transaction(uuid) from public, anon;
grant execute on function public.delete_prepaid_transaction(uuid) to authenticated;

alter table public.prepaid_customers enable row level security;
alter table public.prepaid_transactions enable row level security;

drop policy if exists prepaid_customers_managers_select on public.prepaid_customers;
create policy prepaid_customers_managers_select on public.prepaid_customers
  for select using (public.can_manage_prepayments());

drop policy if exists prepaid_customers_managers_insert on public.prepaid_customers;
create policy prepaid_customers_managers_insert on public.prepaid_customers
  for insert
  with check (
    public.can_manage_prepayments()
    and created_by = public.current_employee_id()
  );

drop policy if exists prepaid_customers_managers_update on public.prepaid_customers;
create policy prepaid_customers_managers_update on public.prepaid_customers
  for update using (public.can_manage_prepayments())
  with check (public.can_manage_prepayments());

drop policy if exists prepaid_customers_managers_delete on public.prepaid_customers;
create policy prepaid_customers_managers_delete on public.prepaid_customers
  for delete using (public.can_manage_prepayments());

drop policy if exists prepaid_transactions_managers_select on public.prepaid_transactions;
create policy prepaid_transactions_managers_select on public.prepaid_transactions
  for select using (public.can_manage_prepayments());
