-- 금전 원장 안전성 강화: 잔액 조정, 소프트 삭제, 원문 보존, 감사로그
alter table public.prepaid_customers
  add column if not exists legacy_note text,
  add column if not exists needs_review boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.employees(id) on delete restrict;

alter table public.prepaid_transactions
  add column if not exists effect_amount bigint,
  add column if not exists needs_review boolean not null default false,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.employees(id) on delete restrict;

update public.prepaid_transactions
set effect_amount = case when transaction_type = 'deposit' then amount else -amount end
where effect_amount is null;

alter table public.prepaid_transactions alter column effect_amount set not null;
alter table public.prepaid_transactions drop constraint if exists prepaid_transactions_transaction_type_check;
alter table public.prepaid_transactions
  add constraint prepaid_transactions_transaction_type_check
  check (transaction_type in ('deposit', 'usage', 'adjustment'));

create table if not exists public.prepaid_audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('customer', 'transaction')),
  entity_id uuid not null,
  action text not null check (action in ('create', 'update', 'delete')),
  changed_by uuid references public.employees(id) on delete restrict,
  changed_by_name text not null,
  before_data jsonb,
  after_data jsonb,
  changed_at timestamptz not null default now()
);

create index if not exists idx_prepaid_audit_entity
  on public.prepaid_audit_logs(entity_type, entity_id, changed_at desc);

create or replace function public.log_prepaid_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
  v_action text;
begin
  select * into v_employee from public.employees where id = public.current_employee_id();
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif new.deleted_at is not null and old.deleted_at is null then
    v_action := 'delete';
  else
    v_action := 'update';
  end if;

  insert into public.prepaid_audit_logs(
    entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data
  ) values (
    case when tg_table_name = 'prepaid_customers' then 'customer' else 'transaction' end,
    coalesce(new.id, old.id),
    v_action,
    v_employee.id,
    coalesce(v_employee.name, '시스템'),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prepaid_customers_audit on public.prepaid_customers;
create trigger trg_prepaid_customers_audit
  after insert or update on public.prepaid_customers
  for each row execute function public.log_prepaid_audit();

drop trigger if exists trg_prepaid_transactions_audit on public.prepaid_transactions;
create trigger trg_prepaid_transactions_audit
  after insert or update on public.prepaid_transactions
  for each row execute function public.log_prepaid_audit();

create or replace function public.assert_prepaid_ledger_valid(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min_balance bigint;
begin
  select min(running_balance) into v_min_balance
  from (
    select sum(effect_amount) over (
      order by transaction_date, created_at, id
      rows between unbounded preceding and current row
    ) as running_balance
    from public.prepaid_transactions
    where customer_id = p_customer_id and deleted_at is null
  ) ledger;
  if coalesce(v_min_balance, 0) < 0 then raise exception '잔액이 부족합니다.'; end if;
end;
$$;

drop function if exists public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid);
create function public.save_prepaid_transaction(
  p_customer_id uuid,
  p_transaction_type text,
  p_amount bigint,
  p_transaction_date date,
  p_memo text default null,
  p_transaction_id uuid default null,
  p_adjustment_direction text default null
)
returns public.prepaid_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee public.employees;
  v_effect bigint;
  v_transaction public.prepaid_transactions;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if p_transaction_type not in ('deposit', 'usage', 'adjustment') then raise exception '거래 종류가 올바르지 않습니다.'; end if;
  if p_amount <= 0 then raise exception '금액은 0원보다 커야 합니다.'; end if;
  if p_transaction_date is null then raise exception '거래일을 입력해주세요.'; end if;
  if p_transaction_type = 'adjustment' and p_adjustment_direction not in ('increase', 'decrease') then
    raise exception '잔액 조정 방향을 선택해주세요.';
  end if;

  v_effect := case
    when p_transaction_type = 'deposit' then p_amount
    when p_transaction_type = 'usage' then -p_amount
    when p_adjustment_direction = 'increase' then p_amount
    else -p_amount
  end;

  perform 1 from public.prepaid_customers
  where id = p_customer_id and deleted_at is null for update;
  if not found then raise exception '고객을 찾을 수 없습니다.'; end if;
  select * into v_employee from public.employees where id = public.current_employee_id();

  if p_transaction_id is null then
    insert into public.prepaid_transactions(
      customer_id, transaction_type, amount, effect_amount, transaction_date,
      memo, created_by, created_by_name
    ) values (
      p_customer_id, p_transaction_type, p_amount, v_effect, p_transaction_date,
      nullif(btrim(p_memo), ''), v_employee.id, v_employee.name
    ) returning * into v_transaction;
  else
    update public.prepaid_transactions
    set transaction_type = p_transaction_type,
        amount = p_amount,
        effect_amount = v_effect,
        transaction_date = p_transaction_date,
        memo = nullif(btrim(p_memo), '')
    where id = p_transaction_id and customer_id = p_customer_id and deleted_at is null
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
  v_employee_id uuid;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  select customer_id into v_customer_id
  from public.prepaid_transactions
  where id = p_transaction_id and deleted_at is null
  for update;
  if not found then raise exception '거래내역을 찾을 수 없습니다.'; end if;

  perform 1 from public.prepaid_customers where id = v_customer_id for update;
  v_employee_id := public.current_employee_id();
  update public.prepaid_transactions
  set deleted_at = now(), deleted_by = v_employee_id
  where id = p_transaction_id;
  perform public.assert_prepaid_ledger_valid(v_customer_id);
end;
$$;

revoke all on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid,text) from public, anon;
grant execute on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid,text) to authenticated;

alter table public.prepaid_audit_logs enable row level security;

drop policy if exists prepaid_customers_managers_select on public.prepaid_customers;
create policy prepaid_customers_managers_select on public.prepaid_customers
  for select using (public.can_manage_prepayments() and deleted_at is null);

drop policy if exists prepaid_transactions_managers_select on public.prepaid_transactions;
create policy prepaid_transactions_managers_select on public.prepaid_transactions
  for select using (public.can_manage_prepayments() and deleted_at is null);

drop policy if exists prepaid_audit_logs_managers_select on public.prepaid_audit_logs;
create policy prepaid_audit_logs_managers_select on public.prepaid_audit_logs
  for select using (public.can_manage_prepayments());
