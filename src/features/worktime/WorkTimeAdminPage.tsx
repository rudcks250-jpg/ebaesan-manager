import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Select } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { MonthNav } from '@/components/common/MonthNav';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/employeeService';
import { workTimeService } from '@/services/workTimeService';
import { scheduleService } from '@/services/scheduleService';
import { payrollService } from '@/services/payrollService';
import { WorkTimeEntryModal } from '@/features/worktime/WorkTimeEntryModal';
import { WorkTimeMonthCalendar } from '@/features/worktime/WorkTimeMonthCalendar';
import { formatMonthDay, getWeekdayLabel } from '@/utils/date';
import { getMonthDates } from '@/utils/date';
import { minutesToCompactHourText, minutesToHourText } from '@/utils/time';

export function WorkTimeAdminPage() {
  const { session } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof employeeService.listActive>>>([]);
  const today = new Date();
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);
  const [monthShifts, setMonthShifts] = useState<Awaited<ReturnType<typeof scheduleService.getShiftsInRange>>>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<Awaited<ReturnType<typeof workTimeService.get>>>(undefined);

  useEffect(() => {
    employeeService.listActive().then((list) => {
      setEmployees(list);
      setEmployeeId((prev) => prev || list[0]?.id || '');
    });
  }, [refreshKey]);

  const employee = employees.find((e) => e.id === employeeId);

  const [records, setRecords] = useState<Awaited<ReturnType<typeof workTimeService.listByEmployeeAndMonth>>>([]);
  useEffect(() => {
    if (!employeeId) {
      setRecords([]);
      return;
    }
    workTimeService.listByEmployeeAndMonth(employeeId, year, month).then(setRecords);
  }, [employeeId, year, month, refreshKey]);

  useEffect(() => {
    if (!employeeId) {
      setMonthShifts([]);
      return;
    }
    scheduleService
      .getShiftsInRange(monthDates[0], monthDates[monthDates.length - 1])
      .then((shifts) => setMonthShifts(shifts.filter((shift) => shift.employeeId === employeeId)));
  }, [employeeId, monthDates, refreshKey]);

  const sortedRecords = [...records].sort((a, b) => (a.date < b.date ? 1 : -1));
  const isWorkingDate = (date: string) =>
    monthShifts.some((shift) => shift.date === date && shift.status === 'working');
  const totalMinutes = workTimeService.sumMinutes(records);
  const totalBreak = workTimeService.sumBreakMinutes(records);
  const workDaysCount = records.filter((r) => r.workedMinutes !== null).length;

  // 급여 계산 (근무시간이 바뀌면 totalMinutes가 바뀌므로 자동으로 재계산됨)
  const isHourly = employee?.wageType === 'hourly';
  const grossPay = isHourly && employee?.hourlyWage ? payrollService.calcGrossPay(employee.hourlyWage, totalMinutes) : null;
  const netPay = grossPay !== null && employee ? payrollService.calcNetPay(grossPay, employee) : null;
  const hasWithholding = employee ? payrollService.isWithholdingApplicable(employee) : false;
  const paydayInfo = payrollService.daysUntilPayday(employee?.payday);
  const paydayBadgeText =
    paydayInfo.status === 'today'
      ? '오늘 지급'
      : paydayInfo.status === 'upcoming'
        ? `급여까지 ${paydayInfo.days}일`
        : paydayInfo.status === 'passed'
          ? `${paydayInfo.days}일 지남`
          : '미설정';
  const paydayBadgeTone =
    paydayInfo.status === 'today' ? 'approved' : paydayInfo.status === 'passed' ? 'rejected' : 'pending';

  // 누락된 근무기록: 최근 30일 중 근무 예정이었지만 기록이 없는 날짜
  // (일자별로 반복 조회하지 않고, 30일 범위 스케줄 + 전체 근무기록을 한 번씩만 조회해 비교합니다)
  const [missingDates, setMissingDates] = useState<string[]>([]);
  useEffect(() => {
    if (!employeeId) {
      setMissingDates([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const [shifts, allRecords] = await Promise.all([
        scheduleService.getShiftsInRange(startStr, endStr),
        workTimeService.listByEmployee(employeeId),
      ]);
      if (cancelled) return;

      const missing: string[] = [];
      for (let i = 1; i <= 30; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const shift = shifts.find((s) => s.employeeId === employeeId && s.date === dateStr);
        if (shift?.status === 'working') {
          const rec = allRecords.find((r) => r.date === dateStr);
          if (!rec || !rec.clockIn || !rec.clockOut) missing.push(dateStr);
        }
      }
      setMissingDates(missing);
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeId, refreshKey]);

  return (
    <div className="space-y-4">
      <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>

      <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      <WorkTimeMonthCalendar
        dates={monthDates}
        records={records}
        shifts={monthShifts}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setSelectedRecord(records.find((record) => record.date === date));
        }}
      />

      {/* 급여 정보 카드 - ①~⑥ */}
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-xs text-ink-soft mb-1">이번 달 누적 근무시간</p>
          <p className="text-lg font-bold text-ink">{minutesToHourText(totalMinutes)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-soft mb-1">근무일수</p>
          <p className="text-lg font-bold text-ink">{workDaysCount}일</p>
        </Card>

        {isHourly ? (
          <>
            <Card>
              <p className="text-xs text-ink-soft mb-1">시급</p>
              <p className="text-lg font-bold text-ink">{employee?.hourlyWage?.toLocaleString()}원</p>
            </Card>
            <Card>
              <p className="text-xs text-ink-soft mb-1">이번 달 예상 급여</p>
              <p className="text-lg font-bold text-status-working">{grossPay?.toLocaleString()}원</p>
            </Card>
            <Card>
              <p className="text-xs text-ink-soft mb-1">실수령 예상금액</p>
              <p className="text-lg font-bold text-brand-red">{netPay?.toLocaleString()}원</p>
              {hasWithholding && <p className="text-[10px] text-ink-faint mt-0.5">3.3% 공제 후</p>}
            </Card>
          </>
        ) : (
          <Card>
            <p className="text-xs text-ink-soft mb-1">월급제</p>
            <p className="text-lg font-bold text-ink">{employee?.monthlySalary?.toLocaleString()}원</p>
          </Card>
        )}

        <Card>
          <p className="text-xs text-ink-soft mb-1">급여일</p>
          <p className="text-base font-bold text-ink mb-1.5">{employee?.payday ?? '미설정'}</p>
          <Badge tone={paydayBadgeTone}>{paydayBadgeText}</Badge>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card>
          <p className="text-xs text-ink-soft mb-1">누적 휴게</p>
          <p className="text-lg font-bold text-ink">{minutesToHourText(totalBreak)}</p>
        </Card>
        <Card>
          <p className="text-xs text-ink-soft mb-1">기록 누락</p>
          <p className="text-lg font-bold text-status-rejected">{missingDates.length}건</p>
        </Card>
      </div>

      {sortedRecords.length === 0 ? (
        <EmptyState icon="📋" title="이번 달 입력된 근로시간이 없습니다" />
      ) : (
        <div className="space-y-2">
          {sortedRecords.map((r) => (
            <Card
              key={r.id}
              className={`flex items-center justify-between ${isWorkingDate(r.date) ? 'cursor-pointer' : ''}`}
              onClick={() => {
                if (!isWorkingDate(r.date)) return;
                setSelectedDate(r.date);
                setSelectedRecord(r);
              }}
            >
              <div>
                <p className="font-semibold text-ink text-sm">
                  {formatMonthDay(r.date)} ({getWeekdayLabel(r.date)})
                </p>
              </div>
              <Badge tone="working">{minutesToCompactHourText(r.workedMinutes)}</Badge>
            </Card>
          ))}
        </div>
      )}

      {selectedDate && employeeId && (
        <WorkTimeEntryModal
          open
          onClose={() => setSelectedDate(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          employeeId={employeeId}
          date={selectedDate}
          existing={selectedRecord}
          scheduleShift={monthShifts.find((shift) => shift.date === selectedDate)}
          editedBy={session!.employeeId}
        />
      )}
    </div>
  );
}
