import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { scheduleService } from '@/services/scheduleService';
import { useToast } from '@/components/common/Toast';
import { formatMonthDay, getWeekdayLabel } from '@/utils/date';
import type { Employee, ShiftEntry } from '@/data/types';
import {
  SCHEDULE_END_TIMES,
  SCHEDULE_START_TIMES,
  ScheduleTimeSelector,
} from '@/features/schedule/ScheduleTimeSelector';

interface ScheduleEditModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee: Employee;
  date: string;
  existingShift?: ShiftEntry;
  adminId: string;
}

export function ScheduleEditModal({
  open,
  onClose,
  onSaved,
  employee,
  date,
  existingShift,
  adminId,
}: ScheduleEditModalProps) {
  const { showToast } = useToast();
  const initialStartTime = SCHEDULE_START_TIMES.includes(existingShift?.startTime as typeof SCHEDULE_START_TIMES[number])
    ? existingShift!.startTime!
    : '14:00';
  const initialEndTime = SCHEDULE_END_TIMES.includes(existingShift?.endTime as typeof SCHEDULE_END_TIMES[number])
    ? existingShift!.endTime!
    : '22:00';
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [status, setStatus] = useState<'working' | 'off'>(existingShift?.status === 'off' || existingShift?.status === 'leaveApproved' ? 'off' : 'working');
  const [error, setError] = useState('');

  const handleSaveWorking = async () => {
    if (!startTime || !endTime) {
      setError('출근/퇴근 시간을 입력해주세요.');
      return;
    }
    if (employee.isSubstitute) {
      await scheduleService.setSubstituteShift(date, employee.id, { startTime, endTime, status: 'working' }, adminId);
    } else {
      await scheduleService.setShift(date, employee.id, { startTime, endTime, status: 'working' }, adminId);
    }
    showToast('근무시간이 저장되었습니다.');
    onSaved();
    onClose();
  };

  const handleSetOff = async () => {
    if (employee.isSubstitute) {
      await scheduleService.setSubstituteShift(date, employee.id, { startTime: null, endTime: null, status: 'off' }, adminId);
    } else {
      await scheduleService.setShift(date, employee.id, { startTime: null, endTime: null, status: 'off' }, adminId);
    }
    showToast('휴무로 설정되었습니다.');
    onSaved();
    onClose();
  };

  const handleClear = async () => {
    if (employee.isSubstitute) await scheduleService.clearSubstituteShift(date, employee.id);
    else await scheduleService.clearShift(date, employee.id);
    showToast('근무 기록이 삭제되었습니다.');
    onSaved();
    onClose();
  };

  const handleRemoveSubstitute = async () => {
    if (!window.confirm(`${employee.name} 대타를 이 주 스케줄에서 삭제하시겠습니까?`)) return;
    await scheduleService.removeSubstitute(employee.id);
    showToast('일회성 대타가 삭제되었습니다.');
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${employee.name} · ${formatMonthDay(date)}(${getWeekdayLabel(date)})`}
    >
      {employee.isSubstitute && (
        <div className="mb-4 rounded-2xl bg-brand-red-light px-4 py-3">
          <p className="text-xs font-extrabold text-brand-red">일회성 대타 · 선택한 주에만 적용</p>
          {employee.substituteMemo && <p className="mt-1 text-sm text-ink-soft">{employee.substituteMemo}</p>}
        </div>
      )}
      {existingShift?.source === 'leaveApproved' && (
        <p className="text-xs text-status-leave bg-status-leave-bg rounded-control px-3 py-2 mb-4">
          승인된 휴무 신청으로 반영된 날짜입니다. 근무로 변경하면 신청 기록과 별개로 스케줄만 바뀝니다.
        </p>
      )}
      <ScheduleTimeSelector
        status={status}
        startTime={startTime}
        endTime={endTime}
        onStatusChange={setStatus}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />
      {error && <p className="text-xs text-status-rejected -mt-2 mb-3">{error}</p>}
      <Button fullWidth onClick={status === 'working' ? handleSaveWorking : handleSetOff} className="mt-4 mb-2">
        저장
      </Button>
      <div className="pb-5">
        <Button fullWidth variant="ghost" onClick={handleClear}>
          기록 삭제 (미배정으로 변경)
        </Button>
        {employee.isSubstitute && (
          <Button fullWidth variant="ghost" onClick={handleRemoveSubstitute} className="mt-1 text-status-rejected">
            이 주에서 대타 삭제
          </Button>
        )}
      </div>
    </Modal>
  );
}
