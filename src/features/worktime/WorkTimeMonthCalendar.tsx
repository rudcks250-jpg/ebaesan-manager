import { Card } from '@/components/common/Card';
import type { ShiftEntry, WorkTimeRecord } from '@/data/types';
import { parseDate, todayStr, WEEKDAY_LABELS_KO } from '@/utils/date';

function formatClockTime(value: string | null | undefined) {
  if (!value) return '';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
}

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
          const clockIn = formatClockTime(record?.clockIn);
          const clockOut = formatClockTime(record?.clockOut);
          const hasClockTimes = hasRecord && clockIn && clockOut;
          const label = isWorkingDay ? '미입력' : '휴무';

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`min-h-[68px] sm:aspect-square sm:min-h-0 rounded-control flex flex-col items-center justify-center gap-1.5 px-0.5 py-2 text-center overflow-hidden ${
                date === todayStr() ? 'ring-2 ring-brand-red' : ''
              } ${
                hasRecord
                  ? 'bg-status-working-bg'
                  : isWorkingDay
                    ? 'bg-brand-beige-light'
                    : 'bg-status-rejected-bg'
              }`}
            >
              <span
                className={`${hasRecord ? 'text-lg sm:text-xl font-bold' : 'text-base sm:text-lg font-semibold'} leading-none text-ink`}
              >
                {Number(date.slice(-2))}
              </span>
              {hasClockTimes ? (
                <span className="flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1 whitespace-nowrap text-[11px] min-[390px]:text-xs sm:text-sm font-bold leading-tight tracking-[-0.02em] text-status-working">
                  <span>{clockIn}</span>
                  <span>~ {clockOut}</span>
                </span>
              ) : (
                <span
                  className={`whitespace-nowrap text-xs sm:text-sm font-semibold leading-tight ${
                    hasRecord
                      ? 'text-status-working'
                      : isWorkingDay
                        ? 'text-ink-faint'
                        : 'text-status-rejected'
                  }`}
                >
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
