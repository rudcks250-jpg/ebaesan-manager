import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Textarea } from '@/components/common/Input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { leaveService } from '@/services/leaveService';
import { employeeService } from '@/services/employeeService';
import {
  activeMonthlyRequest,
  isMonthlyLeaveEligible,
  monthsOfYear,
} from '@/features/leave/monthlyLeave';
import { formatMonthDay, getWeekdayLabel, formatDateTimeKo } from '@/utils/date';
import type { LeaveRequest, LeaveStatus } from '@/data/types';
import { CalendarCheck2, CalendarRange, CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

export function LeaveApprovalPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<LeaveStatus | 'all'>('pending');
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [overwriteConfirm, setOverwriteConfirm] = useState<LeaveRequest | null>(null);

  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof employeeService.list>>>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);

  useEffect(() => {
    employeeService.list().then(setEmployees);
    leaveService.listAll().then(setRequests);
  }, [refreshKey]);

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const monthlyEmployees = employees.filter(isMonthlyLeaveEligible);
  const monthlyHistory = useMemo(() => monthsOfYear(new Date().getFullYear()), []);

  const nameOf = (employeeId: string) => employees.find((e) => e.id === employeeId)?.name ?? '알수없음';

  const doApprove = async (request: LeaveRequest) => {
    await leaveService.approve(request.id, session!.employeeId);
    showToast(request.leaveType === 'monthly' ? '월차 신청을 승인했습니다.' : '휴무 신청을 승인했습니다.');
    setRefreshKey((k) => k + 1);
  };

  const handleApproveClick = async (request: LeaveRequest) => {
    if (await leaveService.hasExistingWorkShift(request.requestedDate, request.employeeId)) {
      setOverwriteConfirm(request);
      return;
    }
    await doApprove(request);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    await leaveService.reject(rejectTarget.id, session!.employeeId, rejectReason.trim());
    showToast('휴무 신청을 반려했습니다.');
    setRejectTarget(null);
    setRejectReason('');
    setRefreshKey((k) => k + 1);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard icon={Clock3} label="승인 대기" value={`${requests.filter((r) => r.status === 'pending').length}건`} tone="orange" />
        <StatCard icon={CheckCircle2} label="승인 완료" value={`${requests.filter((r) => r.status === 'approved').length}건`} tone="green" />
        <StatCard icon={XCircle} label="반려" value={`${requests.filter((r) => r.status === 'rejected').length}건`} tone="red" />
      </div>
      <Card className="mb-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange size={19} className="text-status-working" />
          <div>
            <p className="font-bold text-ink">월차 관리</p>
            <p className="text-xs text-ink-soft">{new Date().getFullYear()}년 직원별 사용 현황</p>
          </div>
        </div>
        <div className="space-y-4">
          {monthlyEmployees.map((employee) => (
            <div key={employee.id} className="rounded-2xl border border-black/[0.05] p-3">
              <p className="mb-2 text-sm font-bold text-ink">{employee.name}</p>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                {monthlyHistory.map((yearMonth) => {
                  const request = activeMonthlyRequest(
                    requests.filter((item) => item.employeeId === employee.id),
                    yearMonth
                  );
                  return (
                    <div key={yearMonth} className="rounded-xl bg-brand-beige-light px-1.5 py-2 text-center">
                      <p className="text-[10px] font-semibold text-ink-soft">{yearMonth}</p>
                      <p className={`mt-0.5 text-[10px] font-bold ${
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
            </div>
          ))}
        </div>
      </Card>
      <div className="glass-surface rounded-2xl p-2 flex gap-2 mb-5 overflow-x-auto scrollbar-thin">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              filter === f ? 'bg-brand-red text-white shadow-[0_6px_16px_-9px_rgba(0,122,255,.8)]' : 'text-ink-soft hover:bg-white'
            }`}
          >
            {f === 'pending' ? '대기' : f === 'approved' ? '승인' : f === 'rejected' ? '반려' : '전체'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="✅" title="해당 조건의 휴무 신청이 없습니다" />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {filtered.map((r) => (
            <Card key={r.id} hover>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3"><div className="icon-well bg-brand-red-light text-brand-red"><CalendarCheck2 size={18} /></div><p className="font-bold text-ink">{nameOf(r.employeeId)}</p></div>
                <LeaveStatusBadge status={r.status} />
              </div>
              <span className={`mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold ${
                r.leaveType === 'monthly'
                  ? 'bg-status-working-bg text-status-working'
                  : 'bg-brand-beige-light text-ink-soft'
              }`}>
                {r.leaveType === 'monthly' ? '월차' : '휴무'}
              </span>
              <p className="text-sm text-ink-soft mb-1">
                {formatMonthDay(r.requestedDate)} ({getWeekdayLabel(r.requestedDate)}) 신청
              </p>
              <p className="text-sm text-ink mb-2">{r.reason}</p>
              <p className="text-[11px] text-ink-faint mb-3">신청일 {formatDateTimeKo(r.createdAt)}</p>
              {r.status === 'rejected' && r.rejectReason && (
                <p className="text-xs text-status-rejected bg-status-rejected-bg rounded-control px-2 py-1.5 mb-3">
                  반려 사유: {r.rejectReason}
                </p>
              )}
              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" fullWidth onClick={() => handleApproveClick(r)}>
                    승인
                  </Button>
                  <Button size="sm" fullWidth variant="danger" onClick={() => setRejectTarget(r)}>
                    반려
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="반려 사유 입력"
        footer={
          <Button fullWidth variant="danger" onClick={handleReject} disabled={!rejectReason.trim()}>
            반려하기
          </Button>
        }
      >
        <Textarea
          label="반려 사유"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="직원에게 표시될 반려 사유를 입력해주세요"
        />
      </Modal>

      <ConfirmDialog
        open={!!overwriteConfirm}
        title="기존 근무 스케줄이 있습니다"
        description="해당 날짜에 이미 근무가 입력되어 있습니다. 승인하면 휴무로 변경됩니다. 계속할까요?"
        confirmLabel="휴무로 변경하고 승인"
        onConfirm={() => overwriteConfirm && doApprove(overwriteConfirm)}
        onClose={() => setOverwriteConfirm(null)}
      />
    </div>
  );
}
