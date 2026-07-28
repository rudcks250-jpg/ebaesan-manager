// =========================================================
// 급여 계산 서비스 (Supabase 연동판)
// -----------------------------------------------------------
// 실제 급여 금액은 저장하지 않고, 근로시간 기록으로 그때그때 계산합니다.
// "정산 완료" 여부만 payrolls 테이블에 저장합니다.
// =========================================================

import { employeeService } from '@/services/employeeService';
import { workTimeService } from '@/services/workTimeService';
import { scheduleRepository } from '@/repositories/scheduleRepository';
import { payrollRepository } from '@/repositories/payrollRepository';
import type { Employee, WorkTimeRecord } from '@/data/types';

const WITHHOLDING_RATE = 0.033; // 3.3% 원천징수

export type PaydayStatus = 'today' | 'upcoming' | 'passed' | 'unknown';

export interface PaydayInfo {
  status: PaydayStatus;
  days: number;
}

export interface PayrollPeriod {
  payDate: string; // 실제 지급일 YYYY-MM-DD
  start: string; // 급여 계산 시작일 YYYY-MM-DD
  end: string; // 급여 계산 종료일 YYYY-MM-DD
}

export interface EmployeePayroll {
  employee: Employee;
  period: PayrollPeriod;
  totalMinutes: number;
  totalDays: number;
  gross: number;
  deduction: number;
  net: number;
  settled: boolean;
}

export interface MonthlyPayrollSummary {
  yearMonth: string;
  totalLaborCost: number;
  settledCount: number;
  unsettledCount: number;
  rows: EmployeePayroll[];
}

export interface PayrollCalendarDay {
  date: string; // YYYY-MM-DD
  isToday: boolean;
  isScheduledOff: boolean;
  record: WorkTimeRecord | undefined;
}

