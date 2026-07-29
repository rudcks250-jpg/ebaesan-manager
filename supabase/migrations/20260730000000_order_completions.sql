-- 대표와 매니저가 같은 최근 발주자·완료 시간을 공유하기 위한 이력
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

alter table public.order_completions enable row level security;

drop policy if exists order_completions_authenticated_select on public.order_completions;
create policy order_completions_authenticated_select on public.order_completions
  for select using (public.current_employee_id() is not null);

drop policy if exists order_completions_self_insert on public.order_completions;
create policy order_completions_self_insert on public.order_completions
  for insert with check (completed_by = public.current_employee_id());
