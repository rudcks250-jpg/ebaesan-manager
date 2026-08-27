-- 발주 거래처/품목 설정을 모든 기기에서 공유합니다.
create table if not exists public.order_vendors (
  id text primary key,
  data jsonb not null,
  updated_by uuid references public.employees(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(data) = 'object')
);

drop trigger if exists trg_order_vendors_updated_at on public.order_vendors;
create trigger trg_order_vendors_updated_at
before update on public.order_vendors
for each row execute function public.set_updated_at();

alter table public.order_vendors enable row level security;

drop policy if exists order_vendors_authenticated_select on public.order_vendors;
create policy order_vendors_authenticated_select on public.order_vendors
for select to authenticated
using (public.current_employee_id() is not null);

drop policy if exists order_vendors_operator_insert on public.order_vendors;
create policy order_vendors_operator_insert on public.order_vendors
for insert to authenticated
with check (
  exists (
    select 1 from public.employees e
    where e.id = public.current_employee_id()
      and e.role in ('admin', 'manager')
      and e.status = 'active'
  )
);

drop policy if exists order_vendors_operator_update on public.order_vendors;
create policy order_vendors_operator_update on public.order_vendors
for update to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = public.current_employee_id()
      and e.role in ('admin', 'manager')
      and e.status = 'active'
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = public.current_employee_id()
      and e.role in ('admin', 'manager')
      and e.status = 'active'
  )
);

drop policy if exists order_vendors_operator_delete on public.order_vendors;
create policy order_vendors_operator_delete on public.order_vendors
for delete to authenticated
using (
  exists (
    select 1 from public.employees e
    where e.id = public.current_employee_id()
      and e.role in ('admin', 'manager')
      and e.status = 'active'
  )
);

-- 최초 접속한 운영자 기기의 기존 localStorage 데이터를 한 번만 원자적으로 이전합니다.
create or replace function public.initialize_order_vendors(p_vendors jsonb)
returns setof public.order_vendors
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor jsonb;
  v_actor uuid := public.current_employee_id();
begin
  if not exists (
    select 1 from public.employees e
    where e.id = v_actor and e.role in ('admin', 'manager') and e.status = 'active'
  ) then
    raise exception '발주관리 권한이 없습니다.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_vendors) <> 'array' then
    raise exception '거래처 데이터 형식이 올바르지 않습니다.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.order_vendors) then
    for v_vendor in select value from jsonb_array_elements(p_vendors)
    loop
      if coalesce(v_vendor->>'id', '') <> '' then
        insert into public.order_vendors(id, data, updated_by)
        values (v_vendor->>'id', v_vendor, v_actor)
        on conflict (id) do nothing;
      end if;
    end loop;
  end if;

  return query select * from public.order_vendors order by created_at, id;
end;
$$;

revoke all on function public.initialize_order_vendors(jsonb) from public, anon;
grant execute on function public.initialize_order_vendors(jsonb) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_vendors'
  ) then
    alter publication supabase_realtime add table public.order_vendors;
  end if;
end;
$$;
