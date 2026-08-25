-- 선택한 한 주에만 존재하는 일회성 대타 스케줄.
-- employees/auth와 FK를 만들지 않아 직원·로그인·급여·할인·휴무 대상에 포함되지 않습니다.
create table if not exists public.schedule_substitutes (
  id uuid primary key default gen_random_uuid(),
  week_start_date date not null,
  name text not null check (length(btrim(name)) between 1 and 40),
  memo text,
  created_by uuid not null references public.employees(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_substitute_shifts (
  id uuid primary key default gen_random_uuid(),
  substitute_id uuid not null references public.schedule_substitutes(id) on delete cascade,
  date date not null,
  status text not null check (status in ('working', 'off')),
  start_time time,
  end_time time,
  memo text,
  updated_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (substitute_id, date),
  check (
    (status = 'working' and start_time is not null and end_time is not null)
    or (status = 'off' and start_time is null and end_time is null)
  )
);

create index if not exists idx_schedule_substitutes_week
  on public.schedule_substitutes(week_start_date, created_at);
create index if not exists idx_schedule_substitute_shifts_date
  on public.schedule_substitute_shifts(date, substitute_id);

drop trigger if exists trg_schedule_substitutes_updated_at on public.schedule_substitutes;
create trigger trg_schedule_substitutes_updated_at
before update on public.schedule_substitutes
for each row execute function public.set_updated_at();

drop trigger if exists trg_schedule_substitute_shifts_updated_at on public.schedule_substitute_shifts;
create trigger trg_schedule_substitute_shifts_updated_at
before update on public.schedule_substitute_shifts
for each row execute function public.set_updated_at();

alter table public.schedule_substitutes enable row level security;
alter table public.schedule_substitute_shifts enable row level security;

drop policy if exists schedule_substitutes_authenticated_select on public.schedule_substitutes;
create policy schedule_substitutes_authenticated_select on public.schedule_substitutes
for select to authenticated using (public.current_employee_id() is not null);

drop policy if exists schedule_substitutes_admin_all on public.schedule_substitutes;
create policy schedule_substitutes_admin_all on public.schedule_substitutes
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists schedule_substitute_shifts_authenticated_select on public.schedule_substitute_shifts;
create policy schedule_substitute_shifts_authenticated_select on public.schedule_substitute_shifts
for select to authenticated using (public.current_employee_id() is not null);

drop policy if exists schedule_substitute_shifts_admin_all on public.schedule_substitute_shifts;
create policy schedule_substitute_shifts_admin_all on public.schedule_substitute_shifts
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 여러 대타와 각 날짜 근무를 한 트랜잭션에서 저장하여 부분 저장을 방지합니다.
create or replace function public.create_schedule_substitutes(
  p_week_start date,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_entry jsonb;
  v_shift jsonb;
  v_substitute_id uuid;
  v_date date;
  v_status text;
  v_created integer := 0;
begin
  if not public.is_admin() then
    raise exception '관리자만 일회성 대타를 등록할 수 있습니다.' using errcode = '42501';
  end if;
  v_actor := public.current_employee_id();
  if p_week_start is null or jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception '대타 등록 정보를 확인해주세요.' using errcode = '22023';
  end if;

  for v_entry in select value from jsonb_array_elements(p_entries)
  loop
    if length(btrim(coalesce(v_entry->>'name', ''))) = 0 then
      raise exception '대타 이름을 입력해주세요.' using errcode = '22023';
    end if;
    if jsonb_typeof(v_entry->'shifts') <> 'array' or jsonb_array_length(v_entry->'shifts') = 0 then
      raise exception '%님의 근무일을 1개 이상 설정해주세요.', v_entry->>'name' using errcode = '22023';
    end if;

    insert into public.schedule_substitutes(week_start_date, name, memo, created_by)
    values (p_week_start, btrim(v_entry->>'name'), nullif(btrim(coalesce(v_entry->>'memo', '')), ''), v_actor)
    returning id into v_substitute_id;

    for v_shift in select value from jsonb_array_elements(v_entry->'shifts')
    loop
      v_date := (v_shift->>'date')::date;
      v_status := v_shift->>'status';
      if v_date < p_week_start or v_date > p_week_start + 6 then
        raise exception '대타 근무일은 선택한 주 안에서만 등록할 수 있습니다.' using errcode = '22023';
      end if;
      if v_status not in ('working', 'off') then
        raise exception '대타 근무 상태를 확인해주세요.' using errcode = '22023';
      end if;

      insert into public.schedule_substitute_shifts(
        substitute_id, date, status, start_time, end_time, updated_by
      ) values (
        v_substitute_id,
        v_date,
        v_status,
        case when v_status = 'working' then (v_shift->>'startTime')::time else null end,
        case when v_status = 'working' then (v_shift->>'endTime')::time else null end,
        v_actor
      );
    end loop;
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created);
end;
$$;

revoke all on function public.create_schedule_substitutes(date, jsonb) from public, anon;
grant execute on function public.create_schedule_substitutes(date, jsonb) to authenticated;
