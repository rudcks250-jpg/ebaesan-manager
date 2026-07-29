import type { Employee, LeaveRequest } from '@/data/types';

export const MONTHLY_LEAVE_ELIGIBLE_NAMES = new Set(['김경재', '김하은']);

export function isMonthlyLeaveEligible(employee: Employee | undefined): boolean {
  return !!employee && (
    employee.monthlyLeaveEligible === true ||
    MONTHLY_LEAVE_ELIGIBLE_NAMES.has(employee.name)
  );
}

export function leaveMonth(date: string): string {
  return date.slice(0, 7);
}

export function activeMonthlyRequest(
  requests: LeaveRequest[],
  yearMonth: string
): LeaveRequest | undefined {
  return requests.find(
    (request) =>
      request.leaveType === 'monthly' &&
      leaveMonth(request.requestedDate) === yearMonth &&
      request.status !== 'rejected'
  );
}

export function monthsOfYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}
