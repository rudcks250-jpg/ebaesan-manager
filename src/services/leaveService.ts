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

export type CreateLeaveResult =
  | { success: true; request: LeaveRequest }
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
    if (!isNextWeek(input.requestedDate)) {
      return { success: false, errorMessage: '휴무 신청은 다음 주 날짜에 대해서만 가능합니다.' };
    }
    if (!input.reason.trim()) {
      return { success: false, errorMessage: '휴무 사유를 입력해주세요.' };
    }
    if (input.leaveType === 'monthly') {
      const employee = await employeeService.get(input.employeeId);
      if (!isMonthlyLeaveEligible(employee)) {
        return { success: false, errorMessage: '월차 신청 권한이 없습니다.' };
      }
    }
    const existing = await leaveRepository.findByEmployee(input.employeeId);
    const duplicate = existing.find((r) => r.requestedDate === input.requestedDate && r.status !== 'rejected');
    if (duplicate) {
      return { success: false, errorMessage: '이미 해당 날짜에 신청한 휴무가 있습니다.' };
    }
    if (input.leaveType === 'monthly' && activeMonthlyRequest(existing, leaveMonth(input.requestedDate))) {
      return { success: false, errorMessage: '해당 월의 월차를 이미 신청하거나 사용했습니다.' };
    }
    let request: LeaveRequest;
    try {
      request = await leaveRepository.insert({
        employeeId: input.employeeId,
        requestedDate: input.requestedDate,
        reason: input.reason.trim(),
        leaveType: input.leaveType,
        status: 'pending',
      });
    } catch (error) {
      const message = (error as { message?: string })?.message ?? '';
      if (message.includes('monthly') || message.includes('월차')) {
        return { success: false, errorMessage: '해당 월의 월차를 이미 신청하거나 사용했습니다.' };
      }
      return { success: false, errorMessage: '휴무 신청을 저장하지 못했습니다.' };
    }
    await notificationService.dispatch().catch(() => undefined);
    return { success: true, request };
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
