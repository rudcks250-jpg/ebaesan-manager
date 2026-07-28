import type { Employee } from '@/data/types';

export interface EmployeePaydayInfo {
  daysUntil: number;
  isWeekly: boolean;
  occursThisMonth: boolean;
  label: string;
  tone: 'today' | 'soon' | 'week' | 'later';
}

function atStartOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((atStartOfDay(to).getTime() - atStartOfDay(from).getTime()) / 86_400_000);
}

export function getEmployeePaydayInfo(payday: string | undefined, today = new Date()): EmployeePaydayInfo {
  const base = atStartOfDay(today);
  const isWeekly = payday?.includes('매주 일요일') ?? false;
  let nextPayday: Date | undefined;

  if (isWeekly) {
    const daysToSunday = (7 - base.getDay()) % 7;
    nextPayday = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysToSunday);
  } else if (payday?.includes('말일')) {
    const thisMonthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    nextPayday = base <= thisMonthEnd
      ? thisMonthEnd
      : new Date(base.getFullYear(), base.getMonth() + 2, 0);
  } else {
    const match = payday?.match(/매월\s*(\d+)일/);
    if (match) {
      const requestedDay = Number(match[1]);
      const thisMonthDay = Math.min(requestedDay, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
      const candidate = new Date(base.getFullYear(), base.getMonth(), thisMonthDay);
      if (candidate >= base) {
        nextPayday = candidate;
      } else {
        const nextMonthLastDay = new Date(base.getFullYear(), base.getMonth() + 2, 0).getDate();
        nextPayday = new Date(base.getFullYear(), base.getMonth() + 1, Math.min(requestedDay, nextMonthLastDay));
      }
    }
  }

  if (!nextPayday) {
    return { daysUntil: Number.POSITIVE_INFINITY, isWeekly, occursThisMonth: false, label: '일정 미설정', tone: 'later' };
  }

  const daysUntil = daysBetween(base, nextPayday);
  const tone = daysUntil === 0 ? 'today' : daysUntil <= 3 ? 'soon' : daysUntil <= 7 ? 'week' : 'later';
  return {
    daysUntil,
    isWeekly,
    occursThisMonth: nextPayday.getFullYear() === base.getFullYear() && nextPayday.getMonth() === base.getMonth(),
    label: daysUntil === 0 ? '오늘 지급' : `D-${daysUntil}`,
    tone,
  };
}

export function compareEmployeesByPayday(a: Employee, b: Employee): number {
  const aPayday = getEmployeePaydayInfo(a.payday);
  const bPayday = getEmployeePaydayInfo(b.payday);
  const bucket = (employee: Employee, info: EmployeePaydayInfo) => {
    if (info.daysUntil === 0) return 0;
    if (info.daysUntil <= 7) return 1;
    if (!info.isWeekly && Number.isFinite(info.daysUntil)) return 2;
    if (info.isWeekly) return 3;
    return 4;
  };
  return bucket(a, aPayday) - bucket(b, bPayday)
    || aPayday.daysUntil - bPayday.daysUntil
    || a.name.localeCompare(b.name, 'ko');
}
