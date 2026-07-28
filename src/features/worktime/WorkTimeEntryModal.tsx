import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Input';
import { ScheduleTimeSelector } from '@/features/schedule/ScheduleTimeSelector';
import { workTimeService } from '@/services/workTimeService';
import { useToast } from '@/components/common/Toast';
import { formatMonthDay, getWeekdayLabel } from '@/utils/date';
import { minutesToHourText } from '@/utils/time';
import type { WorkTimeRecord } from '@/data/types';

interface WorkTimeEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employeeId: string;
  date: string;
  existing?: WorkTimeRecord;
  editedBy: string;
}

export function WorkTimeEntryModal({
  open,
  onClose,
  onSaved,
  employeeId,
  date,
  existing,
  editedBy,
}: WorkTimeEntryModalProps) {
  const { showToast } = useToast();
  const [clockIn, setClockIn] = useState(existing?.clockIn ?? '');
  const [clockOut, setClockOut] = useState(existing?.clockOut ?? '');
  const [memo, setMemo] = useState(existing?.memo ?? '');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<number | null>(existing?.workedMinutes ?? null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (saving) return;
    if (!clockIn || !clockOut) {
      setError('출근 시간과 퇴근 시간을 모두 입력해주세요.');
      return;
    }
    if (clockOut <= clockIn) {
      setError('퇴근시간은 출근시간보다 늦어야 합니다.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await workTimeService.saveManualEntry(
        {
          employeeId,
          date,
          clockIn,
          clockOut,
          breakMinutes: existing?.breakMinutes ?? 0,
          memo: memo.trim() || undefined,
        },
        editedBy
      );
      if (!result.success) {
        setError(result.errorMessage);
        return;
      }
      setPreview(result.record.workedMinutes);
      showToast('근로시간이 저장되었습니다.');
      onSaved();
      onClose();
    } catch {
      setError('근로시간을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${formatMonthDay(date)} (${getWeekdayLabel(date)}) 근로시간`}
      footer={
        <Button fullWidth onClick={handleSave} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-2xl bg-status-working-bg px-4 py-3">
          <p className="text-xs font-semibold text-status-working">출근</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-ink">{clockIn || '선택'}</p>
        </div>
        <div className="rounded-2xl bg-status-pending-bg px-4 py-3">
          <p className="text-xs font-semibold text-status-pending">퇴근</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-ink">{clockOut || '선택'}</p>
        </div>
      </div>
      <ScheduleTimeSelector
        status="working"
        startTime={clockIn}
        endTime={clockOut}
        onStatusChange={() => {}}
        onStartTimeChange={(time) => {
          setClockIn(time);
          setError('');
        }}
        onEndTimeChange={(time) => {
          setClockOut(time);
          setError('');
        }}
        showStatus={false}
      />
      <div className="mt-4" />
      <Textarea label="메모 (선택)" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="특이사항이 있다면 입력해주세요" />
      {error && <p className="text-xs text-status-rejected -mt-2 mb-3">{error}</p>}
      {preview !== null && !error && (
        <p className="text-sm text-ink-soft mb-3">
          실제 근무시간: <span className="font-semibold text-ink">{minutesToHourText(preview)}</span>
        </p>
      )}
      {existing && existing.editHistory.length > 0 && (
        <p className="text-[11px] text-ink-faint mb-4">수정 이력 {existing.editHistory.length}건</p>
      )}
    </Modal>
  );
}
