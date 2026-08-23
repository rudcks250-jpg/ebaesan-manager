import { useMemo, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { minutesToCompactHourText } from '@/utils/time';
import { downloadPayrollStatement } from '@/features/payroll/payrollStatementImage';
import type { EmployeePayrollDetails } from '@/services/payrollService';

function formatClock(value: string | null | undefined): string {
  const match = value?.match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '-';
}

function formatDate(value: string): string {
  return value.replace(/-/g, '.');
}

export function PayrollShareModal({
  payroll,
  onClose,
  isCustomPeriod = false,
}: {
  payroll: EmployeePayrollDetails;
  onClose: () => void;
  isCustomPeriod?: boolean;
}) {
  const { showToast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const records = useMemo(
    () => payroll.records
      .filter((record) => record.workedMinutes !== null)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [payroll.records],
  );
  const statementMonth = payroll.period.end.slice(0, 7);
  const filename = `이배산_급여명세서_${payroll.employee.name}_${statementMonth}.png`;
  const wageLabel = payroll.employee.wageType === 'hourly'
    ? `시급 ${(payroll.employee.hourlyWage ?? 0).toLocaleString()}원`
    : `월급 ${payroll.gross.toLocaleString()}원`;

  const handleDownload = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await downloadPayrollStatement(reportRef.current, filename);
      showToast('급여명세서 이미지가 저장되었습니다.');
    } catch (error) {
      console.error('[PayrollStatement] image download failed', error);
      showToast('급여명세서 이미지 생성에 실패했습니다.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#F2F4F6]">
      <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 sm:px-6">
        <div>
          <p className="font-bold text-ink">급여명세서 미리보기</p>
          <p className="mt-0.5 text-xs text-ink-faint">보고서 영역만 이미지로 저장됩니다.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="닫기" className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-beige-light text-ink-soft press-scale">
          <X size={20} />
        </button>
      </div>

      <div className="grow overflow-y-auto p-3 sm:p-8">
        <div
          ref={reportRef}
          data-payroll-statement-report
          className="mx-auto w-full max-w-[760px] overflow-hidden rounded-[24px] bg-white text-ink shadow-sm"
        >
          <header className="border-b border-black/[0.07] px-5 py-7 sm:px-10 sm:py-10">
            <p className="text-sm font-extrabold tracking-wide text-brand-red">이배산 숯불구이</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">급여 근무내역 확인서</h2>
            <div className="mt-7 grid gap-4 rounded-2xl bg-[#F7F8FA] p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-ink-faint">직원명</p>
                <p className="mt-1 text-xl font-extrabold">{payroll.employee.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-ink-faint">급여기간</p>
                <p className="mt-1 font-bold tabular-nums">{formatDate(payroll.period.start)} ~ {formatDate(payroll.period.end)}</p>
              </div>
            </div>
          </header>

          <section className="px-5 py-7 sm:px-10 sm:py-9">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-status-working-bg p-4 sm:p-5">
                <p className="text-xs font-bold text-status-working">총 근로일수</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums">{records.length}일</p>
              </div>
              <div className="rounded-2xl bg-brand-red-light p-4 sm:p-5">
                <p className="text-xs font-bold text-brand-red">총 근로시간</p>
                <p className="mt-2 text-3xl font-extrabold tabular-nums">{minutesToCompactHourText(payroll.totalMinutes)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-black/[0.07] p-5">
              {payroll.employee.wageType === 'monthly' && isCustomPeriod && (
                <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
                  기본 급여기간과 다른 기간을 선택하여 월급 금액은 예상 급여로 표시됩니다.
                </p>
              )}
              <div className="grid gap-3 text-sm sm:grid-cols-2 sm:gap-x-8">
                <div className="flex justify-between gap-3"><span className="text-ink-soft">급여형태</span><strong>{payroll.employee.wageType === 'hourly' ? '시급제' : '월급제'}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-ink-soft">시급 또는 월급</span><strong>{wageLabel.replace(/^(시급|월급) /, '')}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-ink-soft">세전 급여</span><strong>{payroll.gross.toLocaleString()}원</strong></div>
                <div className="flex justify-between gap-3"><span className="text-ink-soft">공제금액</span><strong className="text-status-rejected">-{payroll.deduction.toLocaleString()}원</strong></div>
              </div>
              <div className="mt-5 flex items-end justify-between gap-4 border-t border-black/[0.07] pt-5">
                <span className="font-bold">최종 예상 지급액</span>
                <strong className="text-3xl font-extrabold tracking-tight text-brand-red tabular-nums">{payroll.net.toLocaleString()}원</strong>
              </div>
            </div>
          </section>

          <section className="border-t border-black/[0.07] px-5 py-7 sm:px-10 sm:py-9">
            <div className="mb-4 flex items-end justify-between">
              <h3 className="text-lg font-extrabold">일자별 실제 근무내역</h3>
              <span className="text-xs font-semibold text-ink-faint">근로시간 입력 기준</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/[0.07]">
              <div className="grid grid-cols-[1.15fr_1.7fr_0.8fr] bg-[#F7F8FA] px-3 py-3 text-center text-xs font-bold text-ink-faint sm:px-5">
                <span className="text-left">날짜</span><span>출근 ~ 퇴근</span><span className="text-right">근로시간</span>
              </div>
              {records.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-ink-faint">선택한 기간에 근무내역이 없습니다.</p>
              ) : records.map((record) => (
                <div key={record.id} className="grid grid-cols-[1.15fr_1.7fr_0.8fr] items-center border-t border-black/[0.06] px-3 py-3.5 text-sm sm:px-5">
                  <strong className="tabular-nums">{formatDate(record.date)}</strong>
                  <span className="text-center font-semibold tabular-nums text-ink-soft">{formatClock(record.clockIn)} ~ {formatClock(record.clockOut)}</span>
                  <strong className="text-right tabular-nums">{minutesToCompactHourText(record.workedMinutes)}</strong>
                </div>
              ))}
              <div className="border-t-2 border-black/[0.1] bg-[#FCFCFD] px-4 py-4 sm:px-5">
                <div className="flex justify-between gap-4 font-extrabold"><span>총 근로일수</span><span>{records.length}일</span></div>
                <div className="mt-2 flex justify-between gap-4 font-extrabold"><span>총 근로시간</span><span>{minutesToCompactHourText(payroll.totalMinutes)}</span></div>
              </div>
            </div>
          </section>

          <footer className="border-t border-black/[0.07] bg-[#FAFAFB] px-5 py-6 text-center sm:px-10">
            <p className="text-sm font-bold">위 근무내역과 예상 급여를 확인해주세요.</p>
            <p className="mt-1 text-xs leading-5 text-ink-faint">실제 근무내용과 다를 경우 관리자에게 알려주세요.</p>
          </footer>
        </div>
      </div>

      <div className="shrink-0 border-t border-black/[0.07] bg-white p-4 sm:mx-auto sm:w-full sm:max-w-[760px] sm:rounded-t-3xl sm:px-6">
        <button type="button" onClick={handleDownload} disabled={exporting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red text-sm font-bold text-white press-scale disabled:opacity-50">
          <Download size={18} /> {exporting ? '생성 중...' : '이미지 저장'}
        </button>
      </div>
    </div>
  );
}
