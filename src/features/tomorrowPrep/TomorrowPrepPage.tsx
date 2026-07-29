import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ClipboardList, Clock3, UserRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { openingPreparationRepository } from '@/repositories/openingPreparationRepository';
import { scheduleService } from '@/services/scheduleService';
import type { OpeningPreparation, OpeningPreparationItem } from '@/data/types';
import {
  addDays,
  formatDate,
  formatDateTimeKo,
  getMondayOfWeekStr,
  parseDate,
  todayStr,
} from '@/utils/date';

const CHECKLIST = [
  ['doenjang', '된장찌개'],
  ['gochujang', '고추장찌개'],
  ['myeoljeot', '멜젓'],
  ['kimchi', '김치'],
  ['minari', '미나리'],
  ['onion', '양파'],
  ['green-onion', '대파'],
  ['steamed-egg', '계란찜'],
  ['fried-rice-sauce', '볶음밥소스'],
  ['salt', '소금'],
  ['ssamjang', '쌈장'],
  ['milmyeon-broth', '밀면육수'],
] as const;

function emptyItems(): OpeningPreparationItem[] {
  return CHECKLIST.map(([key, label]) => ({ key, label, completed: false }));
}

function localDateFromIso(iso: string): string {
  return formatDate(new Date(iso));
}

function usageMessage(preparation: OpeningPreparation | undefined, targetDate: string) {
  const today = todayStr();
  if (preparation?.confirmedAt) {
    const confirmedDate = localDateFromIso(preparation.confirmedAt);
    if (formatDate(addDays(parseDate(confirmedDate), 1)) === today) {
      return { text: '오늘 사용할 오픈 준비입니다.', today: true };
    }
    if (confirmedDate === today) {
      return { text: '내일 사용할 오픈 준비입니다.', today: false };
    }
  }
  return targetDate === today
    ? { text: '오늘 사용할 오픈 준비입니다.', today: true }
    : { text: '내일 사용할 오픈 준비입니다.', today: false };
}

