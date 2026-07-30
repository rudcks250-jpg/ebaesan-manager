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
