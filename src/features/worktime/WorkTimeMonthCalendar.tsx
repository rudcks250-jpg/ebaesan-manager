import { Card } from '@/components/common/Card';
import type { ShiftEntry, WorkTimeRecord } from '@/data/types';
import { parseDate, todayStr, WEEKDAY_LABELS_KO } from '@/utils/date';
import { minutesToCompactHourText } from '@/utils/time';

interface WorkTimeMonthCalendarProps {
  dates: string[];
  records: WorkTimeRecord[];
  shifts: ShiftEntry[];
  onSelectDate: (date: string) => void;
}

export function WorkTimeMonthCalendar({
  dates,
  records,
  shifts,
  onSelectDate,
}: WorkTimeMonthCalendarProps) {
  const firstDay = parseDate(dates[0]).getDay();
  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;

  return (
    <Card padded={false} className="p-3 sm:p-5">
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS_KO.map((weekday) => (
          <div key={weekday} className="text-center text-xs text-ink-faint font-medium py-1">
            {weekday}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <div key={`blank-${index}`} />
        ))}
        {dates.map((date) => {
          const record = records.find((candidate) => candidate.date === date);
          const shift = shifts.find((candidate) => candidate.date === date);
          const isWorkingDay = shift?.status === 'working';
          const hasRecord = record?.workedMinutes !== null && record?.workedMinutes !== undefined;
          const label = hasRecord
            ? minutesToCompactHourText(record.workedMinutes)
            : isWorkingDay
              ? '미입력'
              : '휴무';

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`aspect-square rounded-control flex flex-col items-center justify-center gap-0.5 text-xs ${
                date === todayStr() ? 'ring-2 ring-brand-red' : ''
              } ${
                hasRecord
                  ? 'bg-status-working-bg'
                  : isWorkingDay
                    ? 'bg-brand-beige-light'
                    : 'bg-status-rejected-bg'
              }`}
            >
              <span className="font-semibold text-ink">{Number(date.slice(-2))}</span>
              <span
                className={`whitespace-nowrap text-[11px] font-semibold ${
                  hasRecord
                    ? 'text-status-working'
                    : isWorkingDay
                      ? 'text-ink-faint'
                      : 'text-status-rejected'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
