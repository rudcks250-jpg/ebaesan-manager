import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { MonthNav } from '@/components/common/MonthNav';
import { useToast } from '@/components/common/Toast';
import { payrollService } from '@/services/payrollService';
import { employeeService } from '@/services/employeeService';
import type { Employee } from '@/data/types';

export function PayrollDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const today = new Date();
  const [year, setYear] = useState(Number(searchParams.get('year')) || today.getFullYear());
  const [month, setMonth] = useState(Number(searchParams.get('month')) || today.getMonth() + 1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [employee, setEmployee] = useState<Employee | undefined>(undefined);
  const [payroll, setPayroll] = useState<Awaited<ReturnType<typeof payrollService.getEmployeePayroll>>>(undefined);
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof payrollService.getEmployeeCalendar>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    Promise.all([
      employeeService.get(employeeId),
      payrollService.getEmployeePayroll(employeeId, year, month),
      payrollService.getEmployeeCalendar(employeeId, year, month),
    ]).then(([emp, pr, cal]) => {
      setEmployee(emp);
      setPayroll(pr);
      setCalendar(cal);
      setLoading(false);
    });
  }, [employeeId, year, month, refreshKey]);

  if (loading) {
    return (
      <Layout title="급여명세">
        <p className="text-sm text-ink-faint text-center py-10">불러오는 중...</p>
      </Layout>
    );
  }

  if (!employee || !payroll) {
    return (
      <Layout title="급여명세">
        <p className="text-sm text-ink-faint text-center py-10">직원 정보를 찾을 수 없습니다.</p>
      </Layout>
    );
  }

  const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 월요일=0

  const toggleSettled = async () => {
    if (payroll.settled) {
      await payrollService.unmarkSettled(employee.id, yearMonth);
      showToast('정산 완료가 취소되었습니다.');
    } else {
      await payrollService.markSettled(employee.id, yearMonth);
      showToast('정산 완료로 처리되었습니다.');
    }
    setRefreshKey((k) => k + 1);
  };

  return (
    <Layout title="급여명세">
      <div className="space-y-5">
        <button onClick={() => navigate('/payroll')} className="text-sm font-semibold text-ink-soft press-scale">
          ‹ 급여관리로 돌아가기
        </button>

        <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

        {/* 월간 근무 캘린더 */}
        <Card>
          <p className="font-bold text-ink mb-4">{employee.name}님의 {month}월 근무 캘린더</p>
          <div className="grid grid-cols-7 gap-1.5 mb-2">
            {['월', '화', '수', '목', '금', '토', '일'].map((w) => (
              <div key={w} className="text-center text-xs font-semibold text-ink-faint py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {calendar.map((day) => {
              const dayNum = Number(day.date.slice(-2));
              const worked = day.record?.workedMinutes != null;
              let bg = 'bg-bg';
              let text = 'text-ink-faint';
              let label = '';
              if (worked) {
                bg = 'bg-status-working-bg';
                text = 'text-status-working';
                label = `${day.record!.clockIn}~${day.record!.clockOut}`;
              } else if (day.isScheduledOff) {
                bg = 'bg-status-off-bg';
                text = 'text-status-off';
                label = '휴무';
              }
              return (
                <div
                  key={day.date}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 ${bg} ${
                    day.isToday ? 'ring-2 ring-brand-red' : ''
                  }`}
                >
                  <span className={`text-xs font-bold ${day.isToday ? 'text-brand-red' : text}`}>{dayNum}</span>
                  {label && <span className={`text-[8px] font-semibold ${text} leading-none text-center px-0.5`}>{label}</span>}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-status-working-bg border border-status-working" /> 근무
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-status-off-bg border border-status-off" /> 휴무
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-brand-red" /> 오늘
            </span>
          </div>
        </Card>

        {/* 급여명세서 */}
        <Card>
          <p className="font-bold text-ink mb-4">급여명세서</p>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">이름</span>
              <span className="font-semibold text-ink">{employee.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">급여 지급일</span>
              <span className="font-semibold text-ink">{employee.payday ?? '미설정'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">계산 기간</span>
              <span className="font-semibold text-ink tabular-num">
                {payroll.period.start.replace(/-/g, '.')} ~ {payroll.period.end.replace(/-/g, '.')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">총 근무시간</span>
              <span className="font-semibold text-ink tabular-num">
                {Math.floor(payroll.totalMinutes / 60)}시간 {payroll.totalMinutes % 60}분
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">총 근무일</span>
              <span className="font-semibold text-ink tabular-num">{payroll.totalDays}일</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">{employee.wageType === 'hourly' ? '시급' : '월급'}</span>
              <span className="font-semibold text-ink tabular-num">
                {(employee.wageType === 'hourly' ? employee.hourlyWage : employee.monthlySalary)?.toLocaleString()}원
              </span>
            </div>
            <div className="border-t border-border pt-2.5 flex justify-between">
              <span className="text-ink-soft">세전 급여</span>
              <span className="font-semibold text-ink tabular-num">{payroll.gross.toLocaleString()}원</span>
            </div>
            {payrollService.isWithholdingApplicable(employee) && (
              <div className="flex justify-between">
                <span className="text-ink-soft">3.3% 공제</span>
                <span className="font-semibold text-status-rejected tabular-num">-{payroll.deduction.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between text-base border-t border-border pt-2.5">
              <span className="font-bold text-ink">실수령액</span>
              <span className="font-bold text-brand-red tabular-num">{payroll.net.toLocaleString()}원</span>
            </div>
          </div>

          <Button
            fullWidth
            variant={payroll.settled ? 'secondary' : 'primary'}
            className="mt-5"
            onClick={toggleSettled}
          >
            {payroll.settled ? '정산 완료 취소' : '정산 완료 처리'}
          </Button>
        </Card>
      </div>
    </Layout>
  );
}
