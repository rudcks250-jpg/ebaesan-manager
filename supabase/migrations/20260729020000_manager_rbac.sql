-- ADMIN / MANAGER / EMPLOYEE 역할 체계 도입
-- 매니저는 DB의 관리자 판정(public.is_admin)에 포함하지 않습니다.

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.employees'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.employees drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.employees alter column role drop default;
update public.employees set role = 'employee' where role = 'staff';
alter table public.employees alter column role set default 'employee';
alter table public.employees
  add constraint employees_role_check
  check (role in ('admin', 'manager', 'employee'));

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.employees
  where lower(btrim(name)) = lower(btrim('김경재'));

  if v_count <> 1 then
    raise exception '김경재 직원은 정확히 1명이어야 합니다. 현재: %명', v_count;
  end if;

  update public.employees
  set role = 'manager', updated_at = now()
  where lower(btrim(name)) = lower(btrim('김경재'));
end;
$$;

-- Push 알림 작업 테이블이 이미 설치된 운영 환경의 역할 제약조건도 확장합니다.
do $$
declare
  v_constraint record;
begin
  if to_regclass('public.notification_jobs') is null then
    return;
  end if;

  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.notification_jobs'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%recipient_role%'
  loop
    execute format('alter table public.notification_jobs drop constraint %I', v_constraint.conname);
  end loop;

  update public.notification_jobs
  set recipient_role = 'employee'
  where recipient_role = 'staff';

  alter table public.notification_jobs
    add constraint notification_jobs_recipient_role_check
    check (recipient_role in ('admin', 'manager', 'employee'));
end;
$$;

create or replace function public.publish_schedule_notifications(p_week_start date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then raise exception '관리자만 스케줄을 배포할 수 있습니다.'; end if;

  insert into public.notification_jobs (
    event_key, kind, recipient_employee_id, title, body, link, payload
  )
  select
    'schedule_published:' || p_week_start::text || ':' || e.id::text,
    'schedule', e.id, '📅 이번 주 스케줄이 등록되었습니다.', '앱에서 확인해주세요.',
    '/schedule', jsonb_build_object('week_start', p_week_start)
  from public.employees e
  where e.role in ('manager', 'employee') and e.status = 'active'
  on conflict (event_key) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.create_notice_with_notification(p_title text, p_content text)
returns public.notices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := public.current_employee_id();
  v_notice public.notices;
begin
  if not public.is_admin() then raise exception '관리자만 공지사항을 등록할 수 있습니다.'; end if;

  insert into public.notices(title, content, created_by)
  values (btrim(p_title), btrim(p_content), v_employee_id)
  returning * into v_notice;

  insert into public.notification_jobs (
    event_key, kind, recipient_employee_id, title, body, link, payload
  )
  select
    'notice:' || v_notice.id::text || ':' || e.id::text,
    'notice', e.id, '📢 새로운 공지사항이 등록되었습니다.', v_notice.title,
    '/dashboard#notices', jsonb_build_object('notice_id', v_notice.id)
  from public.employees e
  where e.role in ('manager', 'employee') and e.status = 'active'
  on conflict (event_key) do nothing;

  return v_notice;
end;
$$;

create or replace function public.admin_enqueue_notification(
  p_title text,
  p_body text,
  p_link text,
  p_employee_id uuid default null,
  p_all_staff boolean default false,
  p_scheduled_for timestamptz default now(),
  p_kind text default 'admin_message'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_count integer;
  v_creator uuid := public.current_employee_id();
begin
  if not public.is_admin() then raise exception '관리자만 알림을 발송할 수 있습니다.'; end if;
  if nullif(btrim(p_title), '') is null or nullif(btrim(p_body), '') is null then
    raise exception '알림 제목과 내용을 입력해주세요.';
  end if;
  if not p_all_staff and p_employee_id is null then
    raise exception '알림 대상을 선택해주세요.';
  end if;

  if p_all_staff then
    insert into public.notification_jobs (
      event_key, kind, recipient_employee_id, title, body, link,
      scheduled_for, next_attempt_at, created_by, payload
    )
    select
      'admin:' || v_batch::text || ':' || e.id::text,
      p_kind, e.id, btrim(p_title), btrim(p_body), coalesce(nullif(p_link, ''), '/dashboard'),
      p_scheduled_for, p_scheduled_for, v_creator, jsonb_build_object('batch_id', v_batch)
    from public.employees e
    where e.role in ('manager', 'employee') and e.status = 'active';
  else
    insert into public.notification_jobs (
      event_key, kind, recipient_employee_id, title, body, link,
      scheduled_for, next_attempt_at, created_by, payload
    ) values (
      'admin:' || v_batch::text || ':' || p_employee_id::text,
      p_kind, p_employee_id, btrim(p_title), btrim(p_body), coalesce(nullif(p_link, ''), '/dashboard'),
      p_scheduled_for, p_scheduled_for, v_creator, jsonb_build_object('batch_id', v_batch)
    );
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
