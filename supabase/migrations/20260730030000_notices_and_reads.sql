-- 공지사항 작성/수정/삭제와 직원별 읽음 상태
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

alter table public.notices
  add column if not exists is_important boolean not null default false,
  add column if not exists created_by_name text,
  add column if not exists updated_at timestamptz not null default now();

update public.notices n
set created_by_name = coalesce(n.created_by_name, e.name, '알 수 없음')
from public.employees e
where n.created_by = e.id and n.created_by_name is null;

alter table public.notices alter column created_by_name set not null;

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

drop trigger if exists trg_notices_updated_at on public.notices;
create trigger trg_notices_updated_at
  before update on public.notices
  for each row execute function public.set_updated_at();

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

revoke all on function public.can_manage_notices() from public, anon;
grant execute on function public.can_manage_notices() to authenticated;
revoke all on function public.get_notice_read_status(uuid) from public, anon;
grant execute on function public.get_notice_read_status(uuid) to authenticated;

alter table public.notices enable row level security;
alter table public.notice_reads enable row level security;

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