export const payrollService = {
  isWithholdingApplicable(employee: Pick<Employee, 'position'>): boolean {
    return employee.position === '파트타임';
  },

  calcGrossPay(hourlyWage: number, totalMinutes: number): number {
    return Math.round((totalMinutes / 60) * hourlyWage);
  },

  calcNetPay(grossPay: number, employee: Pick<Employee, 'position'>): number {
    return grossPay - this.calcEmployeeDeduction(employee, grossPay);
  },

  calcDeduction(gross: number): number {
    return Math.round(gross * WITHHOLDING_RATE);
  },

  calcEmployeeDeduction(employee: Pick<Employee, 'position'>, gross: number): number {
    return this.isWithholdingApplicable(employee) ? this.calcDeduction(gross) : 0;
  },

  daysUntilPayday(payday?: string, today: Date = new Date()): PaydayInfo {
    if (!payday) return { status: 'unknown', days: 0 };
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    let paydayDay: number | null = null;
    if (payday.includes('말일')) {
      paydayDay = lastDayOfMonth;
    } else {
      const match = payday.match(/(\d+)/);
      if (match) paydayDay = Math.min(Number(match[1]), lastDayOfMonth);
    }
    if (paydayDay === null) return { status: 'unknown', days: 0 };
    const diff = paydayDay - today.getDate();
    if (diff === 0) return { status: 'today', days: 0 };
    if (diff > 0) return { status: 'upcoming', days: diff };
    return { status: 'passed', days: Math.abs(diff) };
  },

  // 급여일 문자열에서 '일(day)' 숫자를 뽑아냅니다. '매월 말일'은 해당 월의 마지막 날.
  resolvePaydayDay(payday: string | undefined, year: number, month: number): number {
    const lastDay = new Date(year, month, 0).getDate();
    if (!payday) return 1;
    if (payday.includes('말일')) return lastDay;
    const match = payday.match(/(\d+)/);
    if (!match) return 1;
    return Math.min(Number(match[1]), lastDay);
  },

  // 직원별 급여 계산 기간 (지급월 M, 급여일 D -> (M-1)월 D일 ~ (M월 D일의 전날))
  getPayrollPeriod(payday: string | undefined, year: number, month: number): PayrollPeriod {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const payDay = this.resolvePaydayDay(payday, year, month);
    const payDate = new Date(year, month - 1, payDay);
    const end = new Date(payDate);
    end.setDate(end.getDate() - 1);
    const prev = new Date(year, month - 2, 1);
    const prevYear = prev.getFullYear();
    const prevMonth = prev.getMonth() + 1;
    const startDay = this.resolvePaydayDay(payday, prevYear, prevMonth);
    const start = new Date(prevYear, prevMonth - 1, startDay);
    return { payDate: fmt(payDate), start: fmt(start), end: fmt(end) };
  },

  // 지정된 지급월의 전 직원 급여 요약 (직원마다 자신의 급여일 기준 기간으로 계산)
  async getMonthlyPayroll(year: number, month: number): Promise<MonthlyPayrollSummary> {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const allEmployees = await employeeService.listActive();
    const employees = allEmployees.filter((e) => e.role === 'staff');

    const rows: EmployeePayroll[] = await Promise.all(
      employees.map(async (employee) => {
        const period = this.getPayrollPeriod(employee.payday, year, month);
        const allRecords = await workTimeService.listByEmployee(employee.id);
        const records = allRecords.filter((r) => r.date >= period.start && r.date <= period.end);
        const totalMinutes = workTimeService.sumMinutes(records);
        const totalDays = records.filter((r) => r.workedMinutes !== null).length;

        const gross =
          employee.wageType === 'hourly'
            ? this.calcGrossPay(employee.hourlyWage ?? 0, totalMinutes)
            : (employee.monthlySalary ?? 0);
        const deduction = this.calcEmployeeDeduction(employee, gross);
        const net = gross - deduction;

        const settlement = await payrollRepository.findByEmployeeAndMonth(employee.id, yearMonth);
        return { employee, period, totalMinutes, totalDays, gross, deduction, net, settled: !!settlement?.settled };
      })
    );

    const totalLaborCost = rows.reduce((sum, r) => sum + r.gross, 0);
    const settledCount = rows.filter((r) => r.settled).length;
    const unsettledCount = rows.length - settledCount;

    return { yearMonth, totalLaborCost, settledCount, unsettledCount, rows };
  },

  // ---- 직원 화면용: 현재 진행 중인 급여기간 ----
  getCurrentPayrollPeriod(payday: string | undefined, today: Date = new Date()): PayrollPeriod {
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    const thisMonthPayDay = this.resolvePaydayDay(payday, y, m);
    const payoutBase = today.getDate() >= thisMonthPayDay ? new Date(y, m, 1) : new Date(y, m - 1, 1);
    return this.getPayrollPeriod(payday, payoutBase.getFullYear(), payoutBase.getMonth() + 1);
  },

  // 직원 본인의 현재 급여 현황 (근무시간이 바뀌면 호출부에서 다시 호출하면 즉시 반영)
  async getCurrentPayroll(employeeId: string, today: Date = new Date()) {
    const employee = await employeeService.get(employeeId);
    if (!employee) return undefined;

    const period = this.getCurrentPayrollPeriod(employee.payday, today);
    const allRecords = await workTimeService.listByEmployee(employeeId);
    const records = allRecords.filter((r) => r.date >= period.start && r.date <= period.end);
    const totalMinutes = workTimeService.sumMinutes(records);
    const totalDays = records.filter((r) => r.workedMinutes !== null).length;

    const gross =
      employee.wageType === 'hourly'
        ? this.calcGrossPay(employee.hourlyWage ?? 0, totalMinutes)
        : (employee.monthlySalary ?? 0);
    const deduction = this.calcEmployeeDeduction(employee, gross);
    const net = gross - deduction;

    const payDate = new Date(period.payDate + 'T00:00:00');
    const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const daysUntilPay = Math.round((payDate.getTime() - base.getTime()) / 86400000);

    return { employee, period, totalMinutes, totalDays, gross, deduction, net, daysUntilPay };
  },

  async getEmployeePayroll(employeeId: string, year: number, month: number): Promise<EmployeePayroll | undefined> {
    const summary = await this.getMonthlyPayroll(year, month);
    return summary.rows.find((r) => r.employee.id === employeeId);
  },

  // 직원 1명의 월간 근무 캘린더 (근무일/휴무일/오늘 색상 구분용)
  async getEmployeeCalendar(employeeId: string, year: number, month: number): Promise<PayrollCalendarDay[]> {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const records = await workTimeService.listByEmployeeAndMonth(employeeId, year, month);
    const shifts = await scheduleRepository.findByDateRange(monthStart, monthEnd);
    const todayStr = new Date().toISOString().slice(0, 10);

    const days: PayrollCalendarDay[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const shift = shifts.find((s) => s.employeeId === employeeId && s.date === date);
      const isScheduledOff = shift?.status === 'off' || shift?.status === 'leaveApproved';
      const record = records.find((r) => r.date === date);
      days.push({ date, isToday: date === todayStr, isScheduledOff, record });
    }
    return days;
  },

  async isSettled(employeeId: string, yearMonth: string): Promise<boolean> {
    const s = await payrollRepository.findByEmployeeAndMonth(employeeId, yearMonth);
    return !!s?.settled;
  },

  async markSettled(employeeId: string, yearMonth: string): Promise<void> {
    await payrollRepository.upsert(employeeId, yearMonth, true);
  },

  async unmarkSettled(employeeId: string, yearMonth: string): Promise<void> {
    await payrollRepository.upsert(employeeId, yearMonth, false);
  },
};
