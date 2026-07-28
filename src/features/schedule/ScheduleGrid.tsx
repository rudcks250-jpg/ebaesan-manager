import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ScheduleCell } from '@/features/schedule/ScheduleCell';
import { parseDate, isToday } from '@/utils/date';
import { getEmployeeAccent } from '@/utils/employeeAccent';
import type { Employee, ShiftEntry } from '@/data/types';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface ScheduleGridProps {
  employees: Employee[];
  weekDates: string[];
  shifts: ShiftEntry[];
  currentEmployeeId?: string;
  clickable: boolean;
  selectedCell?: string;
  onCellClick?: (employee: Employee, date: string) => void;
  onDragCopy?: (employee: Employee, dates: string[], shift: ShiftEntry) => Promise<void>;
}

export function ScheduleGrid({
  employees,
  weekDates,
  shifts,
  currentEmployeeId,
  clickable,
  selectedCell,
  onCellClick,
  onDragCopy,
}: ScheduleGridProps) {
  const [previewDates, setPreviewDates] = useState<string[]>([]);
  const dragRef = useRef<{
    pointerId: number;
    employee: Employee;
    sourceDate: string;
    shift: ShiftEntry;
    startX: number;
    startY: number;
    dragging: boolean;
    dates: string[];
  } | null>(null);
  const suppressClickRef = useRef(false);
  const getShift = (employeeId: string, date: string) =>
    shifts.find((s) => s.employeeId === employeeId && s.date === date);

  const getDayStyle = (date: string) => {
    const day = parseDate(date).getDay();
    if (isToday(date)) return 'bg-[#F0F7FF]';
    if (day === 0) return 'bg-[#FFF7F7]';
    if (day === 6) return 'bg-[#F8F8FA]';
    return '';
  };

  const updateDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.dragging && distance < 8) return;
    drag.dragging = true;

    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-schedule-date]');
    let targetDate = hit?.dataset.scheduleEmployee === drag.employee.id ? hit.dataset.scheduleDate : undefined;
    if (event.pointerType === 'touch' && (!targetDate || targetDate === drag.sourceDate)) {
      const sourceIndex = weekDates.indexOf(drag.sourceDate);
      const offset = Math.round((event.clientX - drag.startX) / 44);
      targetDate = weekDates[Math.max(0, Math.min(6, sourceIndex + offset))];
    }
    if (!targetDate) return;

    const sourceIndex = weekDates.indexOf(drag.sourceDate);
    const targetIndex = weekDates.indexOf(targetDate);
    const crossed = weekDates
      .slice(Math.min(sourceIndex, targetIndex), Math.max(sourceIndex, targetIndex) + 1)
      .filter((date) => date !== drag.sourceDate);
    drag.dates = crossed;
    setPreviewDates(crossed);
  };

  const finishDrag = async (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.dragging || drag.dates.length === 0) {
      setPreviewDates([]);
      return;
    }
    suppressClickRef.current = true;
    try {
      await onDragCopy?.(drag.employee, drag.dates, drag.shift);
    } finally {
      setPreviewDates([]);
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  };

  const cellProps = (employee: Employee, date: string) => {
    const shift = getShift(employee.id, date);
    return {
      shift,
      employeeName: employee.name,
      isOwnRow: employee.id === currentEmployeeId,
      selected: selectedCell === `${employee.id}:${date}`,
      preview: previewDates.includes(date) && dragRef.current?.employee.id === employee.id,
      clickable,
      onClick: () => {
        if (!suppressClickRef.current) onCellClick?.(employee, date);
      },
      onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!clickable || !shift || shift.status === 'unscheduled') return;
        dragRef.current = {
          pointerId: event.pointerId,
          employee,
          sourceDate: date,
          shift,
          startX: event.clientX,
          startY: event.clientY,
          dragging: false,
          dates: [],
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: updateDrag,
      onPointerUp: finishDrag,
      onPointerCancel: () => {
        dragRef.current = null;
        setPreviewDates([]);
      },
    };
  };

  return (
    <>
      <div className="hidden md:block max-h-[calc(100vh-15rem)] overflow-auto scrollbar-thin rounded-[28px] bg-white/92 p-3 shadow-premium ring-1 ring-black/[0.035]">
        <table className="w-full min-w-[900px] border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-40 w-40 bg-white/95 px-5 py-4 text-left text-[11px] font-bold uppercase tracking-[.12em] text-ink-faint backdrop-blur-xl">
                직원
              </th>
              {weekDates.map((date) => {
                const parsed = parseDate(date);
                const today = isToday(date);
                return (
                  <th key={date} className={`sticky top-0 z-30 min-w-[112px] px-1.5 py-2 backdrop-blur-xl ${getDayStyle(date) || 'bg-white/95'}`}>
                    <div className={`rounded-2xl py-2.5 ${today ? 'bg-white/75 shadow-[0_1px_8px_rgba(0,122,255,.08)]' : ''}`}>
                      <div className={`text-[10px] font-bold tracking-[.12em] ${today ? 'text-brand-red' : 'text-ink-faint'}`}>
                        {WEEKDAY_LABELS[parsed.getDay()]}
                      </div>
                      <div className={`mt-0.5 text-xl font-bold tabular-nums ${today ? 'text-brand-red' : 'text-ink'}`}>
                        {parsed.getDate()}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, index) => (
              <tr key={employee.id}>
                <td
                  className={`sticky left-0 z-20 h-[56px] whitespace-nowrap bg-white/95 px-4 align-middle text-[17px] font-bold backdrop-blur-xl ${
                    index > 0 ? 'border-t border-black/[0.035]' : ''
                  } ${employee.id === currentEmployeeId ? 'text-brand-red' : 'text-ink'}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${getEmployeeAccent(employee.name).dot}`} />
                    {employee.name}
                  </span>
                </td>
                {weekDates.map((date) => (
                  <td
                    key={date}
                    className={`h-[56px] px-1.5 py-1 align-middle ${
                      index > 0 ? 'border-t border-black/[0.035]' : ''
                    } ${getDayStyle(date)}`}
                  >
                    <div data-schedule-date={date} data-schedule-employee={employee.id}>
                      <ScheduleCell {...cellProps(employee, date)} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {employees.map((employee) => (
          <section
            key={employee.id}
            className="overflow-hidden rounded-[24px] bg-white/92 p-4 shadow-premium ring-1 ring-black/[0.035]"
          >
            <h3 className={`mb-3 flex items-center gap-2.5 px-1 text-[18px] font-bold ${employee.id === currentEmployeeId ? 'text-brand-red' : 'text-ink'}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${getEmployeeAccent(employee.name).dot}`} />
              {employee.name}
            </h3>
            <div>
              {weekDates.map((date, index) => {
                const parsed = parseDate(date);
                const today = isToday(date);
                return (
                  <div
                    key={date}
                    className={`grid min-h-[64px] grid-cols-[64px_1fr] items-center gap-3 rounded-2xl px-2 py-1 ${
                      index > 0 ? 'border-t border-black/[0.035]' : ''
                    } ${getDayStyle(date)}`}
                  >
                    <div className="text-center">
                      <p className={`text-[9px] font-bold tracking-[.1em] ${today ? 'text-brand-red' : 'text-ink-faint'}`}>
                        {WEEKDAY_LABELS[parsed.getDay()]}
                      </p>
                      <p className={`text-base font-bold tabular-nums ${today ? 'text-brand-red' : 'text-ink'}`}>
                        {parsed.getDate()}
                      </p>
                    </div>
                    <div data-schedule-date={date} data-schedule-employee={employee.id}>
                      <ScheduleCell {...cellProps(employee, date)} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
