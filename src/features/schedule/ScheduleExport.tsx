import { forwardRef } from 'react';
import { Flame } from 'lucide-react';
import { getEmployeeAccent } from '@/utils/employeeAccent';
import { parseDate } from '@/utils/date';
import type { Employee, ShiftEntry } from '@/data/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
        width: 1320,
        padding: 28,
        background: '#F5F5F7',
        color: '#111111',
        fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div style={{ overflow: 'hidden', borderRadius: 24, background: '#FFFFFF', padding: 28, boxShadow: '0 14px 38px rgba(0,0,0,.08)' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 13, color: '#FFFFFF', background: 'linear-gradient(145deg,#38A0FF,#007AFF)' }}>
              <Flame size={22} fill="currentColor" />
            </div>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.035em' }}>이배산 숯불구이 근무표</div>
          </div>
          <div style={{ width: 286, height: 44, borderRadius: 14, background: '#F2F2F7' }}>
            <svg
              width="286"
              height="44"
              viewBox="0 0 286 44"
              aria-label={rangeLabel}
            >
              <text
                x="143"
                y="22"
                fill="#6E6E73"
                fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
                fontSize="17"
                fontWeight="700"
                letterSpacing="0.25"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {rangeLabel}
              </text>
            </svg>
          </div>
        </header>

        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ width: 128, padding: '10px 10px', textAlign: 'left', fontSize: 12, letterSpacing: '.08em', color: '#8E8E93' }}>직원</th>
              {weekDates.map((date) => {
                const parsed = parseDate(date);
                const day = parsed.getDay();
                return (
                  <th key={date} style={{ padding: '10px 6px', textAlign: 'center', background: day === 0 ? '#FFF7F7' : day === 6 ? '#F8F8FA' : '#FFFFFF' }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: day === 0 ? '#C56A65' : '#55555A' }}>
                      {WEEKDAYS[day]} {parsed.getDate()}
                    </span>
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
                  <td style={{ height: 48, borderTop: rowIndex ? '1px solid rgba(0,0,0,.045)' : 'none', padding: '4px 10px', fontSize: 16, fontWeight: 700 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: accent.dotColor }} />
                      {employee.name}
                    </span>
                  </td>
                  {weekDates.map((date) => {
                    const shift = findShift(employee.id, date);
                    const day = parseDate(date).getDay();
                    const working = shift?.status === 'working' && shift.startTime && shift.endTime;
                    return (
                      <td key={date} style={{ height: 48, borderTop: rowIndex ? '1px solid rgba(0,0,0,.045)' : 'none', padding: '3px', textAlign: 'center', background: day === 0 ? '#FFF7F7' : day === 6 ? '#F8F8FA' : '#FFFFFF' }}>
                        {working ? (
                          <span style={{ display: 'block', height: 38, boxSizing: 'border-box', padding: '0 8px', borderRadius: 12, background: accent.backgroundColor, color: accent.color }}>
                            <svg
                              width="100%"
                              height="38"
                              viewBox="0 0 160 38"
                              preserveAspectRatio="xMidYMid meet"
                              aria-label={`${shortTime(shift.startTime!)}-${shortTime(shift.endTime!)}`}
                            >
                              <text
                                x="80"
                                y="19"
                                fill={accent.color}
                                fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
                                fontSize="17"
                                fontWeight="600"
                                textAnchor="middle"
                                dominantBaseline="central"
                              >
                                <tspan fill={accent.dotColor}>●</tspan>
                                <tspan>　{shortTime(shift.startTime!)}-{shortTime(shift.endTime!)}</tspan>
                              </text>
                            </svg>
                          </span>
                        ) : (
                          <svg
                            width="100%"
                            height="38"
                            viewBox="0 0 160 38"
                            preserveAspectRatio="xMidYMid meet"
                            aria-label="휴무"
                          >
                            <text
                              x="80"
                              y="19"
                              fill="#9CA3AF"
                              fontFamily="Pretendard, -apple-system, BlinkMacSystemFont, sans-serif"
                              fontSize="15"
                              fontWeight="500"
                              letterSpacing="0"
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              휴무
                            </text>
                          </svg>
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
