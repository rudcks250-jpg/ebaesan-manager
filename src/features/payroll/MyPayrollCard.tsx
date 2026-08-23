import { useEffect, useState } from 'react';
import { CalendarRange, Share2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { payrollService } from '@/services/payrollService';
import { PayrollShareModal } from '@/features/payroll/PayrollShareModal';
import { formatDate, parseDate } from '@/utils/date';
import type { EmployeePayrollDetails } from '@/services/payrollService';

type QuickRange = 'previousMonth' | 'currentMonth' | 'recentMonth';

function getQuickRange(type: QuickRange): { start: string; end: string } {
  const today = new Date();
  if (type === 'previousMonth') {
    return {
      start: formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      end: formatDate(new Date(today.getFullYear(), today.getMonth(), 0)),
    };
  }
  if (type === 'currentMonth') {
    return {
      start: formatDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: formatDate(today),
    };
  }
  const start = new Date(today);
  start.setMonth(start.getMonth() - 1);
  start.setDate(start.getDate() + 1);
  return { start: formatDate(start), end: formatDate(today) };
}

/**
 * 직원 본인의 '현재 진행 중인 급여기간' 현황 카드.
 * 직원관리에 설정된 본인 급여일을 기준으로 자동 계산되며,
 * 근로시간이 저장/수정되면 상위에서 refreshKey를 바꿔 즉시 재계산됩니다.
 */
export function MyPayrollCard({ employeeId, refreshKey = 0 }: { employeeId: string; refreshKey?: number }) {
  const { showToast } = useToast();
  const [payroll, setPayroll] = useState<Awaited<ReturnType<typeof payrollService.getCurrentPayroll>>>(undefined);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [sharePayroll, setSharePayroll] = useState<EmployeePayrollDetails>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    payrollService.getCurrentPayroll(employeeId).then(setPayroll);
  }, [employeeId, refreshKey]);

  if (!payroll) return null;

  const openPeriodSelector = () => {
    setStartDate(payroll.period.start);
    setEndDate(payroll.period.end);
    setPeriodOpen(true);
  };

  const applyQuickRange = (type: QuickRange) => {
    const range = getQuickRange(type);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const openPreview = async () => {
    if (!startDate || !endDate || parseDate(startDate) > parseDate(endDate)) {
      showToast('시작일과 종료일을 확인해주세요.', 'error');
      return;
    }
    setLoadingPreview(true);
    try {
      const result = await payrollService.getPayrollForPeriod(employeeId, startDate, endDate);
      if (!result) throw new Error('직원 정보를 찾을 수 없습니다.');
      setSharePayroll(result);
      setPeriodOpen(false);
    } catch (error) {
      console.error('[PayrollStatement] custom period load failed', error);
      showToast('선택한 기간의 급여명세서를 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <p className="font-bold text-ink">내 급여 현황</p>
        <span className="text-[11px] font-bold rounded-full px-2.5 py-1 bg-brand-red-light text-brand-red">
          {payroll.daysUntilPay === 0 ? '오늘 지급' : `D-${payroll.daysUntilPay}`}
        </span>
      </div>
      <p className="text-xs text-ink-faint mb-4 tabular-num">
        {payroll.period.start.replace(/-/g, '.')} ~ {payroll.period.end.replace(/-/g, '.')}
      </p>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-ink-soft">누적 근무시간</span>
          <span className="font-semibold text-ink tabular-num">
            {Math.floor(payroll.totalMinutes / 60)}시간 {payroll.totalMinutes % 60}분
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-soft">누적 근무일</span>
          <span className="font-semibold text-ink tabular-num">{payroll.totalDays}일</span>
        </div>
        <div className="flex justify-between border-t border-border pt-2">
          <span className="text-ink-soft">예상 세전 급여</span>
          <span className="font-semibold text-ink tabular-num">{payroll.gross.toLocaleString()}원</span>
        </div>
        {payrollService.isWithholdingApplicable(payroll.employee) && (
          <div className="flex justify-between">
            <span className="text-ink-soft">3.3% 공제</span>
            <span className="font-semibold text-status-rejected tabular-num">
              -{payroll.deduction.toLocaleString()}원
            </span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2">
          <span className="font-bold text-ink">예상 실수령액</span>
          <span className="font-bold text-brand-red tabular-num">{payroll.net.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-ink-soft text-xs">다음 급여 지급일</span>
          <span className="text-xs font-semibold text-ink tabular-num">
            {payroll.period.payDate.replace(/-/g, '.')}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={openPeriodSelector}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-4 py-3 text-sm font-bold text-white shadow-[0_6px_16px_-7px_rgba(0,122,255,.75)] press-scale"
      >
        <Share2 size={18} />
        급여명세서 공유
      </button>

      <Modal
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        title="급여명세서 기간 선택"
        footer={<Button fullWidth onClick={() => void openPreview()} disabled={loadingPreview}>{loadingPreview ? '불러오는 중...' : '급여명세서 미리보기'}</Button>}
      >
        <div className="space-y-5 pb-5">
          <p className="text-sm leading-6 text-ink-soft">공유할 근로내역의 시작일과 종료일을 선택해주세요. 기본값은 최근 급여기간입니다.</p>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => applyQuickRange('previousMonth')} className="min-h-11 rounded-xl bg-brand-beige-light px-2 text-sm font-bold text-ink press-scale">지난달</button>
            <button type="button" onClick={() => applyQuickRange('currentMonth')} className="min-h-11 rounded-xl bg-brand-beige-light px-2 text-sm font-bold text-ink press-scale">이번 달</button>
            <button type="button" onClick={() => applyQuickRange('recentMonth')} className="min-h-11 rounded-xl bg-brand-beige-light px-2 text-sm font-bold text-ink press-scale">최근 1개월</button>
          </div>
          <div className="rounded-2xl bg-[#F7F8FA] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><CalendarRange size={18} className="text-brand-red" />직접 기간 선택</div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <label className="min-w-0 text-xs font-semibold text-ink-soft">시작일<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-black/[0.06] bg-white px-2 text-sm font-bold text-ink" /></label>
              <span className="pb-3 text-ink-faint">~</span>
              <label className="min-w-0 text-xs font-semibold text-ink-soft">종료일<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-black/[0.06] bg-white px-2 text-sm font-bold text-ink" /></label>
            </div>
          </div>
          {startDate && endDate && (
            <p className="text-center text-sm font-bold tabular-nums text-brand-red">{startDate.replace(/-/g, '.')} ~ {endDate.replace(/-/g, '.')}</p>
          )}
        </div>
      </Modal>

      {sharePayroll && (
        <PayrollShareModal
          payroll={sharePayroll}
          isCustomPeriod={sharePayroll.period.start !== payroll.period.start || sharePayroll.period.end !== payroll.period.end}
          onClose={() => setSharePayroll(undefined)}
        />
      )}
    </Card>
  );
}
