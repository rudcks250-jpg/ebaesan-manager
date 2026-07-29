import type { Employee, ShiftEntry, WorkTimeRecord, LeaveRequest, PayrollSettlement } from '@/data/types';

// snake_case DB row -> camelCase app type. DB 스키마는 supabase/schema.sql 참고.

export function rowToEmployee(row: any): Employee {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    // 역할 마이그레이션 적용 전의 운영 DB(`staff`)도 배포 순서와 무관하게
    // 직원 권한으로 안전하게 동작하도록 정규화합니다.
    role: row.role === 'staff' ? 'employee' : row.role,
    position: row.position,
    wageType: row.wage_type,
    hourlyWage: row.hourly_wage ?? undefined,
    monthlySalary: row.monthly_salary ?? undefined,
    payday: row.payday ?? undefined,
    status: row.status,
    hireDate: row.hire_date ?? '',
    resignDate: row.resign_date ?? undefined,
    isFirstLogin: row.is_first_login,
    monthlyLeaveEligible: row.monthly_leave_eligible ?? false,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function employeeToRow(patch: Partial<Employee>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.position !== undefined) row.position = patch.position;
  if (patch.wageType !== undefined) row.wage_type = patch.wageType;
  if (patch.hourlyWage !== undefined) row.hourly_wage = patch.hourlyWage;
  if (patch.monthlySalary !== undefined) row.monthly_salary = patch.monthlySalary;
  if (patch.payday !== undefined) row.payday = patch.payday;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.hireDate !== undefined) row.hire_date = patch.hireDate;
  if (patch.resignDate !== undefined) row.resign_date = patch.resignDate;
  if (patch.isFirstLogin !== undefined) row.is_first_login = patch.isFirstLogin;
  if (patch.monthlyLeaveEligible !== undefined) row.monthly_leave_eligible = patch.monthlyLeaveEligible;
  if (patch.lastLoginAt !== undefined) row.last_login_at = patch.lastLoginAt;
  return row;
}

export function rowToShift(row: any): ShiftEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    source: row.source,
    memo: row.memo ?? undefined,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? '',
  };
}

export function rowToWorkTime(row: any): WorkTimeRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: row.date,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    breakMinutes: row.break_minutes,
    workedMinutes: row.worked_minutes,
    memo: row.memo ?? undefined,
    isAutoClockIn: row.is_auto_clock_in,
    editHistory: [], // 상세 편집이력은 DB에 별도 저장하지 않음 (updated_at으로 대체)
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToLeave(row: any): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    requestedDate: row.requested_date,
    reason: row.reason ?? '',
    leaveType: row.leave_type === 'monthly' ? 'monthly' : 'regular',
    status: row.status,
    rejectReason: row.reject_reason ?? undefined,
    createdAt: row.created_at,
    processedAt: row.processed_at ?? undefined,
    processedBy: row.processed_by ?? undefined,
  };
}

export function rowToPayrollSettlement(row: any): PayrollSettlement {
  return {
    employeeId: row.employee_id,
    yearMonth: row.year_month,
    settled: row.settled,
    settledAt: row.settled_at ?? undefined,
  };
}
