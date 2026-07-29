-- 관리자와 매니저가 오늘 발주 완료만 취소할 수 있도록 제한합니다.
create or replace function public.can_manage_orders()
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
      and e.role in ('admin', 'manager')
  );
$$;

revoke all on function public.can_manage_orders() from public, anon;
grant execute on function public.can_manage_orders() to authenticated;

drop policy if exists order_completions_today_delete on public.order_completions;
create policy order_completions_today_delete on public.order_completions
  for delete
  using (
    public.can_manage_orders()
    and (completed_at at time zone 'Asia/Seoul')::date =
      (now() at time zone 'Asia/Seoul')::date
  );
