import type { ShiftEntry } from '@/data/types';
import { parseDate } from '@/utils/date';

const FIVE_PM = '17:00';
export const MINIMUM_FIVE_PM_STAFF = 4;

const REQUIRED_TOTAL_BY_WEEKDAY: Record<number, number> = {
  0: 7,
  1: 7,
  2: 7,
  3: 7,
  4: 7,
  5: 8,
  6: 7,
};

export interface ScheduleCoverage {
  date: string;
  total: number;
  atFive: number;
  requiredTotal: number;
  fiveAvailable: boolean;
  isNormal: boolean;
  reason: string;
}

export function isWorkingAtFive(shift: ShiftEntry): boolean {
  return (
    shift.status === 'working' &&
    !!shift.startTime &&
    !!shift.endTime &&
    shift.startTime <= FIVE_PM &&
    shift.endTime > FIVE_PM
  );
}

export function calculateScheduleCoverage(
  weekDates: string[],
  shifts: ShiftEntry[]
): ScheduleCoverage[] {
  return weekDates.map((date) => {
    const workingShifts = shifts.filter(
      (shift) =>
        shift.date === date &&
        shift.status === 'working' &&
        !!shift.startTime &&
        !!shift.endTime
    );
    const total = workingShifts.length;
    const atFive = workingShifts.filter(isWorkingAtFive).length;
    const requiredTotal = REQUIRED_TOTAL_BY_WEEKDAY[parseDate(date).getDay()];
    const totalShort = total < requiredTotal;
    const fiveShort = atFive < MINIMUM_FIVE_PM_STAFF;
    const reason =
      totalShort && fiveShort
        ? '총/17시 부족'
        : totalShort
          ? '총 인원 부족'
          : fiveShort
            ? '17시 인원 부족'
            : '정상';

    return {
      date,
      total,
      atFive,
      requiredTotal,
      fiveAvailable: !fiveShort,
      isNormal: !totalShort && !fiveShort,
      reason,
    };
  });
}
