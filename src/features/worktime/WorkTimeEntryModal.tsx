import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
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
  const [breakMinutes, setBreakMinutes] = useState(String(existing?.breakMinutes ?? 30));
  const [memo, setMemo] = useState(existing?.memo ?? '');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<number | null>(existing?.workedMinutes ?? null);

  const handleSave = async () => {
    if (!clockIn || !clockOut) {
      setError('출근 시간과 퇴근 시간을 모두 입력해주세요.');
      return;
    }
    const result = await workTimeService.saveManualEntry(
      {
        employeeId,
        date,
        clockIn,
        clockOut,
        breakMinutes: Number(breakMinutes) || 0,
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
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${formatMonthDay(date)} (${getWeekdayLabel(date)}) 근로시간`}
      footer={
        <Button fullWidth onClick={handleSave}>
          저장
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="출근 시간" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />
        <Input label="퇴근 시간" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />
      </div>
      <Input
        label="휴게시간 (분)"
        type="number"
        value={breakMinutes}
        onChange={(e) => setBreakMinutes(e.target.value)}
      />
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
