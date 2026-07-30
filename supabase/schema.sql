-- =========================================================
-- 이배산 업무관리 시스템 - Supabase 스키마 + RLS
-- Supabase 대시보드 > SQL Editor 에 그대로 붙여넣어 실행하세요.
-- (전체를 한 번에 실행 가능합니다. 순서대로 실행되어야 합니다.)
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- 1. employees (직원)
-- ---------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  -- Supabase Auth는 이메일 기반이라, "이름"으로 로그인하는 기존 UX를 유지하기 위해
  -- 가입 시 자동 생성되는 내부용 로그인 이메일입니다. 사용자에게는 노출되지 않습니다.
  login_email text unique not null,
  name text not null,
  phone text not null,
  role text not null default 'employee' check (role in ('admin', 'manager', 'employee')),
  position text not null default '',
  wage_type text not null default 'hourly' check (wage_type in ('hourly', 'monthly')),
  hourly_wage numeric,
  monthly_salary numeric,
  payday text,
  status text not null default 'active' check (status in ('active', 'inactive', 'resigned')),
  hire_date date,
  resign_date date,
  is_first_login boolean not null default true,
  monthly_leave_eligible boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_role on public.employees(role);
create index if not exists idx_employees_status on public.employees(status);
-- 로그인 아이디인 이름은 공백/대소문자 차이까지 정규화해 하나만 허용합니다.
-- 기존 데이터에 중복 이름이 있으면 먼저 정리한 뒤 이 스키마를 적용해야 합니다.
create unique index if not exists uq_employees_login_name
  on public.employees (lower(btrim(name)));

-- ---------------------------------------------------------
-- 2. schedules (주간 근무표)
-- ---------------------------------------------------------
create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  status text not null default 'unscheduled' check (status in ('working', 'off', 'leaveApproved', 'unscheduled')),
  start_time time,
  end_time time,
  source text not null default 'manual' check (source in ('manual', 'leaveApproved')),
  memo text,
  updated_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, date)
);

create index if not exists idx_schedules_date on public.schedules(date);
create index if not exists idx_schedules_employee on public.schedules(employee_id);

-- ---------------------------------------------------------
-- 3. attendance (실제 근로시간 기록)
-- ---------------------------------------------------------
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  clock_in time,
  clock_out time,
  break_minutes integer not null default 0,
  worked_minutes integer,
  memo text,
  is_auto_clock_in boolean not null default false,
  edited_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, date)
);

create index if not exists idx_attendance_date on public.attendance(date);
create index if not exists idx_attendance_employee on public.attendance(employee_id);

