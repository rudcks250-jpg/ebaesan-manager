import { leaveRepository } from '@/repositories/leaveRepository';
import { scheduleService } from '@/services/scheduleService';
import { notificationService } from '@/services/notificationService';
import { employeeService } from '@/services/employeeService';
import { activeMonthlyRequest, isMonthlyLeaveEligible, leaveMonth } from '@/features/leave/monthlyLeave';
import { isNextWeek, nowIso } from '@/utils/date';
import type { LeaveRequest, LeaveType } from '@/data/types';

export interface CreateLeaveInput {
  employeeId: string;
  requestedDate: string;
  reason: string;
  leaveType: LeaveType;
}

export interface CreateLeavesInput {
  employeeId: string;
  requestedDates: string[];
  reason: string;
  leaveType: LeaveType;
}

export type CreateLeaveResult =
  | { success: true; request: LeaveRequest }
  | { success: false; errorMessage: string };

export type CreateLeavesResult =
  | { success: true; requests: LeaveRequest[] }
  | { success: false; errorMessage: string };

export const leaveService = {
  async listAll(): Promise<LeaveRequest[]> {
    return leaveRepository.findAll();
  },

  async listByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    return leaveRepository.findByEmployee(employeeId);
  },

  async listPending(): Promise<LeaveRequest[]> {
    const all = await leaveRepository.findAll();
    return all.filter((r) => r.status === 'pending');
  },

  async pendingCount(): Promise<number> {
    return (await this.listPending()).length;
  },

  async create(input: CreateLeaveInput): Promise<CreateLeaveResult> {
    const result = await this.createMany({
      employeeId: input.employeeId,
      requestedDates: [input.requestedDate],
      reason: input.reason,
      leaveType: input.leaveType,
    });
    return result.success
      ? { success: true, request: result.requests[0] }
      : result;
  },

  async createMany(input: CreateLeavesInput): Promise<CreateLeavesResult> {
    const requestedDates = [...new Set(input.requestedDates)].sort();
    if (requestedDates.length === 0) {
      return { success: false, errorMessage: '신청할 날짜를 선택해주세요.' };
    }
    if (requestedDates.some((date) => !isNextWeek(date))) {
      return { success: false, errorMessage: '휴무 신청은 다음 주 날짜에 대해서만 가능합니다.' };
    }
    if (!input.reason.trim()) {
      return { success: false, errorMessage: '휴무 사유를 입력해주세요.' };
    }
    if (input.leaveType === 'monthly') {
      if (requestedDates.length !== 1) {
        return { success: false, errorMessage: '월차는 한 번에 한 날짜만 신청할 수 있습니다.' };
      }
      const employee = await employeeService.get(input.employeeId);
      if (!isMonthlyLeaveEligible(employee)) {
        return { success: false, errorMessage: '월차 신청 권한이 없습니다.' };
      }
    }
    const existing = await leaveRepository.findByEmployee(input.employeeId);
    const activeDates = new Set(
      existing.filter((request) => request.status !== 'rejected').map((request) => request.requestedDate)
    );
    const newDates = requestedDates.filter((date) => !activeDates.has(date));
    if (newDates.length === 0) {
      return { success: false, errorMessage: '선택한 날짜는 이미 휴무 신청이 있습니다.' };
    }
    if (input.leaveType === 'monthly' && activeMonthlyRequest(existing, leaveMonth(requestedDates[0]))) {
      return { success: false, errorMessage: '해당 월의 월차를 이미 신청하거나 사용했습니다.' };
    }
    let requests: LeaveRequest[];
    const requestGroupId = crypto.randomUUID();
    try {
      requests = await leaveRepository.insertMany(newDates.map((requestedDate) => ({
        employeeId: input.employeeId,
        requestGroupId,
        requestedDate,
        reason: input.reason.trim(),
        leaveType: input.leaveType,
        status: 'pending' as const,
      })));
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      const message = (error as { message?: string })?.message ?? '';
      console.error('휴무 신청 저장 실패', {
        employeeId: input.employeeId,
        requestedDates: newDates,
        code: (error as { code?: string })?.code,
        message: (error as { message?: string })?.message,
        details: (error as { details?: string })?.details,
        hint: (error as { hint?: string })?.hint,
        payload: newDates.map((requestedDate) => ({
          employee_id: input.employeeId,
          request_group_id: requestGroupId,
          requested_date: requestedDate,
          reason: input.reason.trim(),
          ...(input.leaveType === 'monthly' ? { leave_type: input.leaveType } : {}),
          status: 'pending',
        })),
      });
      const missingMonthlySchema =
        (code === 'PGRST204' || code === '42703') &&
        (message.includes('leave_type') || message.includes('monthly_leave_eligible'));
      if (missingMonthlySchema) {
        return { success: false, errorMessage: '월차 DB 설정이 적용되지 않았습니다. 관리자에게 문의해주세요.' };
      }
      if (message.includes('월차 신청 권한')) {
        return { success: false, errorMessage: '월차 신청 권한이 없습니다.' };
      }
      if (message.includes('이미 신청') || message.includes('이미 사용')) {
        return { success: false, errorMessage: '해당 월의 월차를 이미 신청하거나 사용했습니다.' };
      }
      if (message.includes('duplicate') || message.includes('unique')) {
        return { success: false, errorMessage: '이미 휴무 신청된 날짜가 포함되어 있습니다.' };
      }
      return { success: false, errorMessage: '휴무 신청 저장에 실패했습니다. 다시 시도해주세요.' };
    }
    await notificationService.dispatch().catch(() => undefined);
    return { success: true, requests };
  },

  async approve(id: string, adminId: string): Promise<LeaveRequest | undefined> {
    const request = await leaveRepository.findById(id);
    if (!request) return undefined;
    await scheduleService.setApprovedLeave(
      request.requestedDate,
      request.employeeId,
      adminId,
      request.leaveType
    );
    const updated = await leaveRepository.update(id, {
      status: 'approved',
      processedAt: nowIso(),
      processedBy: adminId,
      rejectReason: undefined,
    });
    await notificationService.dispatch().catch(() => undefined);
    return updated;
  },

  async reject(id: string, adminId: string, rejectReason: string): Promise<LeaveRequest | undefined> {
    const updated = await leaveRepository.update(id, {
      status: 'rejected',
      rejectReason,
      processedAt: nowIso(),
      processedBy: adminId,
    });
    await notificationService.dispatch().catch(() => undefined);
    return updated;
  },

  async hasExistingWorkShift(date: string, employeeId: string): Promise<boolean> {
    return scheduleService.hasExistingWorkShift(date, employeeId);
  },
};
