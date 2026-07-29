-- 직원이 본인의 근로시간 기록을 삭제할 수 있도록 허용합니다.
drop policy if exists attendance_self_delete on public.attendance;
create policy attendance_self_delete on public.attendance
  for delete using (employee_id = public.current_employee_id());