export function TomorrowPrepPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [preparation, setPreparation] = useState<OpeningPreparation>();
  const [items, setItems] = useState<OpeningPreparationItem[]>(emptyItems);
  const [targetDate, setTargetDate] = useState('');
  const [openingStaff, setOpeningStaff] = useState<{ names: string; time: string }>();
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [dirtyAfterConfirm, setDirtyAfterConfirm] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      try {
        const today = todayStr();
        const tomorrow = formatDate(addDays(new Date(), 1));
        const records = await openingPreparationRepository.findByDates([today, tomorrow]);
        const todayRecord = records.find((record) => record.targetDate === today);
        const tomorrowRecord = records.find((record) => record.targetDate === tomorrow);
        // 오픈 전(15시 이전)에는 전날 확정된 오늘 준비표를 우선 보여줍니다.
        const selected =
          new Date().getHours() < 15 && todayRecord?.confirmedAt
            ? todayRecord
            : tomorrowRecord;
        const selectedDate = selected?.targetDate ?? tomorrow;
        const board = await scheduleService.getWeekBoard(getMondayOfWeekStr(selectedDate));
        const shifts = board.week.shifts
          .filter(
            (shift) =>
              shift.date === selectedDate &&
              shift.status === 'working' &&
              shift.startTime,
          )
          .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
        const earliest = shifts[0]?.startTime;
        const names = earliest
          ? shifts
              .filter((shift) => shift.startTime === earliest)
              .map((shift) => board.employees.find((employee) => employee.id === shift.employeeId)?.name)
              .filter(Boolean)
              .join(', ')
          : '';
        if (cancelled) return;
        setPreparation(selected);
        setItems(selected?.items?.length ? selected.items : emptyItems());
        setTargetDate(selectedDate);
        setOpeningStaff(earliest ? { names: names || '담당자 확인 필요', time: earliest } : undefined);
      } catch {
        showToast('오픈 준비 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, showToast]);

  const completedCount = items.filter((item) => item.completed).length;
  const progress = Math.round((completedCount / items.length) * 100);
  const message = usageMessage(preparation, targetDate);

  const lastConfirmed = useMemo(() => {
    if (!preparation?.confirmedAt) return undefined;
    return formatDateTimeKo(preparation.confirmedAt);
  }, [preparation?.confirmedAt]);

  const toggleItem = async (key: string) => {
    if (!session || savingKey) return;
    const now = new Date().toISOString();
    const nextItems = items.map((item) =>
      item.key === key
        ? {
            ...item,
            completed: !item.completed,
            completedAt: !item.completed ? now : undefined,
            completedBy: !item.completed ? session.employeeId : undefined,
            completedByName: !item.completed ? session.name : undefined,
          }
        : item,
    );
    setItems(nextItems);
    setSavingKey(key);
    if (preparation?.confirmedAt) setDirtyAfterConfirm(true);
    try {
      const saved = await openingPreparationRepository.save({
        targetDate,
        items: nextItems,
        updatedBy: session.employeeId,
      });
      setPreparation((current) => ({
        ...saved,
        confirmedAt: current?.confirmedAt,
        confirmedBy: current?.confirmedBy,
        confirmedByName: current?.confirmedByName,
      }));
    } catch {
      setItems(items);
      showToast('체크 상태를 저장하지 못했습니다.', 'error');
    } finally {
      setSavingKey(undefined);
    }
  };

  const handleConfirm = async () => {
    if (!session || confirming) return;
    setConfirming(true);
    try {
      const saved = await openingPreparationRepository.confirm({
        targetDate,
        items,
        employeeId: session.employeeId,
        employeeName: session.name,
      });
      setPreparation(saved);
      setDirtyAfterConfirm(false);
      showToast('내일 준비를 확정했습니다.');
    } catch {
      showToast('준비 내용을 확정하지 못했습니다.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <Layout title="내일 해야 할 것">
        <div className="flex min-h-56 items-center justify-center"><Spinner /></div>
      </Layout>
    );
  }

  return (
    <Layout title="내일 해야 할 것">
      <div className="space-y-5">
        {dirtyAfterConfirm && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
            ⚠ 확정 이후 변경사항이 있습니다. 다시 확정해주세요.
          </div>
        )}

        <Card className="overflow-hidden bg-gradient-to-br from-white to-brand-red-light/35">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-ink">
                <ClipboardList size={21} className="text-brand-red" />
                <h2 className="text-xl font-bold">내일 해야 할 것</h2>
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold text-ink-faint">마지막 확정</p>
                {lastConfirmed ? (
                  <>
                    <p className="mt-1 text-base font-bold tabular-nums text-ink">{lastConfirmed}</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink-soft">
                      {preparation?.confirmedByName}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm font-medium text-ink-faint">아직 확정되지 않았습니다.</p>
                )}
              </div>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="min-h-12 rounded-2xl bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,122,255,.9)] press-scale disabled:opacity-50"
            >
              {confirming ? '확정 중...' : '내일 준비 확정'}
            </button>
          </div>

          <div className={`mt-5 rounded-2xl px-4 py-3 text-sm font-bold ${
            message.today
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {message.today ? '✅' : '⚠'} {message.text}
          </div>

          {preparation?.confirmedAt && !dirtyAfterConfirm && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 size={14} /> 확정 완료
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/[0.04]">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-faint">
                <UserRound size={14} /> {message.today ? '오늘 오픈' : '내일 오픈'}
              </p>
              <p className="mt-2 text-lg font-bold text-ink">{openingStaff?.names ?? '스케줄 없음'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-brand-red">
                {openingStaff && <Clock3 size={14} />} {openingStaff?.time ?? '—'}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/[0.04]">
              <p className="text-xs font-semibold text-ink-faint">진행률</p>
              <p className="mt-2 text-lg font-bold text-ink">{completedCount} / {items.length} 완료</p>
              <p className="text-sm font-semibold text-brand-red">{progress}% 완료</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-beige-light">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-red to-[#52A8FF] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <button
              key={item.key}
              onClick={() => toggleItem(item.key)}
              disabled={!!savingKey}
              className={`flex min-h-20 items-center gap-4 rounded-[22px] border p-4 text-left transition-all press-scale disabled:opacity-70 ${
                item.completed
                  ? 'border-emerald-100 bg-emerald-50 shadow-[0_8px_22px_-18px_rgba(16,185,129,.8)]'
                  : 'border-black/[0.06] bg-white hover:border-brand-red/20 hover:shadow-premium'
              }`}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                item.completed ? 'bg-emerald-500 text-white' : 'bg-brand-beige-light text-ink-faint'
              }`}>
                {item.completed ? <Check size={20} strokeWidth={3} /> : <span className="h-4 w-4 rounded border-2 border-current" />}
              </span>
              <span className="min-w-0">
                <span className={`block text-base font-bold ${item.completed ? 'text-emerald-800' : 'text-ink'}`}>
                  {item.label}
                </span>
                {item.completed && (
                  <span className="mt-0.5 block truncate text-xs font-medium text-emerald-700">
                    {item.completedByName} · {item.completedAt ? formatDateTimeKo(item.completedAt) : ''}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  );
}
