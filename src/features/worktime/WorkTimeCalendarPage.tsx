import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { MonthNav } from '@/components/common/MonthNav';
import { useToast } from '@/components/common/Toast';
import { workTimeService } from '@/services/workTimeService';
import { WorkTimeEntryModal } from '@/features/worktime/WorkTimeEntryModal';
import { WorkTimeMonthCalendar } from '@/features/worktime/WorkTimeMonthCalendar';
import { MyPayrollCard } from '@/features/payroll/MyPayrollCard';
import { getMonthDates, todayStr } from '@/utils/date';
import { minutesToHourText } from '@/utils/time';
import { scheduleService } from '@/services/scheduleService';
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
  const [shifts, setShifts] = useState<Awaited<ReturnType<typeof scheduleService.getShiftsInRange>>>([]);

  useEffect(() => {
    Promise.all([
      workTimeService.listByEmployeeAndMonth(employeeId, year, month),
      scheduleService.getShiftsInRange(dates[0], dates[dates.length - 1]),
    ]).then(([nextRecords, allShifts]) => {
      setRecords(nextRecords);
      setShifts(allShifts.filter((shift) => shift.employeeId === employeeId));
    });
  }, [dates, employeeId, year, month, refreshKey]);

  const recordOf = (d: string) => records.find((r) => r.date === d);

  const totalMinutes = workTimeService.sumMinutes(records);
  const totalBreak = workTimeService.sumBreakMinutes(records);

  const todayRecord = recordOf(todayStr());
  const isClockedIn = !!todayRecord?.clockIn;
  const isClockedOut = !!todayRecord?.clockOut;
  const isScheduledToday = shifts.some(
    (shift) => shift.employeeId === employeeId && shift.date === todayStr() && shift.status === 'working'
  );


  const handleClockIn = async () => {
    if (!isScheduledToday) {
      showToast('오늘은 휴무입니다. 휴무일은 근무시간을 입력할 수 없습니다.', 'error');
      return;
    }
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

  return (
    <div className="space-y-4">
      <Card className="hero-surface flex items-center gap-4 border-0 ring-0">
        <div className="icon-well bg-white/10 text-[#67B0FF]"><Clock3 size={19} /></div>
        <div className="grow">
          <p className="text-xs text-white/55">오늘 근태</p>
          <p className="font-bold text-white text-lg">
            {!isScheduledToday && !isClockedIn
              ? '오늘은 휴무입니다'
              : isClockedOut
              ? `${todayRecord?.clockIn} ~ ${todayRecord?.clockOut} 완료`
              : isClockedIn
                ? `${todayRecord?.clockIn} 출근중`
                : '출근 전'}
          </p>
        </div>
        {!isClockedIn && isScheduledToday && (
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

      <WorkTimeMonthCalendar
        dates={dates}
        records={records}
        shifts={shifts}
        onSelectDate={setSelectedDate}
      />

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
