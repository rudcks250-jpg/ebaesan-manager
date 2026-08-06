create unique index if not exists uq_leave_requests_employee_active_date
  on public.leave_requests(employee_id, requested_date)
  where status <> 'rejected';
