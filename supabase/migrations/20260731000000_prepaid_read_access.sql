-- 선결제 조회는 모든 로그인 직원에게 허용하고, 변경 권한은 기존 지정 관리자만 유지합니다.
drop policy if exists prepaid_customers_managers_select on public.prepaid_customers;
drop policy if exists prepaid_customers_authenticated_select on public.prepaid_customers;
create policy prepaid_customers_authenticated_select on public.prepaid_customers
  for select using (
    public.current_employee_id() is not null
    and deleted_at is null
  );

drop policy if exists prepaid_transactions_managers_select on public.prepaid_transactions;
drop policy if exists prepaid_transactions_authenticated_select on public.prepaid_transactions;
create policy prepaid_transactions_authenticated_select on public.prepaid_transactions
  for select using (
    public.current_employee_id() is not null
    and deleted_at is null
  );

-- insert/update/delete 및 관련 RPC는 can_manage_prepayments()를 계속 사용하므로
-- 박경찬, 김경재, 김하은 외 사용자는 변경할 수 없습니다.
