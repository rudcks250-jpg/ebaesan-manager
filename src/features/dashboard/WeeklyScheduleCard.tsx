import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { employeeService } from '@/services/employeeService';
import { scheduleService } from '@/services/scheduleService';
import { getMondayOfWeekStr, getWeekDates, getWeekdayLabel, formatMonthDay, isToday, todayStr } from '@/utils/date';
import type { Employee, ScheduleWeek } from '@/data/types';

function compactHour(hhmm: string): string {
  return String(parseInt(hhmm.split(':')[0], 10));
}

export function WeeklyScheduleCard() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [week, setWeek] = useState<ScheduleWeek>({ id: '', weekStartDate: '', shifts: [] });
  const weekStart = getMondayOfWeekStr(todayStr());
  const weekDates = getWeekDates(weekStart);

  useEffect(() => {
    employeeService.listActive().then((list) => setEmployees(list.filter((e) => e.role !== 'admin')));
    scheduleService.getWeek(weekStart).then(setWeek);
  }, [weekStart]);

  const goToSchedule = () => navigate('/schedule');

  return (
    <Card padded={false} className="p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-lg text-ink">이번 주 스케줄</p>
        <button onClick={goToSchedule} className="text-xs font-semibold text-ink-faint">
          전체 보기 &gt;
        </button>
      </div>

      <div className="overflow-x-auto scrollbar-thin -mx-5 px-5 sm:mx-0 sm:px-0">
        <table className="border-separate w-full min-w-[620px]" style={{ borderSpacing: '6px' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface text-left text-xs font-semibold text-ink-soft w-20 px-1 py-1">
                직원
              </th>
              {weekDates.map((d) => (
                <th
                  key={d}
                  className={`text-xs font-bold px-1 py-1.5 min-w-[76px] rounded-lg ${
                    isToday(d) ? 'bg-brand-red-light text-brand-red' : 'text-ink-soft'
                  }`}
                >
                  {getWeekdayLabel(d)}
                  <div className="text-[10px] font-normal">{formatMonthDay(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-sm text-ink-faint py-6">
                  등록된 직원이 없습니다.
                </td>
              </tr>
            )}
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td className="sticky left-0 z-10 bg-surface text-sm font-semibold text-ink px-1 py-1 align-middle">
                  {emp.name}
                </td>
                {weekDates.map((d) => {
                  const shift = week.shifts.find((s) => s.employeeId === emp.id && s.date === d);
                  const working = shift?.status === 'working' && shift.startTime && shift.endTime;
                  return (
                    <td key={d} className="align-middle">
                      <button
                        onClick={goToSchedule}
                        className={`w-full h-11 rounded-lg text-xs font-bold flex items-center justify-center transition-transform active:scale-95 ${
                          working ? 'bg-brand-red-light text-brand-red' : 'bg-status-off-bg text-status-off'
                        } ${isToday(d) ? 'ring-2 ring-brand-red' : ''}`}
                      >
                        {working ? `${compactHour(shift!.startTime!)}-${compactHour(shift!.endTime!)}` : '휴무'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
