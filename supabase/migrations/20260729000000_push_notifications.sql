create extension if not exists "pgcrypto";

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 100),
  content text not null check (length(btrim(content)) between 1 and 2000),
  created_by uuid not null references public.employees(id),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_id text not null,
  environment text not null default 'production' check (environment in ('development', 'production')),
  channel text not null check (channel in ('fcm', 'web_push')),
  subscription_key text not null,
  token text,
  endpoint text,
  p256dh text,
  auth_key text,
  platform text,
  user_agent text,
  active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, subscription_key),
  unique (auth_user_id, device_id, channel, environment)
);

create table if not exists public.notification_preferences (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  schedule_enabled boolean not null default true,
  notice_enabled boolean not null default true,
  worktime_enabled boolean not null default true,
  leave_reminder_enabled boolean not null default true,
  leave_result_enabled boolean not null default true,
  payroll_enabled boolean not null default true,
  order_enabled boolean not null default true,
  leave_request_admin_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  kind text not null,
  recipient_employee_id uuid references public.employees(id) on delete cascade,
  recipient_role text check (recipient_role in ('admin', 'staff')),
  title text not null,
  body text not null,
  link text not null default '/',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  scheduled_for timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz not null default now(),
  unique (job_id, subscription_id)
);

create index if not exists idx_push_subscriptions_employee on public.push_subscriptions(employee_id) where active;
create index if not exists idx_notification_jobs_pending on public.notification_jobs(status, scheduled_for);
create index if not exists idx_notification_deliveries_job on public.notification_deliveries(job_id);

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at before update on public.notification_preferences
  for each row execute function public.set_updated_at();

create or replace function public.enqueue_notification(
  p_event_key text,
  p_kind text,
  p_title text,
  p_body text,
  p_link text,
  p_employee_id uuid default null,
  p_role text default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notification_jobs (
    event_key, kind, recipient_employee_id, recipient_role, title, body, link, payload
  ) values (
    p_event_key, p_kind, p_employee_id, p_role, p_title, p_body, p_link, p_payload
  )
  on conflict (event_key) do update set event_key = excluded.event_key
  returning id into v_id;
  return v_id;
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
    'schedule',
    e.id,
    '📅 이번 주 스케줄이 등록되었습니다.',
    '앱에서 확인해주세요.',
    '/schedule',
    jsonb_build_object('week_start', p_week_start)
  from public.employees e
  where e.role = 'staff' and e.status = 'active'
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
    'notice',
    e.id,
    '📢 새로운 공지사항이 등록되었습니다.',
    v_notice.title,
    '/dashboard#notices',
    jsonb_build_object('notice_id', v_notice.id)
  from public.employees e
  where e.role = 'staff' and e.status = 'active'
  on conflict (event_key) do nothing;

  return v_notice;
end;
$$;

create or replace function public.enqueue_test_notification()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid := public.current_employee_id();
begin
  if v_employee_id is null then raise exception '로그인이 필요합니다.'; end if;
  return public.enqueue_notification(
    'test:' || auth.uid()::text || ':' || floor(extract(epoch from now()) / 30)::bigint::text,
    'test',
    '🔔 테스트 알림',
    '이배산 앱의 푸시 알림이 정상적으로 연결되었습니다.',
    '/settings',
    v_employee_id
  );
end;
$$;

create or replace function public.on_leave_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.employees where id = new.employee_id;

  if tg_op = 'INSERT' then
    insert into public.notification_jobs (
      event_key, kind, recipient_employee_id, title, body, link, payload
    )
    select
      'leave_created:' || new.id::text || ':' || admin.id::text,
      'leave_request_admin',
      admin.id,
      '🙋 ' || v_name || '님이 휴무를 신청했습니다.',
      to_char(new.requested_date, 'YYYY.MM.DD') || ' 휴무 신청을 확인해주세요.',
      '/leave',
      jsonb_build_object('leave_request_id', new.id)
    from public.employees admin
    where admin.role = 'admin' and admin.status = 'active'
    on conflict (event_key) do nothing;
  elsif old.status is distinct from new.status and new.status in ('approved', 'rejected') then
    perform public.enqueue_notification(
      'leave_result:' || new.id::text || ':' || new.status,
      'leave_result',
      case when new.status = 'approved' then '✅ 휴무가 승인되었습니다.' else '❌ 휴무 신청이 반려되었습니다.' end,
      case when new.status = 'approved'
        then to_char(new.requested_date, 'YYYY.MM.DD') || ' 휴무가 승인되었습니다.'
        else coalesce('반려 사유: ' || nullif(new.reject_reason, ''), '앱에서 반려 사유를 확인해주세요.')
      end,
      '/leave',
      new.employee_id,
      null,
      jsonb_build_object('leave_request_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_leave_notification on public.leave_requests;
create trigger trg_leave_notification
after insert or update of status on public.leave_requests
for each row execute function public.on_leave_notification();

alter table public.notices enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_deliveries enable row level security;

create policy notices_authenticated_select on public.notices
  for select using (public.current_employee_id() is not null);
create policy notices_admin_all on public.notices
  for all using (public.is_admin()) with check (public.is_admin());

create policy push_subscriptions_self_select on public.push_subscriptions
  for select using (auth_user_id = auth.uid());
create policy push_subscriptions_self_insert on public.push_subscriptions
  for insert with check (
    auth_user_id = auth.uid() and employee_id = public.current_employee_id()
  );
create policy push_subscriptions_self_update on public.push_subscriptions
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and employee_id = public.current_employee_id());
create policy push_subscriptions_self_delete on public.push_subscriptions
  for delete using (auth_user_id = auth.uid());

create policy notification_preferences_self_all on public.notification_preferences
  for all using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid() and employee_id = public.current_employee_id());

revoke all on public.notification_jobs from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
revoke all on function public.enqueue_notification(text,text,text,text,text,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_notification(text,text,text,text,text,uuid,text,jsonb) to service_role;
revoke all on function public.publish_schedule_notifications(date) from public, anon;
grant execute on function public.publish_schedule_notifications(date) to authenticated;
revoke all on function public.create_notice_with_notification(text,text) from public, anon;
grant execute on function public.create_notice_with_notification(text,text) to authenticated;
revoke all on function public.enqueue_test_notification() from public, anon;
grant execute on function public.enqueue_test_notification() to authenticated;
