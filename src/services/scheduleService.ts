import { scheduleRepository, weekEndDate } from '@/repositories/scheduleRepository';
import { FIXED_WEEKLY_SCHEDULES } from '@/data/fixedWeeklySchedules';
import type { Employee, ScheduleWeek, ShiftEntry, ShiftStatus } from '@/data/types';
import { addDays, formatDate, getWeekDates, parseDate } from '@/utils/date';

export interface ShiftInput {
  startTime: string | null;
  endTime: string | null;
  status: ShiftStatus;
  memo?: string;
}

export const scheduleService = {
  async ensureFixedWeeklySchedules(
    weekStartDate: string,
    employees: Employee[],
    adminId: string
  ): Promise<void> {
    const weekDates = getWeekDates(weekStartDate);
    const existingShifts = await scheduleRepository.findByDateRange(weekDates[0], weekDates[6]);
    const existingKeys = new Set(
      existingShifts.map((shift) => `${shift.employeeId}:${shift.date}`)
    );
    const employeeByName = new Map(employees.map((employee) => [employee.name, employee]));

    for (const fixedSchedule of FIXED_WEEKLY_SCHEDULES) {
      const employee = employeeByName.get(fixedSchedule.employeeName);
      if (!employee) continue;

      for (const fixedShift of fixedSchedule.shifts) {
        const date = weekDates.find(
          (candidate) => parseDate(candidate).getDay() === fixedShift.weekday
        );
        if (!date || existingKeys.has(`${employee.id}:${date}`)) continue;

        await scheduleRepository.insertShiftIfMissing(
          employee.id,
          date,
          { startTime: fixedShift.startTime, endTime: fixedShift.endTime },
          adminId
        );
        existingKeys.add(`${employee.id}:${date}`);
      }
    }
  },

  async getWeek(weekStartDate: string): Promise<ScheduleWeek> {
    const shifts = await scheduleRepository.findByDateRange(weekStartDate, weekEndDate(weekStartDate));
    return { id: `week_${weekStartDate}`, weekStartDate, shifts };
  },

  async getShift(_weekStartDate: string, employeeId: string, date: string): Promise<ShiftEntry | undefined> {
    return scheduleRepository.findOne(employeeId, date);
  },

  async setShift(date: string, employeeId: string, input: ShiftInput, adminId: string): Promise<ShiftEntry> {
    return scheduleRepository.upsertShift(
      employeeId,
      date,
      { status: input.status, startTime: input.startTime, endTime: input.endTime, source: 'manual', memo: input.memo },
      adminId
    );
  },

  // 휴무신청 승인 시 자동 반영 (leaveService에서 호출)
  async setApprovedLeave(date: string, employeeId: string, adminId: string): Promise<ShiftEntry> {
    return scheduleRepository.upsertShift(
      employeeId,
      date,
      { status: 'leaveApproved', startTime: null, endTime: null, source: 'leaveApproved' },
      adminId
    );
  },

  async clearShift(date: string, employeeId: string): Promise<void> {
    return scheduleRepository.removeShift(employeeId, date);
  },

  async clearWeek(weekStartDate: string): Promise<void> {
    await scheduleRepository.removeByDateRange(weekStartDate, weekEndDate(weekStartDate));
  },

  async copyPreviousWeek(weekStartDate: string, adminId: string): Promise<boolean> {
    const previousWeekStart = formatDate(addDays(parseDate(weekStartDate), -7));
    const previousShifts = await scheduleRepository.findByDateRange(
      previousWeekStart,
      weekEndDate(previousWeekStart),
    );
    if (previousShifts.length === 0) return false;

    await this.clearWeek(weekStartDate);
    for (const shift of previousShifts) {
      const copiedDate = formatDate(addDays(parseDate(shift.date), 7));
      const copiedStatus = shift.status === 'leaveApproved' ? 'off' : shift.status;
      await scheduleRepository.upsertShift(
        shift.employeeId,
        copiedDate,
        {
          status: copiedStatus,
          startTime: copiedStatus === 'working' ? shift.startTime : null,
          endTime: copiedStatus === 'working' ? shift.endTime : null,
          source: 'manual',
          memo: shift.memo,
        },
        adminId,
      );
    }
    return true;
  },

  // 동일 시간대를 여러 직원 x 여러 날짜에 한 번에 적용
  async bulkApply(dates: string[], employeeIds: string[], input: ShiftInput, adminId: string): Promise<void> {
    const selectedDates = [...new Set(dates)];
    const selectedEmployeeIds = [...new Set(employeeIds)];
    for (const employeeId of selectedEmployeeIds) {
      for (const date of selectedDates) {
        await this.setShift(date, employeeId, input, adminId);
      }
    }
  },

  async getShiftsInRange(startDate: string, endDate: string): Promise<ShiftEntry[]> {
    return scheduleRepository.findByDateRange(startDate, endDate);
  },

  // 이미 근무가 입력되어 있는지 확인 (휴무 승인 시 확인용)
  async hasExistingWorkShift(date: string, employeeId: string): Promise<boolean> {
    const shift = await scheduleRepository.findOne(employeeId, date);
    return !!shift && shift.status === 'working';
  },
};