-- ---------------------------------------------------------
-- 4. leave_requests (휴무 신청)
-- ---------------------------------------------------------
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  requested_date date not null,
  reason text,
  leave_type text not null default 'regular' check (leave_type in ('regular', 'monthly')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reject_reason text,
  processed_at timestamptz,
  processed_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_employee on public.leave_requests(employee_id);
create index if not exists idx_leave_status on public.leave_requests(status);

-- ---------------------------------------------------------
-- 5. payrolls (급여 정산 상태 - 실제 급여액은 근무기록으로 그때그때 계산하고,
--    "정산 완료" 여부만 이 테이블에 저장합니다)
-- ---------------------------------------------------------
create table if not exists public.payrolls (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  year_month text not null, -- 'YYYY-MM'
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (employee_id, year_month)
);

create index if not exists idx_payrolls_employee on public.payrolls(employee_id);

-- 발주 완료 이력 (대표/매니저 공용)
create table if not exists public.order_completions (
  id uuid primary key default gen_random_uuid(),
  vendor_id text not null,
  vendor_name text not null,
  completed_by uuid not null references public.employees(id) on delete restrict,
  completed_by_name text not null,
  completed_at timestamptz not null default now()
);

create index if not exists idx_order_completions_vendor_latest
  on public.order_completions(vendor_id, completed_at desc);

-- 다음날 오픈 준비 체크리스트
create table if not exists public.opening_preparations (
  id uuid primary key default gen_random_uuid(),
  target_date date not null unique,
  items jsonb not null default '[]'::jsonb,
  confirmed_at timestamptz,
  confirmed_by uuid references public.employees(id) on delete set null,
  confirmed_by_name text,
  updated_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_opening_preparations_target_date
  on public.opening_preparations(target_date desc);

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  is_important boolean not null default false,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notice_reads (
  notice_id uuid not null references public.notices(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, employee_id)
);

create index if not exists idx_notices_priority_latest
  on public.notices(is_important desc, created_at desc);
create index if not exists idx_notice_reads_employee
  on public.notice_reads(employee_id, read_at desc);

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

-- 고객별 선결제 입금/사용 거래 원장
create table if not exists public.prepaid_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company_name text,
  contact_person text,
  phone text not null,
  memo text,
  legacy_note text,
  needs_review boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.employees(id) on delete restrict,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prepaid_transactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.prepaid_customers(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('deposit', 'usage', 'adjustment')),
  amount bigint not null check (amount > 0),
  effect_amount bigint not null,
  transaction_date date not null default current_date,
  memo text,
  needs_review boolean not null default false,
  deleted_at timestamptz,
  deleted_by uuid references public.employees(id) on delete restrict,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prepaid_customers_name on public.prepaid_customers(name);
create index if not exists idx_prepaid_transactions_customer_date
  on public.prepaid_transactions(customer_id, transaction_date desc, created_at desc);

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

-- ---------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists trg_schedules_updated_at on public.schedules;
create trigger trg_schedules_updated_at before update on public.schedules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_attendance_updated_at on public.attendance;
create trigger trg_attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

drop trigger if exists trg_opening_preparations_updated_at on public.opening_preparations;
create trigger trg_opening_preparations_updated_at before update on public.opening_preparations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notices_updated_at on public.notices;
create trigger trg_notices_updated_at before update on public.notices
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prepaid_accounts_updated_at on public.prepaid_accounts;
create trigger trg_prepaid_accounts_updated_at before update on public.prepaid_accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prepaid_customers_updated_at on public.prepaid_customers;
create trigger trg_prepaid_customers_updated_at before update on public.prepaid_customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_prepaid_transactions_updated_at on public.prepaid_transactions;
create trigger trg_prepaid_transactions_updated_at before update on public.prepaid_transactions
  for each row execute function public.set_updated_at();

create or replace function public.log_prepaid_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_employee public.employees; v_action text;
begin
  select * into v_employee from public.employees where id = public.current_employee_id();
  if tg_op = 'INSERT' then v_action := 'create';
  elsif new.deleted_at is not null and old.deleted_at is null then v_action := 'delete';
  else v_action := 'update';
  end if;
  insert into public.prepaid_audit_logs
    (entity_type, entity_id, action, changed_by, changed_by_name, before_data, after_data)
  values (
    case when tg_table_name = 'prepaid_customers' then 'customer' else 'transaction' end,
    coalesce(new.id, old.id), v_action, v_employee.id, coalesce(v_employee.name, '시스템'),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prepaid_customers_audit on public.prepaid_customers;
create trigger trg_prepaid_customers_audit after insert or update on public.prepaid_customers
  for each row execute function public.log_prepaid_audit();

drop trigger if exists trg_prepaid_transactions_audit on public.prepaid_transactions;
create trigger trg_prepaid_transactions_audit after insert or update on public.prepaid_transactions
  for each row execute function public.log_prepaid_audit();

-- ---------------------------------------------------------
-- 권한 판별 헬퍼 함수 (RLS 정책에서 재사용)
-- ---------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.employees e
    where e.auth_user_id = auth.uid() and e.role = 'admin'
  );
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
security definer
stable
as $$
  select e.id from public.employees e where e.auth_user_id = auth.uid();
$$;

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
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if p_amount <= 0 then raise exception '사용 금액은 0원보다 커야 합니다.'; end if;

  select * into v_account from public.prepaid_accounts where id = p_account_id for update;
  if not found then raise exception '선결제 회사를 찾을 수 없습니다.'; end if;
  if v_account.balance < p_amount then raise exception '잔액이 부족합니다.'; end if;

  select * into v_employee from public.employees where id = public.current_employee_id();
  update public.prepaid_accounts set balance = balance - p_amount where id = p_account_id;
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
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if p_initial_amount <= 0 then raise exception '선결제 금액은 0원보다 커야 합니다.'; end if;

  select * into v_account from public.prepaid_accounts where id = p_account_id for update;
  if not found then raise exception '선결제 회사를 찾을 수 없습니다.'; end if;
  v_used := v_account.initial_amount - v_account.balance;
  if p_initial_amount < v_used then raise exception '이미 사용한 금액보다 작게 변경할 수 없습니다.'; end if;

  update public.prepaid_accounts
  set initial_amount = p_initial_amount,
      balance = p_initial_amount - v_used,
      memo = nullif(btrim(p_memo), '')
  where id = p_account_id
  returning * into v_account;
  return v_account;
end;
$$;

create or replace function public.assert_prepaid_ledger_valid(p_customer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_min_balance bigint;
begin
  select min(running_balance) into v_min_balance
  from (
    select sum(effect_amount)
      over (order by transaction_date, created_at, id rows between unbounded preceding and current row)
      as running_balance
    from public.prepaid_transactions
    where customer_id = p_customer_id and deleted_at is null
  ) ledger;
  if coalesce(v_min_balance, 0) < 0 then raise exception '잔액이 부족합니다.'; end if;
end;
$$;

create or replace function public.save_prepaid_transaction(
  p_customer_id uuid, p_transaction_type text, p_amount bigint,
  p_transaction_date date, p_memo text default null, p_transaction_id uuid default null,
  p_adjustment_direction text default null
)
returns public.prepaid_transactions
language plpgsql security definer set search_path = public as $$
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
    when p_adjustment_direction = 'increase' then p_amount else -p_amount end;
  perform 1 from public.prepaid_customers
  where id = p_customer_id and deleted_at is null for update;
  if not found then raise exception '고객을 찾을 수 없습니다.'; end if;
  select * into v_employee from public.employees where id = public.current_employee_id();

  if p_transaction_id is null then
    insert into public.prepaid_transactions
      (customer_id, transaction_type, amount, effect_amount, transaction_date, memo, created_by, created_by_name)
    values
      (p_customer_id, p_transaction_type, p_amount, v_effect, p_transaction_date,
       nullif(btrim(p_memo), ''), v_employee.id, v_employee.name)
    returning * into v_transaction;
  else
    update public.prepaid_transactions
    set transaction_type = p_transaction_type, amount = p_amount, effect_amount = v_effect,
        transaction_date = p_transaction_date, memo = nullif(btrim(p_memo), '')
    where id = p_transaction_id and customer_id = p_customer_id and deleted_at is null
    returning * into v_transaction;
    if not found then raise exception '거래내역을 찾을 수 없습니다.'; end if;
  end if;
  perform public.assert_prepaid_ledger_valid(p_customer_id);
  return v_transaction;
end;
$$;

create or replace function public.delete_prepaid_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_customer_id uuid; v_employee_id uuid;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  select customer_id into v_customer_id
  from public.prepaid_transactions where id = p_transaction_id and deleted_at is null for update;
  if not found then raise exception '거래내역을 찾을 수 없습니다.'; end if;
  perform 1 from public.prepaid_customers where id = v_customer_id for update;
  v_employee_id := public.current_employee_id();
  update public.prepaid_transactions
  set deleted_at = now(), deleted_by = v_employee_id
  where id = p_transaction_id;
  perform public.assert_prepaid_ledger_valid(v_customer_id);
end;
$$;

create or replace function public.create_or_add_prepaid_deposit(
  p_name text, p_phone text, p_amount bigint, p_transaction_date date, p_memo text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_employee public.employees; v_customer public.prepaid_customers;
begin
  if not public.can_manage_prepayments() then raise exception '선결제 관리 권한이 없습니다.'; end if;
  if nullif(btrim(p_name), '') is null then raise exception '고객 이름을 입력해주세요.'; end if;
  if p_amount <= 0 then raise exception '선결제 금액은 0원보다 커야 합니다.'; end if;
  if p_transaction_date is null then raise exception '선결제 날짜를 입력해주세요.'; end if;

  select * into v_customer from public.prepaid_customers c
  where c.deleted_at is null and (
    (nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
     and regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
    or lower(btrim(c.name)) = lower(btrim(p_name))
  )
  order by case when regexp_replace(c.phone, '\D', '', 'g') =
    regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') then 0 else 1 end, c.created_at
  limit 1 for update;

  select * into v_employee from public.employees where id = public.current_employee_id();
  if v_customer.id is null then
    insert into public.prepaid_customers(name, phone, created_by, created_by_name)
    values (btrim(p_name), regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), v_employee.id, v_employee.name)
    returning * into v_customer;
  elsif nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '') is not null
    and nullif(v_customer.phone, '') is null then
    update public.prepaid_customers set phone = regexp_replace(p_phone, '\D', '', 'g')
    where id = v_customer.id;
  end if;

  perform public.save_prepaid_transaction(
    v_customer.id, 'deposit', p_amount, p_transaction_date, nullif(btrim(p_memo), ''), null, null
  );
  return v_customer.id;
end;
$$;

create or replace function public.can_manage_opening_preparations()
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

create or replace function public.can_manage_orders()
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
      and e.role in ('admin', 'manager')
  );
$$;

create or replace function public.can_manage_notices()
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

create or replace function public.get_notice_read_status(p_notice_id uuid)
returns table(employee_id uuid, employee_name text, read_at timestamptz)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.can_manage_notices() then
    raise exception '공지사항 관리 권한이 없습니다.';
  end if;

  return query
  select e.id, e.name, nr.read_at
  from public.employees e
  left join public.notice_reads nr
    on nr.employee_id = e.id and nr.notice_id = p_notice_id
  where e.status = 'active' and e.role <> 'admin'
  order by (nr.read_at is null), e.name;
end;
$$;

-- 비밀번호 변경을 마친 본인만 최초 로그인 플래그를 해제할 수 있습니다.
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

-- 직원 스케줄 화면에는 개인정보/급여를 제외한 재직 직원 식별정보만 제공합니다.
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

-- 관리자와 직원 스케줄 화면이 동일한 데이터 스냅샷을 사용하도록
-- 재직 직원 목록과 해당 주 전체 스케줄을 한 번에 반환합니다.
create or replace function public.get_schedule_week_board(
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if public.current_employee_id() is null then
    raise exception '인증된 직원만 스케줄을 조회할 수 있습니다.';
  end if;

  return jsonb_build_object(
    'employees',
    coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'name', e.name) order by e.name)
      from public.employees e
      where e.status = 'active'
    ), '[]'::jsonb),
    'shifts',
    coalesce((
      select jsonb_agg(to_jsonb(s) order by s.date, s.employee_id)
      from public.schedules s
      where s.date between p_start_date and p_end_date
    ), '[]'::jsonb)
  );
