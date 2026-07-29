import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { MonthNav } from '@/components/common/MonthNav';
import { workTimeService } from '@/services/workTimeService';
import { WorkTimeEntryModal } from '@/features/worktime/WorkTimeEntryModal';
import { WorkTimeMonthCalendar } from '@/features/worktime/WorkTimeMonthCalendar';
import { MyPayrollCard } from '@/features/payroll/MyPayrollCard';
import { getMonthDates } from '@/utils/date';
import { minutesToHourText } from '@/utils/time';
import { scheduleService } from '@/services/scheduleService';
import { Coffee, Timer } from 'lucide-react';

export function WorkTimeCalendarPage({ employeeId }: { employeeId: string }) {
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

  return (
    <div className="space-y-4">
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
          scheduleShift={shifts.find((shift) => shift.date === selectedDate)}
          editedBy={employeeId}
        />
      )}
    </div>
  );
}
