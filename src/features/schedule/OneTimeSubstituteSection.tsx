import { useMemo, useState } from 'react';
import { Plus, Trash2, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { ScheduleTimeSelector } from '@/features/schedule/ScheduleTimeSelector';
import { scheduleService } from '@/services/scheduleService';
import { formatMonthDay, getWeekdayLabel } from '@/utils/date';

type DraftShift = { status: 'working' | 'off'; startTime: string; endTime: string };
type Draft = { key: string; name: string; memo: string; shifts: Record<string, DraftShift | undefined> };

const newDraft = (): Draft => ({ key: crypto.randomUUID(), name: '', memo: '', shifts: {} });
const shortTime = (time: string) => time.endsWith(':00') ? String(Number(time.slice(0, 2))) : time;

export function OneTimeSubstituteSection({
  weekDates,
  onSaved,
  onClose,
}: {
  weekDates: string[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<Draft[]>([newDraft()]);
  const [editing, setEditing] = useState<{ key: string; date: string }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const range = `${formatMonthDay(weekDates[0])} ~ ${formatMonthDay(weekDates[6])}`;

  const updateDraft = (key: string, patch: Partial<Draft>) => {
    setDrafts((current) => current.map((item) => item.key === key ? { ...item, ...patch } : item));
  };
  const updateShift = (key: string, date: string, shift: DraftShift | undefined) => {
    setDrafts((current) => current.map((item) => item.key === key
      ? { ...item, shifts: { ...item.shifts, [date]: shift } }
      : item));
  };
  const summary = useMemo(() => drafts.map((draft) => ({
    ...draft,
    selected: weekDates.filter((date) => draft.shifts[date]),
  })), [drafts, weekDates]);

  const save = async () => {
    if (saving) return;
    setError('');
    if (drafts.some((draft) => !draft.name.trim())) {
      setError('모든 대타의 이름을 입력해주세요.');
      return;
    }
    if (drafts.some((draft) => !weekDates.some((date) => draft.shifts[date]))) {
      setError('대타별 근무일 또는 휴무를 1개 이상 설정해주세요.');
      return;
    }
    const invalid = drafts.some((draft) => weekDates.some((date) => {
      const shift = draft.shifts[date];
      return shift?.status === 'working' && shift.startTime >= shift.endTime;
    }));
    if (invalid) {
      setError('퇴근시간은 출근시간보다 늦어야 합니다.');
      return;
    }

    setSaving(true);
    try {
      await scheduleService.createSubstitutes(weekDates[0], drafts.map((draft) => ({
        name: draft.name.trim(),
        memo: draft.memo.trim() || undefined,
        shifts: weekDates.flatMap((date) => {
          const shift = draft.shifts[date];
          if (!shift) return [];
          return [{
            date,
            status: shift.status,
            startTime: shift.status === 'working' ? shift.startTime : null,
            endTime: shift.status === 'working' ? shift.endTime : null,
          }];
        }),
      })));
      showToast(`✅ ${drafts.length}명의 일회성 대타를 등록했습니다.`);
      onSaved();
      onClose();
    } catch (saveError) {
      console.error('[ScheduleSubstitute] create failed', saveError);
      showToast('대타 저장에 실패했습니다. DB 마이그레이션 적용 여부를 확인해주세요.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pb-5">
      <div className="rounded-2xl bg-brand-red-light px-4 py-4 text-center">
        <p className="text-xs font-bold text-brand-red">적용 주</p>
        <p className="mt-1 text-lg font-extrabold tabular-nums text-ink">{range}</p>
        <p className="mt-1 text-xs text-ink-soft">이 주에만 표시되며 다른 주로 복사되지 않습니다.</p>
      </div>

      {drafts.map((draft, draftIndex) => (
        <section key={draft.key} className="rounded-[22px] border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 font-bold text-ink"><UserRoundPlus size={17} className="text-brand-red" />대타 {draftIndex + 1}</p>
            {drafts.length > 1 && <button type="button" onClick={() => setDrafts((items) => items.filter((item) => item.key !== draft.key))} className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-rejected-bg text-status-rejected"><Trash2 size={16} /></button>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input value={draft.name} onChange={(event) => updateDraft(draft.key, { name: event.target.value })} placeholder="대타 이름" className="min-h-12 rounded-xl bg-brand-beige-light px-4 font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-brand-red/30" />
            <input value={draft.memo} onChange={(event) => updateDraft(draft.key, { memo: event.target.value })} placeholder="메모 (예: 금·토 홀 대타)" className="min-h-12 rounded-xl bg-brand-beige-light px-4 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-red/30" />
          </div>

          <p className="mb-2 mt-4 text-xs font-bold text-ink-soft">근무일과 시간을 선택해주세요</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {weekDates.map((date) => {
              const shift = draft.shifts[date];
              const active = editing?.key === draft.key && editing.date === date;
              return <button key={date} type="button" onClick={() => {
                if (!shift) updateShift(draft.key, date, { status: 'working', startTime: '14:00', endTime: '22:00' });
                setEditing({ key: draft.key, date });
              }} className={`min-h-[68px] rounded-2xl border px-1 py-2 text-center press-scale ${active ? 'border-brand-red bg-brand-red-light' : shift ? 'border-brand-red/20 bg-white' : 'border-border bg-brand-beige-light/60'}`}>
                <span className="block text-xs font-bold text-ink-soft">{getWeekdayLabel(date)} {Number(date.slice(8))}</span>
                <span className={`mt-1 block text-[11px] font-bold ${shift?.status === 'off' ? 'text-ink-faint' : shift ? 'text-brand-red' : 'text-ink-faint'}`}>{shift?.status === 'off' ? '휴무' : shift ? `${shortTime(shift.startTime)}-${shortTime(shift.endTime)}` : '미배정'}</span>
              </button>;
            })}
          </div>

          {editing?.key === draft.key && (() => {
            const shift = draft.shifts[editing.date] ?? { status: 'working' as const, startTime: '14:00', endTime: '22:00' };
            return <div className="mt-4 rounded-2xl bg-brand-beige-light/50 p-2">
              <div className="mb-2 flex items-center justify-between px-2 pt-1"><b className="text-sm">{formatMonthDay(editing.date)} ({getWeekdayLabel(editing.date)})</b><button type="button" onClick={() => { updateShift(draft.key, editing.date, undefined); setEditing(undefined); }} className="rounded-lg px-2 py-1 text-xs font-bold text-status-rejected">미배정으로 삭제</button></div>
              <ScheduleTimeSelector status={shift.status} startTime={shift.startTime} endTime={shift.endTime} onStatusChange={(status) => updateShift(draft.key, editing.date, { ...shift, status })} onStartTimeChange={(startTime) => updateShift(draft.key, editing.date, { ...shift, startTime })} onEndTimeChange={(endTime) => updateShift(draft.key, editing.date, { ...shift, endTime })} />
            </div>;
          })()}
        </section>
      ))}

      <Button type="button" variant="secondary" fullWidth onClick={() => setDrafts((current) => [...current, newDraft()])}><span className="inline-flex items-center gap-1"><Plus size={16} />대타 한 명 더 추가</span></Button>

      <section className="rounded-2xl bg-[#F7F8FA] p-4">
        <p className="text-sm font-bold text-ink">저장 전 확인 · {range}</p>
        <div className="mt-2 space-y-2">{summary.map((draft) => <div key={draft.key} className="text-xs leading-5 text-ink-soft"><b className="text-ink">{draft.name.trim() || '이름 미입력'}</b><span className="ml-2">{draft.selected.length ? draft.selected.map((date) => { const shift = draft.shifts[date]!; return `${getWeekdayLabel(date)} ${shift.status === 'off' ? '휴무' : `${shift.startTime}-${shift.endTime}`}`; }).join(', ') : '근무일 미설정'}</span></div>)}</div>
      </section>
      {error && <p className="text-sm font-semibold text-status-rejected">{error}</p>}
      <Button fullWidth size="lg" disabled={saving} onClick={() => void save()}>{saving ? '저장 중...' : `적용 주에 대타 ${drafts.length}명 등록`}</Button>
    </div>
  );
}