end;
$$;

-- 로그인 화면에서 "이름"만으로 로그인할 수 있도록, 이름 -> 내부 로그인 이메일을
-- 조회하는 함수입니다. 비밀번호 자체는 절대 다루지 않고 이메일만 반환하며,
-- 로그인 전(비인증 상태)에서도 호출할 수 있도록 anon 권한을 부여합니다.
create or replace function public.lookup_login_email(p_name text)
returns text
language sql
security definer
stable
as $$
  select login_email from public.employees
  where lower(btrim(name)) = lower(btrim(p_name)) and status <> 'resigned'
  limit 1;
$$;

grant execute on function public.lookup_login_email(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_employee_id() to anon, authenticated;
revoke all on function public.can_manage_opening_preparations() from public, anon;
grant execute on function public.can_manage_opening_preparations() to authenticated;
revoke all on function public.can_manage_orders() from public, anon;
grant execute on function public.can_manage_orders() to authenticated;
revoke all on function public.can_manage_notices() from public, anon;
grant execute on function public.can_manage_notices() to authenticated;
revoke all on function public.get_notice_read_status(uuid) from public, anon;
grant execute on function public.get_notice_read_status(uuid) to authenticated;
revoke all on function public.complete_first_login(uuid) from public, anon;
grant execute on function public.complete_first_login(uuid) to authenticated;
revoke all on function public.list_schedule_employees() from public, anon;
grant execute on function public.list_schedule_employees() to authenticated;
revoke all on function public.get_schedule_week_board(date, date) from public, anon;
grant execute on function public.get_schedule_week_board(date, date) to authenticated;
revoke all on function public.can_manage_prepayments() from public, anon;
grant execute on function public.can_manage_prepayments() to authenticated;
revoke all on function public.register_prepaid_usage(uuid,bigint,text) from public, anon;
grant execute on function public.register_prepaid_usage(uuid,bigint,text) to authenticated;
revoke all on function public.update_prepaid_account(uuid,bigint,text) from public, anon;
grant execute on function public.update_prepaid_account(uuid,bigint,text) to authenticated;
revoke all on function public.assert_prepaid_ledger_valid(uuid) from public, anon, authenticated;
revoke all on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid,text) from public, anon;
grant execute on function public.save_prepaid_transaction(uuid,text,bigint,date,text,uuid,text) to authenticated;
revoke all on function public.delete_prepaid_transaction(uuid) from public, anon;
grant execute on function public.delete_prepaid_transaction(uuid) to authenticated;
revoke all on function public.create_or_add_prepaid_deposit(text,text,bigint,date,text) from public, anon;
grant execute on function public.create_or_add_prepaid_deposit(text,text,bigint,date,text) to authenticated;

