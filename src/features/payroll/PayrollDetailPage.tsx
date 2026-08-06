import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { employeeService } from '@/services/employeeService';
import { payrollService } from '@/services/payrollService';
import { workTimeService } from '@/services/workTimeService';
import type { Employee, WorkTimeRecord } from '@/data/types';
import { formatDate } from '@/utils/date';
import { minutesToCompactHourText } from '@/utils/time';

function formatClockTime(value: string | null | undefined) {
  if (!value) return '-';
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
}

function formatShortDate(value: string) {
  const [, month, day] = value.split('-');
  return `${month}.${day}`;
}

function getMonthRange(date: Date) {
  return {
    start: formatDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    end: formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

export function PayrollDetailPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialPeriodApplied = useRef(false);

  const today = new Date();
  const initialYear = Number(searchParams.get('year')) || today.getFullYear();
  const initialMonth = Number(searchParams.get('month')) || today.getMonth() + 1;
  const initialRange = getMonthRange(new Date(initialYear, initialMonth - 1, 1));

  const [employee, setEmployee] = useState<Employee>();
  const [records, setRecords] = useState<WorkTimeRecord[]>([]);
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    Promise.all([
      employeeService.get(employeeId),
      workTimeService.listByEmployee(employeeId),
    ])
      .then(([nextEmployee, nextRecords]) => {
        if (cancelled) return;
        setEmployee(nextEmployee);
        setRecords(nextRecords);
        if (nextEmployee && !initialPeriodApplied.current) {
          const period = payrollService.getPayrollPeriod(nextEmployee.payday, initialYear, initialMonth);
          setStartDate(period.start);
          setEndDate(period.end);
          initialPeriodApplied.current = true;
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('급여 정보를 불러오지 못했습니다. 다시 시도해주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, initialMonth, initialYear]);

  const isValidRange = Boolean(startDate && endDate && startDate <= endDate);
  const filteredRecords = useMemo(
    () =>
      isValidRange
        ? records
            .filter(
              (record) =>
                record.employeeId === employeeId &&
                record.date >= startDate &&
                record.date <= endDate &&
                record.workedMinutes !== null
            )
            .sort((a, b) => a.date.localeCompare(b.date))
        : [],
    [employeeId, endDate, isValidRange, records, startDate]
  );

  const totalMinutes = workTimeService.sumMinutes(filteredRecords);
  const isHourly = employee?.wageType === 'hourly';
  const hourlyWage = employee?.hourlyWage ?? 0;
  const gross = employee
    ? isHourly
      ? payrollService.calcGrossPay(hourlyWage, totalMinutes)
      : (employee.monthlySalary ?? 0)
    : 0;
  const deduction = employee ? payrollService.calcEmployeeDeduction(employee, gross) : 0;
  const net = gross - deduction;

  const applyThisMonth = () => {
    const range = getMonthRange(new Date());
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const applyLastMonth = () => {
    const range = getMonthRange(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const applyRecentPayrollPeriod = () => {
    if (!employee) return;
    const period = payrollService.getCurrentPayrollPeriod(employee.payday);
    setStartDate(period.start);
    setEndDate(period.end);
  };

  if (loading) {
    return (
      <Layout title="급여명세">
        <p className="py-10 text-center text-sm text-ink-faint">불러오는 중...</p>
      </Layout>
    );
  }

  if (!employee || loadError) {
    return (
      <Layout title="급여명세">
        <p className="py-10 text-center text-sm text-status-rejected">
          {loadError || '직원 정보를 찾을 수 없습니다.'}
        </p>
      </Layout>
    );
  }

  return (
    <Layout title="급여명세">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
        <button
          type="button"
          onClick={() => navigate('/payroll')}
          className="press-scale text-sm font-semibold text-ink-soft"
        >
          ‹ 급여관리로 돌아가기
        </button>

        <div>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">{employee.name}</h2>
          <p className="mt-1 text-sm font-semibold text-ink-soft sm:text-base">
            {isHourly
              ? `시급 ${hourlyWage.toLocaleString()}원`
              : `월급 ${(employee.monthlySalary ?? 0).toLocaleString()}원`}
          </p>
        </div>

        <Card>
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">기간 선택</h3>
            <p className="text-xs text-ink-faint">시작일과 종료일을 모두 포함하여 계산합니다.</p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 sm:max-w-2xl sm:gap-3">
            <Input
              label="시작일"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="px-2 text-sm sm:px-4 sm:text-[15px]"
            />
            <span className="mb-8 text-sm font-semibold text-ink-faint">~</span>
            <Input
              label="종료일"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              error={!isValidRange ? '종료일을 확인해주세요.' : undefined}
              className="px-2 text-sm sm:px-4 sm:text-[15px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={applyThisMonth}>
              이번 달
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={applyLastMonth}>
              지난 달
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={applyRecentPayrollPeriod}>
              최근 급여기간
            </Button>
          </div>
        </Card>

        {!isHourly && (
          <div className="rounded-control bg-brand-beige-light px-4 py-3 text-sm text-ink-soft">
            월급제 직원은 선택 기간의 근무시간을 조회하되, 급여는 등록된 월급 금액을 유지합니다.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="bg-status-working-bg/80">
            <p className="text-sm font-semibold text-status-working">총 근무시간</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              {minutesToCompactHourText(totalMinutes)}
            </p>
            <p className="mt-2 text-xs text-ink-soft">총 {filteredRecords.length}일 근무</p>
          </Card>

          <Card className="bg-brand-red/5 ring-brand-red/10">
            <p className="text-sm font-semibold text-brand-red">최종 지급액</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-brand-red sm:text-4xl">
              {net.toLocaleString()}원
            </p>
            <p className="mt-2 text-xs text-ink-soft">공제 후 지급 예정 금액</p>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card>
            <p className="text-xs font-semibold text-ink-soft sm:text-sm">세전 급여</p>
            <p className="mt-2 text-lg font-bold text-ink sm:text-2xl">{gross.toLocaleString()}원</p>
          </Card>
          <Card>
            <p className="text-xs font-semibold text-ink-soft sm:text-sm">3.3% 공제</p>
            <p className="mt-2 text-lg font-bold text-status-rejected sm:text-2xl">
              {deduction > 0 ? `-${deduction.toLocaleString()}원` : '0원'}
            </p>
          </Card>
        </div>

        <Card>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-ink">근무내역</h3>
              <p className="mt-1 text-xs text-ink-faint">
                {startDate.replace(/-/g, '.')} ~ {endDate.replace(/-/g, '.')}
              </p>
            </div>
            <span className="whitespace-nowrap text-sm font-semibold text-ink-soft">
              {filteredRecords.length}일
            </span>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="rounded-control bg-bg px-4 py-10 text-center text-sm text-ink-faint">
              선택한 기간에 입력된 근무시간이 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-control border border-border/70">
              <div className="hidden grid-cols-[0.7fr_1.5fr_0.8fr_1fr] gap-3 bg-bg px-4 py-3 text-xs font-semibold text-ink-faint sm:grid">
                <span>날짜</span>
                <span>근무시간</span>
                <span className="text-right">인정시간</span>
                <span className="text-right">급여</span>
              </div>
              <div className="divide-y divide-border/70">
                {filteredRecords.map((record) => {
                  const rowPay = isHourly
                    ? payrollService.calcGrossPay(hourlyWage, record.workedMinutes ?? 0)
                    : null;
                  return (
                    <div
                      key={record.id}
                      className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-4 py-4 text-sm sm:grid-cols-[0.7fr_1.5fr_0.8fr_1fr] sm:items-center sm:gap-3 sm:py-3"
                    >
                      <span className="font-semibold text-ink">{formatShortDate(record.date)}</span>
                      <span className="text-right font-semibold tabular-nums text-ink sm:text-left">
                        {formatClockTime(record.clockIn)} ~ {formatClockTime(record.clockOut)}
                      </span>
                      <span className="text-xs text-ink-faint sm:hidden">인정시간</span>
                      <span className="text-right font-semibold text-ink sm:text-right">
                        {minutesToCompactHourText(record.workedMinutes)}
                      </span>
                      <span className="text-xs text-ink-faint sm:hidden">급여</span>
                      <span className="text-right font-semibold text-ink sm:text-right">
                        {rowPay === null ? '-' : `${rowPay.toLocaleString()}원`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm">
            <div className="flex justify-between gap-4 text-ink-soft">
              <span>총 근무일</span>
              <span className="font-semibold text-ink">{filteredRecords.length}일</span>
            </div>
            <div className="flex justify-between gap-4 text-ink-soft">
              <span>총 근무시간</span>
              <span className="font-semibold text-ink">{minutesToCompactHourText(totalMinutes)}</span>
            </div>
            <div className="flex justify-between gap-4 text-ink-soft">
              <span>세전 급여</span>
              <span className="font-semibold text-ink">{gross.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between gap-4 text-ink-soft">
              <span>3.3% 공제</span>
              <span className="font-semibold text-status-rejected">
                {deduction > 0 ? `-${deduction.toLocaleString()}원` : '0원'}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-3 text-base">
              <span className="font-bold text-ink">최종 지급액</span>
              <span className="text-lg font-bold text-brand-red">{net.toLocaleString()}원</span>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
