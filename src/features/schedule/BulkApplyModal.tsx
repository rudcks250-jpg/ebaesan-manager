import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { scheduleService } from '@/services/scheduleService';
import { useToast } from '@/components/common/Toast';
import { formatMonthDay, getWeekdayLabel } from '@/utils/date';
import type { Employee } from '@/data/types';
import { LoaderCircle, Search, UsersRound, X } from 'lucide-react';
import { ScheduleTimeSelector } from '@/features/schedule/ScheduleTimeSelector';
import { OneTimeSubstituteSection } from '@/features/schedule/OneTimeSubstituteSection';

interface BulkApplyModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employees: Employee[];
  weekDates: string[];
  adminId: string;
}

export function BulkApplyModal({
  open,
  onClose,
  onSaved,
  employees,
  weekDates,
  adminId,
}: BulkApplyModalProps) {
  const { showToast } = useToast();
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('22:00');
  const [asOff, setAsOff] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'employees' | 'substitutes'>('employees');

  const visibleEmployees = employees.filter((employee) =>
    employee.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const handleApply = async () => {
    if (saving) return;
    if (selectedEmployees.length === 0 || selectedDates.length === 0) {
      setError('직원과 날짜를 1개 이상 선택해주세요.');
      return;
    }
    setSaving(true);
    try {
      await scheduleService.bulkApply(
        selectedDates,
        selectedEmployees,
        asOff
          ? { startTime: null, endTime: null, status: 'off' }
          : { startTime, endTime, status: 'working' },
        adminId
      );
      showToast('✅ 스케줄이 저장되었습니다.');
      onSaved();
      onClose();
    } catch {
      showToast('스케줄을 저장하지 못했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
      <Modal
        open={open}
        onClose={() => !saving && onClose()}
      title="일괄등록"
      panelClassName="sm:max-w-3xl"
      footer={tab === 'employees' ? (
        <Button fullWidth onClick={handleApply} disabled={saving}>
          <span className="inline-flex items-center gap-1.5">
            {saving && <LoaderCircle size={16} className="animate-spin" />}
            선택한 대상에 적용
          </span>
        </Button>
      ) : undefined}
    >
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-brand-beige-light p-1">
        <button type="button" onClick={() => setTab('employees')} className={`min-h-11 rounded-xl text-sm font-bold transition ${tab === 'employees' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}>정식 직원 일괄등록</button>
        <button type="button" onClick={() => setTab('substitutes')} className={`min-h-11 rounded-xl text-sm font-bold transition ${tab === 'substitutes' ? 'bg-white text-brand-red shadow-sm' : 'text-ink-soft'}`}>일회성 대타 추가</button>
      </div>
      {tab === 'substitutes' ? (
        <OneTimeSubstituteSection weekDates={weekDates} onSaved={onSaved} onClose={onClose} />
      ) : <>
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-ink">직원 선택</p>
        <span className="text-xs font-semibold text-brand-red">{selectedEmployees.length}명 선택</span>
      </div>
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="직원 이름 검색"
          className="w-full h-11 rounded-xl bg-brand-beige-light border border-transparent pl-9 pr-4 text-sm outline-none focus:bg-white focus:border-brand-red/50 focus:ring-4 focus:ring-brand-red/10"
        />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          onClick={() => setSelectedEmployees((current) => [
            ...new Set([...current, ...visibleEmployees.map((employee) => employee.id)]),
          ])}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-red-light px-3 py-2 text-xs font-semibold text-brand-red press-scale"
        >
          <UsersRound size={14} /> 전체 선택
        </button>
        <button
          type="button"
          onClick={() => setSelectedEmployees([])}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-beige-light px-3 py-2 text-xs font-semibold text-ink-soft press-scale"
        >
          <X size={14} /> 선택 해제
        </button>
      </div>
      <div className="max-h-44 overflow-y-auto rounded-2xl border border-border bg-brand-beige-light/50 p-2 flex flex-wrap content-start gap-2 mb-4 scrollbar-thin">
        {visibleEmployees.map((e) => (
          <button
            type="button"
            key={e.id}
            onClick={() => toggle(selectedEmployees, setSelectedEmployees, e.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              selectedEmployees.includes(e.id)
                ? 'bg-brand-red text-white border-brand-red'
                : 'border-border text-ink-soft'
            }`}
          >
            {e.name}
          </button>
        ))}
        {visibleEmployees.length === 0 && (
          <p className="w-full py-5 text-center text-xs text-ink-faint">검색 결과가 없습니다.</p>
        )}
      </div>

      <p className="text-sm font-semibold text-ink mb-2">날짜 선택</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {weekDates.map((d) => (
          <button
            key={d}
            onClick={() => toggle(selectedDates, setSelectedDates, d)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
              selectedDates.includes(d)
                ? 'bg-brand-red text-white border-brand-red'
                : 'border-border text-ink-soft'
            }`}
          >
            {getWeekdayLabel(d)} {formatMonthDay(d)}
          </button>
        ))}
      </div>

      <ScheduleTimeSelector
        status={asOff ? 'off' : 'working'}
        startTime={startTime}
        endTime={endTime}
        onStatusChange={(status) => setAsOff(status === 'off')}
        onStartTimeChange={setStartTime}
        onEndTimeChange={setEndTime}
      />
      {error && <p className="text-xs text-status-rejected mb-3">{error}</p>}
      <div className="pb-2" />
      </>}
    </Modal>
  );
}
