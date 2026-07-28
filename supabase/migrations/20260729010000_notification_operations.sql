alter table public.push_subscriptions
  add column if not exists device_id text,
  add column if not exists environment text not null default 'production';

update public.push_subscriptions
set device_id = 'legacy-' || id::text
where device_id is null;

alter table public.push_subscriptions
  alter column device_id set not null;

create unique index if not exists uq_push_subscription_device_environment
  on public.push_subscriptions(auth_user_id, device_id, channel, environment);

alter table public.notification_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 5,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists created_by uuid references public.employees(id);

alter table public.notification_deliveries
  add column if not exists attempt_count integer not null default 1,
  add column if not exists last_attempt_at timestamptz not null default now(),
  add column if not exists read_at timestamptz;

create table if not exists public.notification_error_logs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.notification_jobs(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  stage text not null,
  error_message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_jobs_retry
  on public.notification_jobs(status, next_attempt_at, scheduled_for);
create index if not exists idx_notification_deliveries_read
  on public.notification_deliveries(read_at, sent_at);
create index if not exists idx_notification_error_logs_created
  on public.notification_error_logs(created_at desc);

alter table public.notification_error_logs enable row level security;

create policy notification_jobs_admin_select on public.notification_jobs
  for select using (public.is_admin());
create policy notification_deliveries_admin_select on public.notification_deliveries
  for select using (public.is_admin());
create policy notification_error_logs_admin_select on public.notification_error_logs
  for select using (public.is_admin());

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
    where e.role = 'staff' and e.status = 'active';
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

create or replace function public.admin_resend_notification(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.notification_jobs;
  v_new_id uuid;
begin
  if not public.is_admin() then raise exception '관리자만 알림을 재발송할 수 있습니다.'; end if;
  select * into v_source from public.notification_jobs where id = p_job_id;
  if not found then raise exception '알림 이력을 찾을 수 없습니다.'; end if;

  insert into public.notification_jobs (
    event_key, kind, recipient_employee_id, recipient_role, title, body, link,
    payload, scheduled_for, next_attempt_at, created_by
  ) values (
    'resend:' || p_job_id::text || ':' || gen_random_uuid()::text,
    v_source.kind, v_source.recipient_employee_id, v_source.recipient_role,
    v_source.title, v_source.body, v_source.link,
    v_source.payload || jsonb_build_object('resend_of', p_job_id),
    now(), now(), public.current_employee_id()
  ) returning id into v_new_id;
  return v_new_id;
end;
$$;

create or replace function public.mark_notification_read(p_job_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notification_deliveries d
  set read_at = coalesce(d.read_at, now())
  from public.push_subscriptions s
  where d.job_id = p_job_id
    and d.subscription_id = s.id
    and s.auth_user_id = auth.uid();
$$;

revoke all on function public.admin_enqueue_notification(text,text,text,uuid,boolean,timestamptz,text) from public, anon;
grant execute on function public.admin_enqueue_notification(text,text,text,uuid,boolean,timestamptz,text) to authenticated;
revoke all on function public.admin_resend_notification(uuid) from public, anon;
grant execute on function public.admin_resend_notification(uuid) to authenticated;
revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

revoke all on public.notification_error_logs from anon, authenticated;
grant select on public.notification_error_logs to authenticated;
grant select on public.notification_jobs to authenticated;
grant select on public.notification_deliveries to authenticated;