-- ---------------------------------------------------------
-- RLS 활성화
-- ---------------------------------------------------------
alter table public.employees enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payrolls enable row level security;
alter table public.order_completions enable row level security;
alter table public.opening_preparations enable row level security;
alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;
alter table public.prepaid_accounts enable row level security;
alter table public.prepaid_usages enable row level security;
alter table public.prepaid_customers enable row level security;
alter table public.prepaid_transactions enable row level security;
alter table public.prepaid_audit_logs enable row level security;

-- ---------------------------------------------------------
-- employees 정책: 관리자는 전체, 직원은 본인 행만 조회 가능
-- (직원 등록/수정/삭제는 관리자만 - 시급/급여일 등을 직원이 직접 바꾸지 못하도록)
-- ---------------------------------------------------------
drop policy if exists employees_admin_all on public.employees;
create policy employees_admin_all on public.employees
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists employees_self_select on public.employees;
create policy employees_self_select on public.employees
  for select using (auth_user_id = auth.uid());

-- 본인의 최초 로그인 완료 처리는 complete_first_login RPC로만 허용합니다.
drop policy if exists employees_self_update_first_login on public.employees;

-- ---------------------------------------------------------
-- schedules 정책: 관리자는 전체 관리, 직원은 전체 스케줄 조회만
-- ---------------------------------------------------------
drop policy if exists schedules_admin_all on public.schedules;
create policy schedules_admin_all on public.schedules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists schedules_self_select on public.schedules;
drop policy if exists schedules_staff_select_all on public.schedules;
create policy schedules_staff_select_all on public.schedules
  for select using (public.current_employee_id() is not null);

