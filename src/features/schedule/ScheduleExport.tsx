import { forwardRef } from 'react';
import { Flame } from 'lucide-react';
import { getEmployeeAccent } from '@/utils/employeeAccent';
import { parseDate } from '@/utils/date';
import type { Employee, ShiftEntry } from '@/data/types';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function shortTime(value: string) {
  const [hours, minutes] = value.split(':');
  return minutes === '00' ? String(Number(hours)) : `${hours}:${minutes}`;
}

export const ScheduleExport = forwardRef<HTMLDivElement, {
  employees: Employee[];
  weekDates: string[];
  shifts: ShiftEntry[];
  rangeLabel: string;
}>(function ScheduleExport({ employees, weekDates, shifts, rangeLabel }, ref) {
  const findShift = (employeeId: string, date: string) =>
    shifts.find((shift) => shift.employeeId === employeeId && shift.date === date);

  return (
    <div
      ref={ref}
      data-schedule-export="true"
      style={{
        position: 'fixed',
        left: '-10000px',
        top: 0,
        width: 1400,
        padding: 56,
        background: '#F5F5F7',
        color: '#111111',
        fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ overflow: 'hidden', borderRadius: 32, background: '#FFFFFF', padding: 42, boxShadow: '0 18px 55px rgba(0,0,0,.10)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 18, color: '#FFFFFF', background: 'linear-gradient(145deg,#38A0FF,#007AFF)' }}>
              <Flame size={29} fill="currentColor" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#007AFF' }}>이배산 숯불구이</div>
              <div style={{ marginTop: 4, fontSize: 31, fontWeight: 850, letterSpacing: '-0.04em' }}>직원 근무 스케줄</div>
            </div>
          </div>
          <div style={{ borderRadius: 16, background: '#F2F2F7', padding: '12px 18px', fontSize: 17, fontWeight: 750, color: '#6E6E73' }}>
            {rangeLabel}
          </div>
        </header>

        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 150, padding: '14px 16px', textAlign: 'left', fontSize: 12, letterSpacing: '.1em', color: '#8E8E93' }}>직원</th>
              {weekDates.map((date) => {
                const parsed = parseDate(date);
                const day = parsed.getDay();
                return (
                  <th key={date} style={{ padding: '12px 6px', textAlign: 'center', background: day === 0 ? '#FFF7F7' : day === 6 ? '#F8F8FA' : '#FFFFFF' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.11em', color: day === 0 ? '#C56A65' : '#8E8E93' }}>{WEEKDAYS[day]}</div>
                    <div style={{ marginTop: 3, fontSize: 22, fontWeight: 850 }}>{parsed.getDate()}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee, rowIndex) => {
              const accent = getEmployeeAccent(employee.name);
              return (
                <tr key={employee.id}>
                  <td style={{ height: 58, borderTop: rowIndex ? '1px solid rgba(0,0,0,.045)' : 'none', padding: '7px 16px', fontSize: 17, fontWeight: 800 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: accent.dotColor }} />
                      {employee.name}
                    </span>
                  </td>
                  {weekDates.map((date) => {
                    const shift = findShift(employee.id, date);
                    const day = parseDate(date).getDay();
                    const working = shift?.status === 'working' && shift.startTime && shift.endTime;
                    return (
                      <td key={date} style={{ height: 58, borderTop: rowIndex ? '1px solid rgba(0,0,0,.045)' : 'none', padding: '6px', textAlign: 'center', background: day === 0 ? '#FFF7F7' : day === 6 ? '#F8F8FA' : '#FFFFFF' }}>
                        {working ? (
                          <span style={{ display: 'flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, background: accent.backgroundColor, color: accent.color, fontSize: 15, fontWeight: 850 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 99, background: accent.dotColor }} />
                            {shortTime(shift.startTime!)}-{shortTime(shift.endTime!)}
                          </span>
                        ) : shift ? (
                          <span style={{ display: 'flex', minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: '#FFF0EF', color: '#B34E47', fontSize: 14, fontWeight: 800 }}>휴무</span>
                        ) : (
                          <span style={{ color: '#C7C7CC', fontSize: 17 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
