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
  role text not null default 'staff' check (role in ('admin', 'staff')),
  position text not null default '',
  wage_type text not null default 'hourly' check (wage_type in ('hourly', 'monthly')),
  hourly_wage numeric,
  monthly_salary numeric,
  payday text,
  status text not null default 'active' check (status in ('active', 'inactive', 'resigned')),
  hire_date date,
  resign_date date,
  is_first_login boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_employees_role on public.employees(role);
create index if not exists idx_employees_status on public.employees(status);

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
  where name = p_name and status <> 'resigned'
  limit 1;
$$;

grant execute on function public.lookup_login_email(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_employee_id() to anon, authenticated;

-- ---------------------------------------------------------
-- RLS 활성화
-- ---------------------------------------------------------
alter table public.employees enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payrolls enable row level security;

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

-- 직원 본인이 첫 로그인 후 비밀번호 변경 시 is_first_login 플래그만 갱신할 수 있게 허용
drop policy if exists employees_self_update_first_login on public.employees;
create policy employees_self_update_first_login on public.employees
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ---------------------------------------------------------
-- schedules 정책: 관리자는 전체 관리, 직원은 본인 스케줄 조회만
-- ---------------------------------------------------------
drop policy if exists schedules_admin_all on public.schedules;
create policy schedules_admin_all on public.schedules
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists schedules_self_select on public.schedules;
create policy schedules_self_select on public.schedules
  for select using (employee_id = public.current_employee_id());

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
