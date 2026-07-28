import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { MonthNav } from '@/components/common/MonthNav';
import { useToast } from '@/components/common/Toast';
import { workTimeService } from '@/services/workTimeService';
import { WorkTimeEntryModal } from '@/features/worktime/WorkTimeEntryModal';
import { MyPayrollCard } from '@/features/payroll/MyPayrollCard';
import { getMonthDates, todayStr, parseDate, WEEKDAY_LABELS_KO } from '@/utils/date';
import { minutesToCompactHourText, minutesToHourText } from '@/utils/time';
import { Clock3, Coffee, Timer } from 'lucide-react';

export function WorkTimeCalendarPage({ employeeId }: { employeeId: string }) {
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1~12
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dates = useMemo(() => getMonthDates(year, month), [year, month]);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof workTimeService.listByEmployeeAndMonth>>>([]);

  useEffect(() => {
    workTimeService.listByEmployeeAndMonth(employeeId, year, month).then(setRecords);
  }, [employeeId, year, month, refreshKey]);

  const recordOf = (d: string) => records.find((r) => r.date === d);

  const totalMinutes = workTimeService.sumMinutes(records);
  const totalBreak = workTimeService.sumBreakMinutes(records);

  const todayRecord = recordOf(todayStr());
  const isClockedIn = !!todayRecord?.clockIn;
  const isClockedOut = !!todayRecord?.clockOut;


  const handleClockIn = async () => {
    await workTimeService.clockIn(employeeId);
    showToast('출근 처리되었습니다.');
    setRefreshKey((k) => k + 1);
  };

  const handleClockOut = async () => {
    const result = await workTimeService.clockOut(employeeId);
    if (!result.success) {
      showToast(result.errorMessage, 'error');
      return;
    }
    showToast('퇴근 처리되었습니다.');
    setRefreshKey((k) => k + 1);
  };

  // 달력 정렬을 위한 앞쪽 빈칸 수 (월요일 시작)
  const firstDay = parseDate(dates[0]).getDay();
  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;

  return (
    <div className="space-y-4">
      <Card className="hero-surface flex items-center gap-4 border-0 ring-0">
        <div className="icon-well bg-white/10 text-[#67B0FF]"><Clock3 size={19} /></div>
        <div className="grow">
          <p className="text-xs text-white/55">오늘 근태</p>
          <p className="font-bold text-white text-lg">
            {isClockedOut
              ? `${todayRecord?.clockIn} ~ ${todayRecord?.clockOut} 완료`
              : isClockedIn
                ? `${todayRecord?.clockIn} 출근중`
                : '출근 전'}
          </p>
        </div>
        {!isClockedIn && (
          <Button onClick={handleClockIn} size="sm">
            출근하기
          </Button>
        )}
        {isClockedIn && !isClockedOut && (
          <Button onClick={handleClockOut} size="sm" variant="danger">
            퇴근하기
          </Button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card hover>
          <Timer size={18} className="text-brand-red mb-4" />
          <p className="text-xs text-ink-soft mb-1">이번 달 누적 근무</p>
          <p className="text-xl font-bold text-ink">{minutesToHourText(totalMinutes)}</p>
        </Card>
        <Card hover>
          <Coffee size={18} className="text-status-pending mb-4" />
          <p className="text-xs text-ink-soft mb-1">이번 달 누적 휴게</p>
          <p className="text-xl font-bold text-ink">{minutesToHourText(totalBreak)}</p>
        </Card>
      </div>

      {/* 본인 급여일 기준 현재 급여기간 현황 */}
      <MyPayrollCard employeeId={employeeId} refreshKey={refreshKey} />

      <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

      <Card padded={false} className="p-3 sm:p-5">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAY_LABELS_KO.map((w) => (
            <div key={w} className="text-center text-xs text-ink-faint font-medium py-1">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {dates.map((d) => {
            const record = recordOf(d);
            const dayNum = Number(d.slice(-2));
            const hasEntry = record?.workedMinutes !== null && record?.workedMinutes !== undefined;
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`aspect-square rounded-control flex flex-col items-center justify-center text-xs gap-0.5 ${
                  d === todayStr() ? 'ring-2 ring-brand-red' : ''
                } ${hasEntry ? 'bg-status-working-bg' : 'bg-brand-beige-light'}`}
              >
                <span className="font-semibold text-ink">{dayNum}</span>
                {hasEntry ? (
                  <span className="text-[9px] font-semibold text-status-working">
                    {minutesToCompactHourText(record?.workedMinutes)}
                  </span>
                ) : (
                  <span className="text-[9px] text-ink-faint">미입력</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDate && (
        <WorkTimeEntryModal
          open
          onClose={() => setSelectedDate(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          employeeId={employeeId}
          date={selectedDate}
          existing={recordOf(selectedDate)}
          editedBy={employeeId}
        />
      )}
    </div>
  );
}
