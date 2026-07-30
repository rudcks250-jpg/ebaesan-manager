-- 회사별 선결제 잔액 및 사용 내역
create table if not exists public.prepaid_accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text not null,
  phone text,
  initial_amount bigint not null check (initial_amount > 0),
  balance bigint not null check (balance >= 0),
  memo text,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prepaid_usages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.prepaid_accounts(id) on delete cascade,
  amount bigint not null check (amount > 0),
  memo text,
  used_by uuid not null references public.employees(id) on delete restrict,
  used_by_name text not null,
  used_at timestamptz not null default now()
);

create index if not exists idx_prepaid_accounts_company
  on public.prepaid_accounts(company_name);
create index if not exists idx_prepaid_usages_account_latest
  on public.prepaid_usages(account_id, used_at desc);

drop trigger if exists trg_prepaid_accounts_updated_at on public.prepaid_accounts;
create trigger trg_prepaid_accounts_updated_at
  before update on public.prepaid_accounts
  for each row execute function public.set_updated_at();

create or replace function public.can_manage_prepayments()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.auth_user_id = auth.uid()
      and e.status = 'active'
      and e.name in ('박경찬', '김경재', '김하은')
  );
$$;

create or replace function public.register_prepaid_usage(
  p_account_id uuid,
  p_amount bigint,
  p_memo text default null
)
returns public.prepaid_usages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.prepaid_accounts;
  v_employee public.employees;
  v_usage public.prepaid_usages;
begin
  if not public.can_manage_prepayments() then
    raise exception '선결제 관리 권한이 없습니다.';
  end if;
  if p_amount <= 0 then
    raise exception '사용 금액은 0원보다 커야 합니다.';
  end if;

  select * into v_account
  from public.prepaid_accounts
  where id = p_account_id
  for update;
  if not found then raise exception '선결제 회사를 찾을 수 없습니다.'; end if;
  if v_account.balance < p_amount then raise exception '잔액이 부족합니다.'; end if;

  select * into v_employee
  from public.employees
  where id = public.current_employee_id();

  update public.prepaid_accounts
  set balance = balance - p_amount
  where id = p_account_id;

  insert into public.prepaid_usages(account_id, amount, memo, used_by, used_by_name)
  values (p_account_id, p_amount, nullif(btrim(p_memo), ''), v_employee.id, v_employee.name)
  returning * into v_usage;

  return v_usage;
end;
$$;

create or replace function public.update_prepaid_account(
  p_account_id uuid,
  p_initial_amount bigint,
  p_memo text default null
)
returns public.prepaid_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.prepaid_accounts;
  v_used bigint;
begin
  if not public.can_manage_prepayments() then
    raise exception '선결제 관리 권한이 없습니다.';
  end if;
  if p_initial_amount <= 0 then
    raise exception '선결제 금액은 0원보다 커야 합니다.';
  end if;

  select * into v_account
  from public.prepaid_accounts
  where id = p_account_id
  for update;
  if not found then raise exception '선결제 회사를 찾을 수 없습니다.'; end if;

  v_used := v_account.initial_amount - v_account.balance;
  if p_initial_amount < v_used then
    raise exception '이미 사용한 금액보다 작게 변경할 수 없습니다.';
  end if;

  update public.prepaid_accounts
  set initial_amount = p_initial_amount,
      balance = p_initial_amount - v_used,
      memo = nullif(btrim(p_memo), '')
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;

revoke all on function public.can_manage_prepayments() from public, anon;
grant execute on function public.can_manage_prepayments() to authenticated;
revoke all on function public.register_prepaid_usage(uuid,bigint,text) from public, anon;
grant execute on function public.register_prepaid_usage(uuid,bigint,text) to authenticated;
revoke all on function public.update_prepaid_account(uuid,bigint,text) from public, anon;
grant execute on function public.update_prepaid_account(uuid,bigint,text) to authenticated;

alter table public.prepaid_accounts enable row level security;
alter table public.prepaid_usages enable row level security;

drop policy if exists prepaid_accounts_managers_all on public.prepaid_accounts;
create policy prepaid_accounts_managers_all on public.prepaid_accounts
  for all using (public.can_manage_prepayments())
  with check (
    public.can_manage_prepayments()
    and created_by = public.current_employee_id()
  );

drop policy if exists prepaid_usages_managers_select on public.prepaid_usages;
create policy prepaid_usages_managers_select on public.prepaid_usages
  for select using (public.can_manage_prepayments());
