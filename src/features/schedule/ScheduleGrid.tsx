import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ScheduleCell } from '@/features/schedule/ScheduleCell';
import {
  calculateScheduleCoverage,
  MINIMUM_FIVE_PM_STAFF,
} from '@/features/schedule/scheduleCoverage';
import { parseDate, isToday, todayStr, getWeekdayLabel } from '@/utils/date';
import { getEmployeeAccent } from '@/utils/employeeAccent';
import type { Employee, ShiftEntry } from '@/data/types';

const WEEKDAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MOBILE_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
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
  const [selectedMobileDate, setSelectedMobileDate] = useState(() => {
    const today = todayStr();
    return weekDates.includes(today) ? today : weekDates[0];
  });
  const mobileSwipeStartRef = useRef<{ x: number; y: number } | undefined>(undefined);
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
  useEffect(() => {
    const today = todayStr();
    setSelectedMobileDate(weekDates.includes(today) ? today : weekDates[0]);
  }, [weekDates]);
  const coverage = useMemo(
    () => calculateScheduleCoverage(weekDates, shifts),
    [shifts, weekDates]
  );

  const getDayStyle = (date: string) => {
    const day = parseDate(date).getDay();
    if (isToday(date)) return 'bg-[#F0F7FF]';
    if (day === 0) return 'bg-[#FFF7F7]';
    if (day === 6) return 'bg-[#F8F8FA]';
    return '';
  };
  const moveMobileDay = (delta: number) => {
    const currentIndex = Math.max(0, weekDates.indexOf(selectedMobileDate));
    const nextIndex = Math.max(0, Math.min(weekDates.length - 1, currentIndex + delta));
    setSelectedMobileDate(weekDates[nextIndex]);
  };
  const selectedMobileCoverage =
    coverage.find((item) => item.date === selectedMobileDate) ?? coverage[0];

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
          <tfoot>
            <tr>
              <th className="sticky left-0 z-20 bg-[#F8F9FA] px-4 py-3 text-left text-xs font-semibold text-ink-soft">
                총 근무 인원
              </th>
              {coverage.map((item) => (
                <td key={item.date} className="bg-[#F8F9FA] px-2 py-3 text-center text-sm font-bold text-ink">
                  {item.total}명
                  <span className="ml-1 text-[10px] font-medium text-ink-faint">/ {item.requiredTotal}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-white px-4 py-3 text-left text-xs font-semibold text-ink-soft">
                17시 인원
              </th>
              {coverage.map((item) => (
                <td key={item.date} className="bg-white px-1 py-2.5 text-center">
                  <p className="text-xs font-bold text-ink">
                    {item.atFive}명
                    <span className="ml-1 text-[9px] font-medium text-ink-faint">
                      / 최소 {MINIMUM_FIVE_PM_STAFF}명
                    </span>
                  </p>
                  <p className={`mt-1 text-[10px] font-bold ${item.fiveAvailable ? 'text-status-working' : 'text-status-rejected'}`}>
                    {item.fiveAvailable ? '✅ 가능' : '❌ 부족'}
                  </p>
                </td>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-20 bg-[#F8F9FA] px-4 py-3 text-left text-xs font-semibold text-ink-soft">
                상태
              </th>
              {coverage.map((item) => (
                <td
                  key={item.date}
                  className={`bg-[#F8F9FA] px-1.5 py-3 text-center text-[11px] font-bold ${
                    item.isNormal ? 'text-status-working' : 'text-status-rejected'
                  }`}
                >
                  {item.isNormal ? '✅ 정상' : `❌ ${item.reason}`}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-4 md:hidden">
        <section className="rounded-[24px] bg-white/92 p-3 shadow-premium ring-1 ring-black/[0.035]">
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date) => {
              const selected = date === selectedMobileDate;
              const today = isToday(date);
              const parsed = parseDate(date);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedMobileDate(date)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold transition-all active:scale-[.97] ${
                    selected
                      ? 'bg-brand-red text-white shadow-[0_7px_18px_-10px_rgba(0,122,255,.8)]'
                      : today
                        ? 'bg-brand-red-light text-brand-red'
                        : 'text-ink-soft hover:bg-brand-beige-light'
                  }`}
                >
                  <span>{MOBILE_WEEKDAY_LABELS[parsed.getDay()]}</span>
                  <span className="mt-0.5 text-[11px] tabular-nums">{parsed.getDate()}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className="overflow-hidden rounded-[24px] bg-white/92 p-4 shadow-premium ring-1 ring-black/[0.035]"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            mobileSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
          }}
          onTouchEnd={(event) => {
            const start = mobileSwipeStartRef.current;
            const touch = event.changedTouches[0];
            mobileSwipeStartRef.current = undefined;
            if (!start) return;
            const deltaX = touch.clientX - start.x;
            const deltaY = touch.clientY - start.y;
            if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
            moveMobileDay(deltaX < 0 ? 1 : -1);
          }}
        >
          <div className="mb-3 flex items-center justify-between px-1">
            <button type="button" onClick={() => moveMobileDay(-1)} className="px-2 py-1 text-lg text-ink-soft" aria-label="이전 날짜">
              ←
            </button>
            <h3 className="text-base font-bold text-ink">
              {selectedMobileDate.replaceAll('-', '.')} ({getWeekdayLabel(selectedMobileDate)})
            </h3>
            <button type="button" onClick={() => moveMobileDay(1)} className="px-2 py-1 text-lg text-ink-soft" aria-label="다음 날짜">
              →
            </button>
          </div>

          <div className="divide-y divide-black/[0.045]">
            {employees.map((employee) => (
              <div key={employee.id} className="grid min-h-[64px] grid-cols-[minmax(100px,1fr)_minmax(130px,1.35fr)] items-center gap-3 py-2">
                <div className={`flex min-w-0 items-center gap-2.5 px-1 text-[16px] font-bold ${employee.id === currentEmployeeId ? 'text-brand-red' : 'text-ink'}`}>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${getEmployeeAccent(employee.name).dot}`} />
                  <span className="truncate">{employee.name}</span>
                </div>
                <div data-schedule-date={selectedMobileDate} data-schedule-employee={employee.id}>
                  <ScheduleCell {...cellProps(employee, selectedMobileDate)} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {selectedMobileCoverage && (
          <section className="rounded-[22px] bg-white/92 p-4 shadow-premium ring-1 ring-black/[0.035]">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] font-medium text-ink-faint">총 인원</p>
                <p className="mt-1 text-sm font-bold text-ink">{selectedMobileCoverage.total}/{selectedMobileCoverage.requiredTotal}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-ink-faint">17시 인원</p>
                <p className="mt-1 text-xs font-bold text-ink">
                  {selectedMobileCoverage.atFive}명 / 최소 {MINIMUM_FIVE_PM_STAFF}명
                </p>
                <p className={`mt-1 text-[11px] font-bold ${selectedMobileCoverage.fiveAvailable ? 'text-status-working' : 'text-status-rejected'}`}>
                  {selectedMobileCoverage.fiveAvailable ? '✅ 가능' : '❌ 부족'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-ink-faint">상태</p>
                <p className={`mt-1 text-[11px] font-bold ${selectedMobileCoverage.isNormal ? 'text-status-working' : 'text-status-rejected'}`}>
                  {selectedMobileCoverage.isNormal ? '✅ 정상' : `❌ ${selectedMobileCoverage.reason}`}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
