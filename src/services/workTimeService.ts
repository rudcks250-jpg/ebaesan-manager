import { workTimeRepository } from '@/repositories/workTimeRepository';
import { calcWorkedMinutes, nowHHmm, validateClockTimes } from '@/utils/time';
import { todayStr } from '@/utils/date';
import type { WorkTimeRecord } from '@/data/types';

export interface ManualEntryInput {
  employeeId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  memo?: string;
}

export type SaveResult =
  | { success: true; record: WorkTimeRecord }
  | { success: false; errorMessage: string };

export const workTimeService = {
  async listByEmployee(employeeId: string): Promise<WorkTimeRecord[]> {
    const records = await workTimeRepository.findByEmployee(employeeId);
    return records.sort((a, b) => (a.date < b.date ? 1 : -1));
  },

  async listByEmployeeAndMonth(employeeId: string, year: number, month: number): Promise<WorkTimeRecord[]> {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const all = await this.listByEmployee(employeeId);
    return all.filter((r) => r.date.startsWith(prefix));
  },

  async listAll(): Promise<WorkTimeRecord[]> {
    return workTimeRepository.findAll();
  },

  async get(employeeId: string, date: string): Promise<WorkTimeRecord | undefined> {
    return workTimeRepository.findByEmployeeAndDate(employeeId, date);
  },

  // 출근하기 버튼
  async clockIn(employeeId: string): Promise<WorkTimeRecord> {
    const date = todayStr();
    return workTimeRepository.upsert(employeeId, date, { clockIn: nowHHmm(), isAutoClockIn: true });
  },

  // 퇴근하기 버튼
  async clockOut(employeeId: string): Promise<SaveResult> {
    const date = todayStr();
    const existing = await workTimeRepository.findByEmployeeAndDate(employeeId, date);
    if (!existing || !existing.clockIn) {
      return { success: false, errorMessage: '출근 기록이 없습니다. 먼저 출근하기를 눌러주세요.' };
    }
    const time = nowHHmm();
    const workedMinutes = calcWorkedMinutes(existing.clockIn, time, existing.breakMinutes);
    const updated = await workTimeRepository.upsert(employeeId, date, { clockOut: time, workedMinutes });
    return { success: true, record: updated };
  },

  // 수동 입력/수정 (직원 본인 또는 관리자)
  async saveManualEntry(input: ManualEntryInput, editedBy: string): Promise<SaveResult> {
    const validationError = validateClockTimes(input.clockIn, input.clockOut, input.breakMinutes);
    if (validationError) {
      return { success: false, errorMessage: validationError };
    }
    const workedMinutes = calcWorkedMinutes(input.clockIn, input.clockOut, input.breakMinutes);
    const updated = await workTimeRepository.upsert(input.employeeId, input.date, {
      clockIn: input.clockIn,
      clockOut: input.clockOut,
      breakMinutes: input.breakMinutes,
      workedMinutes,
      memo: input.memo,
      editedBy,
    });
    return { success: true, record: updated };
  },

  sumMinutes(records: WorkTimeRecord[]): number {
    return records.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0);
  },

  sumBreakMinutes(records: WorkTimeRecord[]): number {
    return records.reduce((sum, r) => sum + (r.breakMinutes ?? 0), 0);
  },
};
