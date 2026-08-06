alter table public.leave_requests
  add column if not exists request_group_id uuid;

create index if not exists idx_leave_requests_group
  on public.leave_requests(request_group_id)
  where request_group_id is not null;

create unique index if not exists uq_leave_requests_employee_active_date
  on public.leave_requests(employee_id, requested_date)
  where status <> 'rejected';
