import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, ClipboardList } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { openingPreparationRepository } from '@/repositories/openingPreparationRepository';
import type { OpeningPreparation, OpeningPreparationItem } from '@/data/types';
import {
  addDays,
  formatDate,
  formatDateTimeKo,
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
  ['onion-soy-sauce', '양파간장'],
] as const;

const CHECKLIST_CATEGORIES = [
  { key: 'stew', icon: '🥘', title: '찌개', itemKeys: ['doenjang', 'gochujang'] },
  { key: 'vegetable', icon: '🥬', title: '야채', itemKeys: ['kimchi', 'minari', 'onion', 'green-onion'] },
  { key: 'cooking', icon: '🍳', title: '조리', itemKeys: ['steamed-egg', 'fried-rice-sauce', 'myeoljeot'] },
  { key: 'etc', icon: '🥣', title: '기타', itemKeys: ['salt', 'ssamjang', 'milmyeon-broth', 'onion-soy-sauce'] },
] as const;

const PREPARATION_RESET_HOUR = 19;

function emptyItems(): OpeningPreparationItem[] {
  return CHECKLIST.map(([key, label]) => ({ key, label, completed: false }));
}

function mergeChecklistItems(savedItems: OpeningPreparationItem[] | undefined): OpeningPreparationItem[] {
  const savedByKey = new Map((savedItems ?? []).map((item) => [item.key, item]));
  const defaultKeys = new Set(CHECKLIST.map(([key]) => key));
  return [
    ...emptyItems().map((item) => savedByKey.get(item.key) ?? item),
    ...(savedItems ?? []).filter((item) => !defaultKeys.has(item.key as typeof CHECKLIST[number][0])),
  ];
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
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [dirtyAfterConfirm, setDirtyAfterConfirm] = useState(false);
  const [preparationWindow, setPreparationWindow] = useState(0);

  useEffect(() => {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setHours(PREPARATION_RESET_HOUR, 0, 0, 0);
    if (now >= nextReset) nextReset.setDate(nextReset.getDate() + 1);

    const timer = window.setTimeout(
      () => setPreparationWindow((current) => current + 1),
      nextReset.getTime() - now.getTime() + 1_000,
    );
    return () => window.clearTimeout(timer);
  }, [preparationWindow]);

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
        // 오후 7시 전에는 전날 작성한 오늘 준비표를 유지하고,
        // 오후 7시부터 다음 날 준비표로 전환합니다. DB 기록 자체는 삭제하지 않습니다.
        const beforeReset = new Date().getHours() < PREPARATION_RESET_HOUR;
        const selected = beforeReset ? todayRecord : tomorrowRecord;
        const selectedDate = selected?.targetDate ?? (beforeReset ? today : tomorrow);
        if (cancelled) return;
        setPreparation(selected);
        setItems(mergeChecklistItems(selected?.items));
        setTargetDate(selectedDate);
      } catch {
        showToast('오픈 준비 정보를 불러오지 못했습니다.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, showToast, preparationWindow]);

  const completedCount = items.filter((item) => item.completed).length;
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
    if (!session || confirming || completedCount === 0) return;
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
            <div className="flex items-center gap-2 text-ink">
              <ClipboardList size={21} className="text-brand-red" />
              <h2 className="text-xl font-bold">내일 해야 할 것</h2>
            </div>
            <button
              onClick={handleConfirm}
              disabled={confirming || completedCount === 0}
              className="min-h-12 rounded-2xl bg-brand-red px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,122,255,.9)] press-scale disabled:cursor-not-allowed disabled:bg-ink-faint disabled:opacity-50"
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
          <p className="mt-2 text-center text-xs font-medium text-ink-faint">
            매일 오후 7시에 다음 날 준비 목록으로 전환됩니다.
          </p>

          <div className="mt-5 rounded-[22px] bg-white p-5 shadow-[0_10px_32px_-24px_rgba(15,23,42,.4)] ring-1 ring-black/[0.05]">
            <p className="text-xs font-bold text-ink-faint">마지막 확정</p>
            {lastConfirmed ? (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-lg font-bold tabular-nums text-ink">{lastConfirmed}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-soft">{preparation?.confirmedByName}</p>
                </div>
                {!dirtyAfterConfirm && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={14} /> 확정 완료
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-ink-faint">아직 확정되지 않았습니다.</p>
            )}
          </div>

        </Card>

        {CHECKLIST_CATEGORIES.map((category) => (
          <section key={category.key}>
            <h2 className="mb-3 px-1 text-base font-bold text-ink">
              <span className="mr-2" aria-hidden="true">{category.icon}</span>
              {category.title}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {category.itemKeys.map((itemKey) => {
                const item = items.find((candidate) => candidate.key === itemKey);
                if (!item) return null;
                return (
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
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
}
