-- 박경찬, 김경재, 김하은 전용 오픈 준비 체크리스트
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

drop trigger if exists trg_opening_preparations_updated_at on public.opening_preparations;
create trigger trg_opening_preparations_updated_at
  before update on public.opening_preparations
  for each row execute function public.set_updated_at();

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

revoke all on function public.can_manage_opening_preparations() from public, anon;
grant execute on function public.can_manage_opening_preparations() to authenticated;

alter table public.opening_preparations enable row level security;

drop policy if exists opening_preparations_allowed_all on public.opening_preparations;
create policy opening_preparations_allowed_all on public.opening_preparations
  for all
  using (public.can_manage_opening_preparations())
  with check (
    public.can_manage_opening_preparations()
    and updated_by = public.current_employee_id()
  );
