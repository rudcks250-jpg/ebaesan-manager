import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Select, Textarea } from '@/components/common/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge';
import { useToast } from '@/components/common/Toast';
import { leaveService } from '@/services/leaveService';
import { getMondayOfWeekStr, getWeekDates, addWeeks, parseDate, formatDate, formatMonthDay, getWeekdayLabel, formatDateTimeKo } from '@/utils/date';
import { CalendarPlus, History } from 'lucide-react';

export function LeaveRequestPage({ employeeId }: { employeeId: string }) {
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const nextWeekDates = useMemo(() => {
    const thisMonday = getMondayOfWeekStr(formatDate(new Date()));
    const nextMonday = formatDate(addWeeks(parseDate(thisMonday), 1));
    return getWeekDates(nextMonday);
  }, []);

  const [myRequests, setMyRequests] = useState<Awaited<ReturnType<typeof leaveService.listByEmployee>>>([]);

  useEffect(() => {
    leaveService.listByEmployee(employeeId).then(setMyRequests);
  }, [employeeId, refreshKey]);

  const handleSubmit = async () => {
    if (!selectedDate) {
      setError('신청할 날짜를 선택해주세요.');
      return;
    }
    const result = await leaveService.create({
      employeeId: employeeId,
      requestedDate: selectedDate,
      reason,
    });
    if (!result.success) {
      setError(result.errorMessage);
      return;
    }
    showToast('휴무 신청이 접수되었습니다.');
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
        <Textarea
          label="휴무 사유"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="사유를 입력해주세요"
        />
        {error && <p className="text-xs text-status-rejected -mt-2 mb-3">{error}</p>}
        <Button fullWidth onClick={handleSubmit}>
          신청하기
        </Button>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-3 px-1"><History size={17} className="text-brand-red" /><p className="font-bold text-ink">신청 내역</p></div>
        {myRequests.length === 0 ? (
          <EmptyState icon="🗓" title="신청한 휴무가 없습니다" />
        ) : (
          <div className="space-y-2">
            {myRequests.map((r) => (
              <Card key={r.id} padded={false} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-semibold text-ink">
                    {formatMonthDay(r.requestedDate)} ({getWeekdayLabel(r.requestedDate)})
                  </p>
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
