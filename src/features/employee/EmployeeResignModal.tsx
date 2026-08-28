import { useEffect, useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { employeeService } from '@/services/employeeService';
import { formatDate } from '@/utils/date';
import type { Employee, ShiftEntry } from '@/data/types';

export function EmployeeResignModal({
  employee,
  onClose,
  onCompleted,
}: {
  employee: Employee;
  onClose: () => void;
  onCompleted: (deletedScheduleCount: number) => void;
}) {
  const [resignDate, setResignDate] = useState(() => formatDate(new Date()));
  const [memo, setMemo] = useState('');
  const [futureSchedules, setFutureSchedules] = useState<ShiftEntry[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingSchedules(true);
    setConfirmed(false);
    employeeService.previewFutureSchedules(employee.id, resignDate)
      .then((items) => {
        if (!cancelled) setFutureSchedules(items);
      })
      .catch(() => {
        if (!cancelled) setError('미래 스케줄을 확인하지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoadingSchedules(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employee.id, resignDate]);

  const submit = async () => {
    if (!resignDate || !confirmed || saving) return;
    setSaving(true);
    setError('');
    try {
      const deletedCount = await employeeService.resign(employee.id, resignDate, memo);
      onCompleted(deletedCount);
    } catch (submitError) {
      console.error('[Employee resignation failed]', submitError);
      setError(submitError instanceof Error ? submitError.message : '퇴사 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={`${employee.name} 퇴사 처리`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth disabled={saving} onClick={onClose}>취소</Button>
          <Button variant="danger" fullWidth disabled={saving || loadingSchedules || !confirmed} onClick={() => void submit()}>
            {saving ? '처리 중...' : '퇴사 처리'}
          </Button>
        </div>
      }
    >
      <Input label="퇴사일" type="date" value={resignDate} onChange={(event) => setResignDate(event.target.value)} />
      <Textarea label="퇴사 사유 또는 메모 (선택)" rows={3} value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="퇴사 사유나 인수인계 메모" />

      <section className="mb-4 rounded-2xl bg-brand-beige-light p-4">
        <p className="text-sm font-bold text-ink">정리될 미래 스케줄</p>
        {loadingSchedules ? (
          <p className="mt-2 text-xs text-ink-faint">확인 중...</p>
        ) : futureSchedules.length === 0 ? (
          <p className="mt-2 text-xs text-ink-soft">퇴사일 이후에 배정된 스케줄이 없습니다.</p>
        ) : (
          <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
            {futureSchedules.map((shift) => (
              <div key={shift.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-ink">{shift.date}</span>
                <span className="text-ink-soft">
                  {shift.status === 'working' && shift.startTime && shift.endTime
                    ? `${shift.startTime.slice(0, 5)} ~ ${shift.endTime.slice(0, 5)}`
                    : '휴무'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mb-4 rounded-2xl bg-status-rejected-bg p-4 text-xs leading-relaxed text-ink-soft">
        퇴사 처리 후 해당 직원은 로그인, 스케줄 배정, 근로시간 입력, 휴무/월차 신청, 직원할인 사용이 제한됩니다. 기존 기록은 삭제되지 않습니다.
      </div>
      <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3 text-sm font-semibold text-ink">
        <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-red" />
        <span>위 내용과 퇴사일 이후 스케줄 정리를 확인했습니다.</span>
      </label>
      {error && <p className="mb-4 text-xs font-semibold text-status-rejected">{error}</p>}
    </Modal>
  );
}