-- ---------------------------------------------------------
-- attendance 정책: 관리자는 전체, 직원은 본인 기록 조회/입력/수정 가능
-- ---------------------------------------------------------
drop policy if exists attendance_admin_all on public.attendance;
create policy attendance_admin_all on public.attendance
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists attendance_self_select on public.attendance;
create policy attendance_self_select on public.attendance
  for select using (employee_id = public.current_employee_id());

drop policy if exists attendance_self_insert on public.attendance;
create policy attendance_self_insert on public.attendance
  for insert with check (employee_id = public.current_employee_id());

drop policy if exists attendance_self_update on public.attendance;
create policy attendance_self_update on public.attendance
  for update using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

-- ---------------------------------------------------------
-- leave_requests 정책: 관리자는 전체(승인/반려 포함),
-- 직원은 본인 신청 조회 + 신규 신청만 가능 (승인/반려는 관리자만)
-- ---------------------------------------------------------
drop policy if exists leave_admin_all on public.leave_requests;
create policy leave_admin_all on public.leave_requests
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists leave_self_select on public.leave_requests;
create policy leave_self_select on public.leave_requests
  for select using (employee_id = public.current_employee_id());

drop policy if exists leave_self_insert on public.leave_requests;
create policy leave_self_insert on public.leave_requests
  for insert with check (employee_id = public.current_employee_id());

-- ---------------------------------------------------------
-- payrolls 정책: 관리자는 전체(정산 처리 포함), 직원은 본인 정산 상태 조회만
-- ---------------------------------------------------------
drop policy if exists payrolls_admin_all on public.payrolls;
create policy payrolls_admin_all on public.payrolls
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists payrolls_self_select on public.payrolls;
create policy payrolls_self_select on public.payrolls
  for select using (employee_id = public.current_employee_id());

drop policy if exists order_completions_authenticated_select on public.order_completions;
create policy order_completions_authenticated_select on public.order_completions
  for select using (public.current_employee_id() is not null);

drop policy if exists order_completions_self_insert on public.order_completions;
create policy order_completions_self_insert on public.order_completions
  for insert with check (completed_by = public.current_employee_id());

drop policy if exists order_completions_today_delete on public.order_completions;
create policy order_completions_today_delete on public.order_completions
  for delete
  using (
    public.can_manage_orders()
    and (completed_at at time zone 'Asia/Seoul')::date =
      (now() at time zone 'Asia/Seoul')::date
  );

drop policy if exists opening_preparations_allowed_all on public.opening_preparations;
create policy opening_preparations_allowed_all on public.opening_preparations
  for all
  using (public.can_manage_opening_preparations())
  with check (
    public.can_manage_opening_preparations()
    and updated_by = public.current_employee_id()
  );

drop policy if exists notices_authenticated_select on public.notices;
create policy notices_authenticated_select on public.notices
  for select using (public.current_employee_id() is not null);

