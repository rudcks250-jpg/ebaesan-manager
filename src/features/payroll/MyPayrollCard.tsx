import { useEffect, useState } from 'react';
import { Share2 } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { payrollService } from '@/services/payrollService';
import { PayrollShareModal } from '@/features/payroll/PayrollShareModal';

/**
 * 직원 본인의 '현재 진행 중인 급여기간' 현황 카드.
 * 직원관리에 설정된 본인 급여일을 기준으로 자동 계산되며,
 * 근로시간이 저장/수정되면 상위에서 refreshKey를 바꿔 즉시 재계산됩니다.
 */
export function MyPayrollCard({ employeeId, refreshKey = 0 }: { employeeId: string; refreshKey?: number }) {
  const [payroll, setPayroll] = useState<Awaited<ReturnType<typeof payrollService.getCurrentPayroll>>>(undefined);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    payrollService.getCurrentPayroll(employeeId).then(setPayroll);
  }, [employeeId, refreshKey]);

  if (!payroll) return null;

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
        onClick={() => setShareOpen(true)}
        className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red px-4 py-3 text-sm font-bold text-white shadow-[0_6px_16px_-7px_rgba(0,122,255,.75)] press-scale"
      >
        <Share2 size={18} />
        급여명세서 공유
      </button>

      {shareOpen && <PayrollShareModal payroll={payroll} onClose={() => setShareOpen(false)} />}
    </Card>
  );
}
