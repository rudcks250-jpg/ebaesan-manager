import { employeeService } from '@/services/employeeService';
import { scheduleService } from '@/services/scheduleService';
import { leaveService } from '@/services/leaveService';
import { workTimeService } from '@/services/workTimeService';
import { calcWorkedMinutes } from '@/utils/time';
import {
  todayStr,
  getMondayOfWeekStr,
  getWeekDates,
  addDays,
  formatDate,
} from '@/utils/date';
import type { Employee, LeaveRequest, ShiftEntry } from '@/data/types';

export interface TodayWorkingEmployee {
  employee: Employee;
  startTime: string | null;
  endTime: string | null;
}

export interface AdminDashboardData {
  todayLabel: string;
  workingTodayCount: number;
  offTodayCount: number;
  currentlyWorkingCount: number;
  weeklyScheduledMinutes: number;
  monthlyActualMinutes: number;
  pendingLeaveCount: number;
  missingWorkTimeCount: number;
  pendingFirstLoginCount: number;
  todayWorkingByTime: TodayWorkingEmployee[];
  todayLeavingByTime: TodayWorkingEmployee[];
  todayOffEmployees: Employee[];
  todayMissingWorkTimeEmployees: Employee[];
}

export interface StaffDashboardData {
  todayShift: ShiftEntry | undefined;
  nextWorkDate: string | undefined;
  weekShifts: ShiftEntry[];
  weekDates: string[];
  latestLeaveRequest: LeaveRequest | undefined;
  monthlyActualMinutes: number;
  isClockedInToday: boolean;
  isClockedOutToday: boolean;
}

export const dashboardService = {
  async getAdminDashboard(): Promise<AdminDashboardData> {
    const today = todayStr();
    const employees = await employeeService.listActive();
    const weekStart = getMondayOfWeekStr(today);
    const week = await scheduleService.getWeek(weekStart);

    const todayShifts = week.shifts.filter((s) => s.date === today);
    const workingToday = todayShifts.filter((s) => s.status === 'working');
    const offToday = todayShifts.filter(
      (s) => s.status === 'off' || s.status === 'leaveApproved'
    );

    const allWorkTime = await workTimeService.listAll();
    const allWorkTimeToday = allWorkTime.filter((r) => r.date === today);
    const currentlyWorking = allWorkTimeToday.filter((r) => r.clockIn && !r.clockOut);

    const weeklyScheduledMinutes = week.shifts
      .filter((s) => s.status === 'working' && s.startTime && s.endTime)
      .reduce((sum, s) => sum + calcWorkedMinutes(s.startTime!, s.endTime!, 0), 0);

    const [year, month] = today.split('-').map(Number);
    const monthlyRecords = allWorkTime.filter((r) => r.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
    const monthlyActualMinutes = workTimeService.sumMinutes(monthlyRecords);

    const pendingLeaveCount = await leaveService.pendingCount();

    // 최근 7일 중 근무 예정이었으나 실제 기록이 없는 건수
    // (하루씩 반복 조회하지 않고, 7일 범위 스케줄을 한 번에 조회해 비교합니다)
    const sevenDaysAgo = formatDate(addDays(new Date(today), -7));
    const yesterday = formatDate(addDays(new Date(today), -1));
    const recentShifts = await scheduleService.getShiftsInRange(sevenDaysAgo, yesterday);
    let missingWorkTimeCount = 0;
    for (const s of recentShifts) {
      if (s.status !== 'working') continue;
      const record = allWorkTime.find((r) => r.employeeId === s.employeeId && r.date === s.date);
      if (!record || !record.clockIn || !record.clockOut) missingWorkTimeCount++;
    }

    const byEmployee = (shifts: typeof todayShifts): TodayWorkingEmployee[] =>
      shifts
        .map((s) => {
          const employee = employees.find((e) => e.id === s.employeeId);
          if (!employee) return null;
          return { employee, startTime: s.startTime, endTime: s.endTime };
        })
        .filter((x): x is TodayWorkingEmployee => x !== null);

    const todayWorkingByTime = byEmployee(workingToday).sort((a, b) =>
      (a.startTime ?? '').localeCompare(b.startTime ?? '')
    );
    const todayLeavingByTime = byEmployee(workingToday).sort((a, b) =>
      (a.endTime ?? '').localeCompare(b.endTime ?? '')
    );

    const todayOffEmployees = offToday
      .map((s) => employees.find((e) => e.id === s.employeeId))
      .filter((e): e is Employee => !!e);

    const todayMissingWorkTimeEmployees = workingToday
      .map((s) => employees.find((e) => e.id === s.employeeId))
      .filter((e): e is Employee => !!e)
      .filter((e) => {
        const record = allWorkTimeToday.find((r) => r.employeeId === e.id);
        return !record || !record.clockIn || !record.clockOut;
      });

    return {
      todayLabel: today,
      workingTodayCount: workingToday.length,
      offTodayCount: offToday.length,
      currentlyWorkingCount: currentlyWorking.length,
      weeklyScheduledMinutes,
      monthlyActualMinutes,
      pendingLeaveCount,
      missingWorkTimeCount,
      pendingFirstLoginCount: await employeeService.countPendingFirstLogin(),
      todayWorkingByTime,
      todayLeavingByTime,
      todayOffEmployees,
      todayMissingWorkTimeEmployees,
    };
  },

  async getStaffDashboard(employeeId: string): Promise<StaffDashboardData> {
    const today = todayStr();
    const weekStart = getMondayOfWeekStr(today);
    const weekDates = getWeekDates(weekStart);
    const week = await scheduleService.getWeek(weekStart);
    const weekShifts = week.shifts.filter((s) => s.employeeId === employeeId);
    const todayShift = weekShifts.find((s) => s.date === today);

    let nextWorkDate: string | undefined;
    for (const d of weekDates) {
      if (d <= today) continue;
      const shift = weekShifts.find((s) => s.date === d);
      if (shift && shift.status === 'working') {
        nextWorkDate = d;
        break;
      }
    }
    // 이번주에 없으면 다음주 확인
    if (!nextWorkDate) {
      const nextWeekStart = formatDate(addDays(new Date(weekStart), 7));
      const nextWeek = await scheduleService.getWeek(nextWeekStart);
      const sorted = nextWeek.shifts
        .filter((s) => s.employeeId === employeeId && s.status === 'working')
        .sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length > 0) nextWorkDate = sorted[0].date;
    }

    const leaveRequests = await leaveService.listByEmployee(employeeId);
    const latestLeaveRequest = leaveRequests[0];

    const [year, month] = today.split('-').map(Number);
    const monthlyRecords = await workTimeService.listByEmployeeAndMonth(employeeId, year, month);
    const monthlyActualMinutes = workTimeService.sumMinutes(monthlyRecords);

    const todayRecord = await workTimeService.get(employeeId, today);
    const isClockedInToday = !!todayRecord?.clockIn;
    const isClockedOutToday = !!todayRecord?.clockOut;

    return {
      todayShift,
      nextWorkDate,
      weekShifts,
      weekDates,
      latestLeaveRequest,
      monthlyActualMinutes,
      isClockedInToday,
      isClockedOutToday,
    };
  },
};