drop policy if exists notices_managers_insert on public.notices;
create policy notices_managers_insert on public.notices
  for insert with check (
    public.can_manage_notices()
    and created_by = public.current_employee_id()
  );

drop policy if exists notices_managers_update on public.notices;
create policy notices_managers_update on public.notices
  for update using (public.can_manage_notices())
  with check (public.can_manage_notices());

drop policy if exists notices_managers_delete on public.notices;
create policy notices_managers_delete on public.notices
  for delete using (public.can_manage_notices());

drop policy if exists notice_reads_self_select on public.notice_reads;
create policy notice_reads_self_select on public.notice_reads
  for select using (employee_id = public.current_employee_id());

drop policy if exists notice_reads_self_insert on public.notice_reads;
create policy notice_reads_self_insert on public.notice_reads
  for insert with check (employee_id = public.current_employee_id());

drop policy if exists notice_reads_self_update on public.notice_reads;
create policy notice_reads_self_update on public.notice_reads
  for update using (employee_id = public.current_employee_id())
  with check (employee_id = public.current_employee_id());

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

drop policy if exists prepaid_customers_authenticated_select on public.prepaid_customers;
create policy prepaid_customers_authenticated_select on public.prepaid_customers
  for select using (public.current_employee_id() is not null and deleted_at is null);

drop policy if exists prepaid_customers_managers_insert on public.prepaid_customers;
create policy prepaid_customers_managers_insert on public.prepaid_customers
  for insert with check (
    public.can_manage_prepayments() and created_by = public.current_employee_id()
  );

drop policy if exists prepaid_customers_managers_update on public.prepaid_customers;
create policy prepaid_customers_managers_update on public.prepaid_customers
  for update using (public.can_manage_prepayments())
  with check (public.can_manage_prepayments());

drop policy if exists prepaid_customers_managers_delete on public.prepaid_customers;
create policy prepaid_customers_managers_delete on public.prepaid_customers
  for delete using (public.can_manage_prepayments());

drop policy if exists prepaid_transactions_authenticated_select on public.prepaid_transactions;
create policy prepaid_transactions_authenticated_select on public.prepaid_transactions
  for select using (public.current_employee_id() is not null and deleted_at is null);

drop policy if exists prepaid_audit_logs_managers_select on public.prepaid_audit_logs;
create policy prepaid_audit_logs_managers_select on public.prepaid_audit_logs
  for select using (public.can_manage_prepayments());

-- =========================================================
-- 초기 관리자 계정 생성 안내 (SQL만으로는 auth.users를 만들 수 없습니다)
-- =========================================================
-- 1) Supabase 대시보드 > Authentication > Users > "Add user"에서
--    이메일: admin@ebaesan.local  /  비밀번호: admin1234 (원하는 값으로 변경 가능)
--    로 관리자 계정을 먼저 만드세요.
-- 2) 그 다음 아래 SQL의 <ADMIN_AUTH_USER_ID> 부분을
--    방금 만든 유저의 UUID(Authentication > Users 목록에서 확인)로 바꿔서 실행하세요.
--
-- insert into public.employees
--   (auth_user_id, login_email, name, phone, role, position, wage_type, monthly_salary, payday, status, hire_date, is_first_login)
-- values
--   ('<ADMIN_AUTH_USER_ID>', 'admin@ebaesan.local', 'admin', '', 'admin', '점장', 'monthly', 3500000, '매월 25일', 'active', current_date, false);

-- =========================================================
-- 월 손익계산서 (대표 전용)
-- =========================================================
create table if not exists public.profit_loss_months (
  year_month text primary key check (year_month ~ '^\d{4}-\d{2}$'),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profit_loss_months_updated_at on public.profit_loss_months;
create trigger trg_profit_loss_months_updated_at before update on public.profit_loss_months
  for each row execute function public.set_updated_at();

create or replace function public.can_view_profit_loss()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.employees
    where auth_user_id = auth.uid()
      and status = 'active'
      and name = '박경찬'
  );
$$;

revoke all on function public.can_view_profit_loss() from public, anon;
grant execute on function public.can_view_profit_loss() to authenticated;

alter table public.profit_loss_months enable row level security;
drop policy if exists profit_loss_owner_all on public.profit_loss_months;
create policy profit_loss_owner_all on public.profit_loss_months
  for all using (public.can_view_profit_loss())
  with check (
    public.can_view_profit_loss()
    and updated_by = public.current_employee_id()
  );
