import type { ShiftEntry } from '@/data/types';

const FIVE_PM_MINUTES = 17 * 60;

function timeToMinutes(value: string | null): number | null {
  if (!value) return null;
  const [hourText, minuteText = '0'] = value.trim().split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

export function isWorkingAtFive(shift: ShiftEntry): boolean {
  if (shift.status !== 'working') return false;
  const workStart = timeToMinutes(shift.startTime);
  const workEnd = timeToMinutes(shift.endTime);
  return (
    workStart !== null &&
    workEnd !== null &&
    workStart <= FIVE_PM_MINUTES &&
    workEnd > FIVE_PM_MINUTES
  );
}

export function calculateFivePmWorkingCount(date: string, shifts: ShiftEntry[]): number {
  const dateShifts = shifts.filter((shift) => shift.date === date);
  const count = dateShifts.filter(isWorkingAtFive).length;

  console.info('[calculateFivePmWorkingCount]', {
    date,
    count,
    condition: 'workStart <= 17:00 AND workEnd > 17:00',
    shifts: dateShifts.map((shift) => ({
      employeeId: shift.employeeId,
      workStart: shift.startTime,
      workEnd: shift.endTime,
      status: shift.status,
      included: isWorkingAtFive(shift),
    })),
  });

  return count;
}
