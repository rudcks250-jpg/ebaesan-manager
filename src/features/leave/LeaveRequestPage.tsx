import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Select, Textarea } from '@/components/common/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge';
import { useToast } from '@/components/common/Toast';
import { leaveService } from '@/services/leaveService';
import { employeeService } from '@/services/employeeService';
import {
  activeMonthlyRequest,
  isMonthlyLeaveEligible,
  leaveMonth,
  monthsOfYear,
} from '@/features/leave/monthlyLeave';
import { getMondayOfWeekStr, getWeekDates, addWeeks, parseDate, formatDate, formatMonthDay, getWeekdayLabel, formatDateTimeKo } from '@/utils/date';
import { CalendarPlus, CalendarRange, History } from 'lucide-react';
import type { Employee, LeaveType } from '@/data/types';

export function LeaveRequestPage({ employeeId }: { employeeId: string }) {
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('regular');
  const [error, setError] = useState('');
  const [employee, setEmployee] = useState<Employee>();

  const nextWeekDates = useMemo(() => {
    const thisMonday = getMondayOfWeekStr(formatDate(new Date()));
    const nextMonday = formatDate(addWeeks(parseDate(thisMonday), 1));
    return getWeekDates(nextMonday);
  }, []);

  const [myRequests, setMyRequests] = useState<Awaited<ReturnType<typeof leaveService.listByEmployee>>>([]);

  useEffect(() => {
    leaveService.listByEmployee(employeeId).then(setMyRequests);
    employeeService.get(employeeId).then(setEmployee);
  }, [employeeId, refreshKey]);

  const monthlyEligible = isMonthlyLeaveEligible(employee);
  const selectedMonth = leaveMonth(selectedDate || formatDate(new Date()));
  const selectedMonthlyRequest = activeMonthlyRequest(myRequests, selectedMonth);
  const currentMonth = formatDate(new Date()).slice(0, 7);
  const currentMonthlyRequest = activeMonthlyRequest(myRequests, currentMonth);
  const historyMonths = monthsOfYear(new Date().getFullYear());

  const handleSubmit = async () => {
    if (!selectedDate) {
      setError('신청할 날짜를 선택해주세요.');
      return;
    }
    const result = await leaveService.create({
      employeeId: employeeId,
      requestedDate: selectedDate,
      reason,
      leaveType,
    });
    if (!result.success) {
      setError(result.errorMessage);
      return;
    }
    showToast(leaveType === 'monthly' ? '월차 신청이 접수되었습니다.' : '휴무 신청이 접수되었습니다.');
    setSelectedDate('');
    setReason('');
    setError('');
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="grid lg:grid-cols-[1fr_.9fr] gap-5 items-start">
      <Card className="lg:sticky lg:top-6">
        <div className="icon-well bg-brand-red-light text-brand-red mb-5"><CalendarPlus size={19} /></div>
        <p className="text-xl font-bold tracking-tight text-ink mb-1">다음 주 휴무 신청</p>
        <p className="text-xs text-ink-soft mb-4">이번 주는 신청할 수 없으며, 다음 주 날짜만 신청 가능합니다.</p>
        {monthlyEligible && (
          <fieldset className="mb-4">
            <legend className="mb-2 text-xs font-semibold text-ink-soft">신청 종류</legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['regular', '일반 휴무'],
                ['monthly', '월차'],
              ] as const).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-sm font-bold ${
                    leaveType === value
                      ? 'border-brand-red bg-brand-red-light text-brand-red'
                      : 'border-border bg-white text-ink-soft'
                  }`}
                >
                  <input
                    type="radio"
                    name="leaveType"
                    value={value}
                    checked={leaveType === value}
                    onChange={() => {
                      setLeaveType(value);
                      setError('');
                    }}
                    className="accent-brand-red"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <Select
          label="희망 날짜"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        >
          <option value="">날짜를 선택하세요</option>
          {nextWeekDates.map((d) => (
            <option key={d} value={d}>
              {getWeekdayLabel(d)}요일 · {formatMonthDay(d)}
            </option>
          ))}
        </Select>
        {leaveType === 'monthly' && (
          <div className={`mb-4 rounded-2xl px-4 py-3 ${
            selectedMonthlyRequest ? 'bg-status-rejected-bg' : 'bg-status-working-bg'
          }`}>
            <p className={`text-sm font-bold ${
              selectedMonthlyRequest ? 'text-status-rejected' : 'text-status-working'
            }`}>
              {selectedMonth.replace('-', '년 ')}월 월차 사용
            </p>
            <p className="mt-1 text-xs text-ink-soft">
              {selectedMonthlyRequest
                ? '해당 월의 월차를 이미 신청하거나 사용했습니다.'
                : '해당 월에 사용할 수 있는 월차가 1개 남아 있습니다.'}
            </p>
          </div>
        )}
        <Textarea
          label="휴무 사유"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유를 입력해주세요"
        />
        {error && <p className="text-xs text-status-rejected -mt-2 mb-3">{error}</p>}
        <Button
          fullWidth
          onClick={handleSubmit}
          disabled={leaveType === 'monthly' && !!selectedMonthlyRequest}
        >
          신청하기
        </Button>
      </Card>

      <div>
        {monthlyEligible && (
          <Card className="mb-5">
            <div className="mb-4 flex items-center gap-2">
              <CalendarRange size={18} className="text-status-working" />
              <p className="font-bold text-ink">내 월차</p>
            </div>
            <div className={`mb-4 rounded-2xl p-4 ${
              currentMonthlyRequest ? 'bg-brand-beige-light' : 'bg-status-working-bg'
            }`}>
              <p className="text-xs font-medium text-ink-soft">현재 월 · {Number(currentMonth.slice(5))}월</p>
              <p className={`mt-1 text-2xl font-bold ${
                currentMonthlyRequest ? 'text-ink' : 'text-status-working'
              }`}>
                {currentMonthlyRequest ? '사용 완료' : '남은 월차 1 / 1'}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {historyMonths.map((yearMonth) => {
                const request = activeMonthlyRequest(myRequests, yearMonth);
                return (
                  <div key={yearMonth} className="rounded-xl bg-brand-beige-light px-2 py-2 text-center">
                    <p className="text-[11px] font-semibold text-ink-soft">{yearMonth}</p>
                    <p className={`mt-0.5 text-[11px] font-bold ${
                      request?.status === 'approved'
                        ? 'text-status-working'
                        : request?.status === 'pending'
                          ? 'text-status-pending'
                          : 'text-ink-faint'
                    }`}>
                      {request?.status === 'approved'
                        ? '✅ 사용'
                        : request?.status === 'pending'
                          ? '⏳ 대기'
                          : '❌ 미사용'}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
        <div className="flex items-center gap-2 mb-3 px-1"><History size={17} className="text-brand-red" /><p className="font-bold text-ink">신청 내역</p></div>
        {myRequests.length === 0 ? (
          <EmptyState icon="🗓" title="신청한 휴무가 없습니다" />
        ) : (
          <div className="space-y-2">
            {myRequests.map((r) => (
              <Card key={r.id} padded={false} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <span className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      r.leaveType === 'monthly'
                        ? 'bg-status-working-bg text-status-working'
                        : 'bg-brand-beige-light text-ink-soft'
                    }`}>
                      {r.leaveType === 'monthly' ? '월차' : '휴무'}
                    </span>
                    <p className="font-semibold text-ink">
                      {formatMonthDay(r.requestedDate)} ({getWeekdayLabel(r.requestedDate)})
                    </p>
                  </div>
                  <LeaveStatusBadge status={r.status} />
                </div>
                <p className="text-sm text-ink-soft">{r.reason}</p>
                {r.status === 'rejected' && r.rejectReason && (
                  <p className="text-xs text-status-rejected bg-status-rejected-bg rounded-control px-2 py-1.5 mt-2">
                    반려 사유: {r.rejectReason}
                  </p>
                )}
                <p className="text-[11px] text-ink-faint mt-2">신청일 {formatDateTimeKo(r.createdAt)}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
