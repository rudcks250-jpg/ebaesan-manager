import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronLeft, ChevronRight, ImageDown, Pencil, Plus, Share2, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { employeeService } from '@/services/employeeService';
import { ProfitLossReport } from '@/features/profitLoss/ProfitLossReport';
import { exportReportPngs, shareReportPages } from '@/features/profitLoss/profitLossReportExport';
import type { Employee } from '@/data/types';

type AmountMap = Record<string, number>;

interface MonthlyProfitLoss {
  sales: number;
  food: AmountMap;
  drinks: AmountMap;
  labor: AmountMap;
  ads: AmountMap;
  operations: AmountMap;
  fixedCosts: AmountMap;
  taxReserve: number;
  memo: string;
  updatedAt: string;
}

const FULL_TIME = ['김경재', '박경찬', '김하은'];
const FOOD = ['축산유통', '식자재유통'];
const DRINKS = ['주류', '음료'];
const ADS = ['플레이스 광고', '메타 광고', '리워드', '당근 광고', '블로그 리뷰', '검색광고 대행비'];
const OPERATIONS = ['카드수수료', '4대보험', '기타운영비'];
const FIXED_COSTS = [
  '임대료', '전기세', '카드값', '외식업협회비', '화재보험',
  '세무기장료', '음식물처리', '수도요금', '가스',
];

function emptyMap(keys: string[]): AmountMap {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function emptyMonth(employeeNames: string[] = []): MonthlyProfitLoss {
  return {
    sales: 0,
    food: emptyMap(FOOD),
    drinks: emptyMap(DRINKS),
    labor: emptyMap([...FULL_TIME, ...employeeNames.filter((name) => !FULL_TIME.includes(name))]),
    ads: emptyMap(ADS),
    operations: emptyMap(OPERATIONS),
    fixedCosts: emptyMap(FIXED_COSTS),
    taxReserve: 0,
    memo: '',
    updatedAt: new Date().toISOString(),
  };
}

function normalizeMonth(value: MonthlyProfitLoss | undefined, employeeNames: string[] = []): MonthlyProfitLoss {
  const fallback = emptyMonth(employeeNames);
  if (!value) return fallback;
  return {
    ...fallback,
    ...value,
    food: { ...fallback.food, ...(value.food ?? {}) },
    drinks: { ...fallback.drinks, ...(value.drinks ?? {}) },
    labor: { ...fallback.labor, ...(value.labor ?? {}) },
    ads: { ...fallback.ads, ...(value.ads ?? {}) },
    operations: { ...fallback.operations, ...(value.operations ?? {}) },
    fixedCosts: { ...fallback.fixedCosts, ...(value.fixedCosts ?? {}) },
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(key: string, amount: number): string {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 1 + amount, 1));
}

function sum(values: AmountMap): number {
  return Object.values(values).reduce((total, value) => total + (Number(value) || 0), 0);
}

function won(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function percent(value: number, base: number): number {
  return base > 0 ? (value / base) * 100 : 0;
}

function ratioText(value: number): string {
  return `${value.toFixed(1)}%`;
}

function trend(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Trend({ current, previous }: { current: number; previous: number }) {
  const value = trend(current, previous);
  if (value === undefined) return <span className="text-xs font-semibold text-ink-faint">전월 비교 없음</span>;
  const positive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
      {positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {positive ? '▲ +' : '▼ '}{value.toFixed(1)}%
    </span>
  );
}

function MoneyInput({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString('ko-KR') : ''}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
        placeholder="0"
        disabled={disabled}
        className={`min-h-11 w-full rounded-xl bg-brand-beige-light px-3 pr-8 text-right text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-brand-red/30 ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">원</span>
    </div>
  );
}

function CustomItemGrid({
  values,
  defaultKeys,
  canEdit,
  onChange,
  onEditItem,
  onDeleteItem,
}: {
  values: AmountMap;
  defaultKeys: string[];
  canEdit: boolean;
  onChange: (key: string, value: number) => void;
  onEditItem: (key: string) => void;
  onDeleteItem: (key: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(values).map(([label, value]) => {
        const isCustom = !defaultKeys.includes(label);
        return (
          <div key={label}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-ink-soft">{label}</span>
              {isCustom && canEdit && (
                <span className="flex items-center gap-2">
                  <button type="button" onClick={() => onEditItem(label)} className="text-ink-faint hover:text-brand-red">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => onDeleteItem(label)} className="text-ink-faint hover:text-status-rejected">
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </div>
            <MoneyInput value={value} onChange={(next) => onChange(label, next)} disabled={isCustom && !canEdit} />
          </div>
        );
      })}
    </div>
  );
}

function AddItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" size="sm" fullWidth className="mt-4" onClick={onClick}>
      <span className="flex items-center justify-center gap-1.5"><Plus size={14} /> 항목 추가</span>
    </Button>
  );
}

function ExpenseSection({
  title,
  values,
  sales,
  previousTotal,
  defaultKeys,
  canEdit,
  onChange,
  onAddItem,
  onEditItem,
  onDeleteItem,
}: {
  title: string;
  values: AmountMap;
  sales: number;
  previousTotal: number;
  defaultKeys: string[];
  canEdit: boolean;
  onChange: (key: string, value: number) => void;
  onAddItem: () => void;
  onEditItem: (key: string) => void;
  onDeleteItem: (key: string) => void;
}) {
  const total = sum(values);
  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <Trend current={total} previous={previousTotal} />
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-ink">{won(total)}</p>
          <p className="text-xs font-semibold text-ink-faint">매출 대비 {ratioText(percent(total, sales))}</p>
        </div>
      </div>
      <CustomItemGrid values={values} defaultKeys={defaultKeys} canEdit={canEdit} onChange={onChange} onEditItem={onEditItem} onDeleteItem={onDeleteItem} />
      {canEdit && <AddItemButton onClick={onAddItem} />}
    </Card>
  );
}

type SectionField = 'food' | 'drinks' | 'labor' | 'ads' | 'operations' | 'fixedCosts';

interface ItemModalState {
  field: SectionField;
  mode: 'add' | 'edit';
  originalKey?: string;
}

export function ProfitLossPage() {
  const { session, effectiveRole } = useAuth();
  const { showToast } = useToast();
  const isAdmin = effectiveRole === 'admin';
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [allData, setAllData] = useState<Record<string, MonthlyProfitLoss>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState(0);
  const [deleteItem, setDeleteItem] = useState<{ field: SectionField; key: string } | null>(null);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [taxAmount, setTaxAmount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState<'png' | 'share' | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const employeeNames = employees.map((employee) => employee.name);
  const current = normalizeMonth(allData[selectedMonth], employeeNames);
  const previous = normalizeMonth(allData[shiftMonth(selectedMonth, -1)], employeeNames);

  useEffect(() => {
    void employeeService.listActive().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('profit_loss_months')
        .select('year_month,data');
      if (cancelled) return;
      if (error) {
        showToast('손익계산서 데이터를 불러오지 못했습니다.');
        setLoaded(true);
        return;
      }
      const months = Object.fromEntries(
        (data ?? []).map((row) => [row.year_month, row.data as unknown as MonthlyProfitLoss])
      );
      setAllData(months);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, showToast]);

  useEffect(() => {
    const names = employees.map((employee) => employee.name);
    setAllData((existing) => {
      const month = normalizeMonth(existing[selectedMonth], names);
      const labor = { ...emptyMap([...FULL_TIME, ...names.filter((name) => !FULL_TIME.includes(name))]), ...month.labor };
      if (existing[selectedMonth] && Object.keys(labor).length === Object.keys(month.labor).length) return existing;
      return { ...existing, [selectedMonth]: { ...month, labor } };
    });
  }, [employees, selectedMonth]);

  useEffect(() => {
    if (!loaded || !session || !allData[selectedMonth]) return;
    clearTimeout(saveTimer.current);
    setSaveState('saving');
    const monthToSave = selectedMonth;
    const dataToSave = allData[selectedMonth];
    saveTimer.current = setTimeout(() => {
      void supabase
        .from('profit_loss_months')
        .upsert({
          year_month: monthToSave,
          data: dataToSave,
          updated_by: session.employeeId,
        })
        .then(({ error }) => {
          if (error) {
            setSaveState('error');
            showToast('자동 저장에 실패했습니다.');
          } else {
            setSaveState('saved');
          }
        });
    }, 600);
    return () => clearTimeout(saveTimer.current);
  }, [allData, loaded, selectedMonth, session, showToast]);

  const totals = useMemo(() => {
    const food = sum(current.food);
    const drinks = sum(current.drinks);
    const labor = sum(current.labor);
    const ads = sum(current.ads);
    const operations = sum(current.operations);
    const fixedCosts = sum(current.fixedCosts);
    const cost = food + drinks;
    const operatingProfit = current.sales - cost - labor - ads - operations - fixedCosts;
    // 전월 세금대비금(당월에 입력한 taxReserve)은 지난달에 미리 적립해둔 세금 예비금이 풀리는 개념이라 영업이익에 더합니다.
    const finalOperatingProfit = operatingProfit + current.taxReserve;
    const netProfit = finalOperatingProfit;
    return { food, drinks, labor, ads, operations, fixedCosts, cost, operatingProfit, finalOperatingProfit, netProfit };
  }, [current]);

  const previousTotals = useMemo(() => {
    const food = sum(previous.food);
    const drinks = sum(previous.drinks);
    const labor = sum(previous.labor);
    const ads = sum(previous.ads);
    const operations = sum(previous.operations);
    const fixedCosts = sum(previous.fixedCosts);
    const cost = food + drinks;
    const operatingProfit = previous.sales - cost - labor - ads - operations - fixedCosts;
    const finalOperatingProfit = operatingProfit + previous.taxReserve;
    return { food, drinks, labor, ads, operations, fixedCosts, operatingProfit, finalOperatingProfit, netProfit: finalOperatingProfit };
  }, [previous]);

  const update = (patch: Partial<MonthlyProfitLoss>) => {
    setAllData((existing) => ({
      ...existing,
      [selectedMonth]: { ...(existing[selectedMonth] ?? emptyMonth(employees.map((employee) => employee.name))), ...patch, updatedAt: new Date().toISOString() },
    }));
  };

  const updateMap = (field: SectionField, key: string, value: number) => {
    update({ [field]: { ...current[field], [key]: value } });
  };

  const openAddItem = (field: SectionField) => {
    setItemName('');
    setItemAmount(0);
    setItemModal({ field, mode: 'add' });
  };

  const openEditItem = (field: SectionField, key: string) => {
    setItemName(key);
    setItemAmount(current[field][key] ?? 0);
    setItemModal({ field, mode: 'edit', originalKey: key });
  };

  const saveItem = () => {
    if (!itemModal) return;
    const name = itemName.trim();
    if (!name) return;
    const { field, mode, originalKey } = itemModal;
    const existingKeys = Object.keys(current[field]);
    const collides = mode === 'add' ? existingKeys.includes(name) : name !== originalKey && existingKeys.includes(name);
    if (collides) {
      showToast('이미 같은 이름의 항목이 있습니다.', 'error');
      return;
    }
    const map = { ...current[field] };
    if (mode === 'edit' && originalKey && originalKey !== name) delete map[originalKey];
    map[name] = itemAmount;
    update({ [field]: map });
    setItemModal(null);
  };

  const confirmDeleteItem = () => {
    if (!deleteItem) return;
    const map = { ...current[deleteItem.field] };
    delete map[deleteItem.key];
    update({ [deleteItem.field]: map });
    setDeleteItem(null);
  };

  const openTaxModal = () => {
    setTaxAmount(current.taxReserve);
    setTaxModalOpen(true);
  };

  const saveTax = () => {
    update({ taxReserve: taxAmount });
    setTaxModalOpen(false);
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const reportFilename = `이배산_손익계산서_${year}-${String(month).padStart(2, '0')}`;

  const handleSaveReportPng = async () => {
    if (!reportRef.current || reportBusy) return;
    setReportBusy('png');
    try {
      const count = await exportReportPngs(reportRef.current, reportFilename);
      showToast(`이번달 손익계산서 이미지 ${count}장이 생성되었습니다.`);
    } catch {
      showToast('손익계산서 이미지 생성에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setReportBusy(null);
    }
  };

  const handleShareReport = async () => {
    if (!reportRef.current || reportBusy) return;
    setReportBusy('share');
    try {
      const result = await shareReportPages(reportRef.current, reportFilename, `${year}년 ${month}월 손익 보고서`);
      showToast(result === 'shared' ? '이번달 손익계산서를 공유했습니다.' : '공유를 지원하지 않아 이미지 4장으로 저장했습니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showToast('손익계산서 이미지 생성에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setReportBusy(null);
    }
  };
  const cards = [
    { label: '영업이익', value: totals.finalOperatingProfit, previous: previousTotals.finalOperatingProfit },
    { label: '영업이익률', value: percent(totals.finalOperatingProfit, current.sales), previous: percent(previousTotals.finalOperatingProfit, previous.sales), percent: true },
    { label: '원가율', value: percent(totals.cost, current.sales), previous: percent(previousTotals.food + previousTotals.drinks, previous.sales), percent: true },
    { label: '인건비율', value: percent(totals.labor, current.sales), previous: percent(previousTotals.labor, previous.sales), percent: true },
    { label: '광고비율', value: percent(totals.ads, current.sales), previous: percent(previousTotals.ads, previous.sales), percent: true },
    { label: '현재 순이익률', value: percent(totals.netProfit, current.sales), previous: percent(previousTotals.netProfit, previous.sales), percent: true },
  ];

  return (
    <Layout title="월 손익계산서">
      {!loaded ? (
        <div className="flex min-h-64 items-center justify-center"><Spinner /></div>
      ) : (
      <div className="space-y-5">
        <Card className="sticky top-3 z-20">
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}><ChevronLeft size={17} /> 이전달</Button>
            <p className="text-xl font-bold text-ink">{year}년 {month}월</p>
            <Button size="sm" variant="ghost" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>다음달 <ChevronRight size={17} /></Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className={`mr-3 self-center text-xs font-semibold ${saveState === 'error' ? 'text-red-500' : 'text-ink-faint'}`}>
              {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '자동 저장됨' : saveState === 'error' ? '저장 실패' : ''}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setReportOpen(true)}>
              <span className="flex items-center gap-1"><Camera size={14} /> 이번달 손익계산서 공유하기</span>
            </Button>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.label}>
              <p className="text-xs font-semibold text-ink-faint">{card.label}</p>
              <p className={`mt-2 text-2xl font-bold ${card.value >= 0 ? 'text-ink' : 'text-red-500'}`}>
                {card.percent ? ratioText(card.value) : won(card.value)}
              </p>
              {card.previous !== undefined && <Trend current={card.value} previous={card.previous} />}
            </Card>
          ))}
        </div>

        <Card
          className={isAdmin ? 'cursor-pointer press-scale' : ''}
          onClick={isAdmin ? openTaxModal : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-faint">전월 세금대비금</p>
              <p className="mt-2 text-2xl font-bold text-ink">{won(current.taxReserve)}</p>
            </div>
            {isAdmin && <span className="shrink-0 text-xs font-semibold text-brand-red">탭하여 수정</span>}
          </div>
          <p className="mt-2 text-xs text-ink-faint">지난달에 미리 적립해둔 세금 예비금입니다.</p>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">총매출</h2>
              <Trend current={current.sales} previous={previous.sales} />
            </div>
            <p className="text-3xl font-bold text-brand-red">{won(current.sales)}</p>
          </div>
          <div className="mt-5"><MoneyInput value={current.sales} onChange={(sales) => update({ sales })} /></div>
        </Card>

        <ExpenseSection
          title="식자재" values={current.food} sales={current.sales} previousTotal={previousTotals.food}
          defaultKeys={FOOD} canEdit={isAdmin}
          onChange={(key, value) => updateMap('food', key, value)}
          onAddItem={() => openAddItem('food')} onEditItem={(key) => openEditItem('food', key)} onDeleteItem={(key) => setDeleteItem({ field: 'food', key })}
        />
        <ExpenseSection
          title="주류·음료" values={current.drinks} sales={current.sales} previousTotal={previousTotals.drinks}
          defaultKeys={DRINKS} canEdit={isAdmin}
          onChange={(key, value) => updateMap('drinks', key, value)}
          onAddItem={() => openAddItem('drinks')} onEditItem={(key) => openEditItem('drinks', key)} onDeleteItem={(key) => setDeleteItem({ field: 'drinks', key })}
        />

        <Card>
          <div className="mb-5 flex items-start justify-between">
            <div><h2 className="text-lg font-bold text-ink">인건비</h2><Trend current={totals.labor} previous={previousTotals.labor} /></div>
            <div className="text-right"><p className="text-xl font-bold text-ink">{won(totals.labor)}</p><p className="text-xs text-ink-faint">매출 대비 {ratioText(percent(totals.labor, current.sales))}</p></div>
          </div>
          <p className="mb-3 text-xs font-bold text-ink-faint">정직원</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FULL_TIME.map((name) => <label key={name}><span className="mb-1.5 block text-xs font-semibold text-ink-soft">{name}</span><MoneyInput value={current.labor[name] ?? 0} onChange={(value) => updateMap('labor', name, value)} /></label>)}
          </div>
          <div className="my-5 h-px bg-black/[0.05]" />
          <p className="mb-3 text-xs font-bold text-ink-faint">파트타임</p>
          <CustomItemGrid
            values={Object.fromEntries(Object.entries(current.labor).filter(([name]) => !FULL_TIME.includes(name)))}
            defaultKeys={[...FULL_TIME, ...employeeNames]}
            canEdit={isAdmin}
            onChange={(key, value) => updateMap('labor', key, value)}
            onEditItem={(key) => openEditItem('labor', key)}
            onDeleteItem={(key) => setDeleteItem({ field: 'labor', key })}
          />
          {isAdmin && <AddItemButton onClick={() => openAddItem('labor')} />}
        </Card>

        <ExpenseSection
          title="광고비" values={current.ads} sales={current.sales} previousTotal={previousTotals.ads}
          defaultKeys={ADS} canEdit={isAdmin}
          onChange={(key, value) => updateMap('ads', key, value)}
          onAddItem={() => openAddItem('ads')} onEditItem={(key) => openEditItem('ads', key)} onDeleteItem={(key) => setDeleteItem({ field: 'ads', key })}
        />
        <ExpenseSection
          title="운영비" values={current.operations} sales={current.sales} previousTotal={previousTotals.operations}
          defaultKeys={OPERATIONS} canEdit={isAdmin}
          onChange={(key, value) => updateMap('operations', key, value)}
          onAddItem={() => openAddItem('operations')} onEditItem={(key) => openEditItem('operations', key)} onDeleteItem={(key) => setDeleteItem({ field: 'operations', key })}
        />
        <ExpenseSection
          title="고정비" values={current.fixedCosts} sales={current.sales} previousTotal={previousTotals.fixedCosts}
          defaultKeys={FIXED_COSTS} canEdit={isAdmin}
          onChange={(key, value) => updateMap('fixedCosts', key, value)}
          onAddItem={() => openAddItem('fixedCosts')} onEditItem={(key) => openEditItem('fixedCosts', key)} onDeleteItem={(key) => setDeleteItem({ field: 'fixedCosts', key })}
        />

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">관리자 메모</h2>
          <Textarea value={current.memo} onChange={(event) => update({ memo: event.target.value })} placeholder={`${year}년 ${month}월 특이사항을 입력하세요.`} />
          <p className="text-right text-xs text-ink-faint">입력 내용은 월별로 자동 저장됩니다.</p>
        </Card>
      </div>
      )}

      <Modal
        open={!!itemModal}
        onClose={() => setItemModal(null)}
        title={itemModal?.mode === 'edit' ? '항목 수정' : '항목 추가'}
        footer={<Button fullWidth onClick={saveItem} disabled={!itemName.trim()}>저장</Button>}
      >
        <div className="pb-5">
          <Input label="항목명" value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="예: 유튜브 광고" />
          <label>
            <span className="mb-2 block text-[13px] font-semibold text-ink-soft">금액</span>
            <MoneyInput value={itemAmount} onChange={setItemAmount} />
          </label>
        </div>
      </Modal>

      <Modal
        open={taxModalOpen}
        onClose={() => setTaxModalOpen(false)}
        title="전월 세금대비금"
        footer={<Button fullWidth onClick={saveTax}>저장</Button>}
      >
        <div className="pb-5">
          <p className="mb-4 text-sm text-ink-soft">지난달에 미리 적립해둔 세금 예비금입니다. 이번 달 영업이익에 더해집니다.</p>
          <label>
            <span className="mb-2 block text-[13px] font-semibold text-ink-soft">금액</span>
            <MoneyInput value={taxAmount} onChange={setTaxAmount} />
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteItem}
        title="정말 삭제하시겠습니까?"
        confirmLabel="삭제"
        danger
        onConfirm={confirmDeleteItem}
        onClose={() => setDeleteItem(null)}
      />

      {reportOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/45 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-ink/95 px-4 py-3 sm:px-6">
            <p className="text-sm font-bold text-white">{year}년 {month}월 손익계산서 미리보기 · 4장</p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => void handleSaveReportPng()} disabled={!!reportBusy}>
                <span className="flex items-center gap-1"><ImageDown size={14} /> {reportBusy === 'png' ? '저장 중…' : '이미지 저장'}</span>
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void handleShareReport()} disabled={!!reportBusy}>
                <span className="flex items-center gap-1"><Share2 size={14} /> {reportBusy === 'share' ? '공유 중…' : '공유하기'}</span>
              </Button>
              <button
                onClick={() => setReportOpen(false)}
                aria-label="닫기"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white press-scale hover:bg-white/20"
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="grow overflow-y-auto bg-brand-beige-light p-4 sm:p-8">
            <div className="mx-auto max-w-full overflow-x-auto rounded-3xl bg-white shadow-premium-lg">
              <ProfitLossReport
                ref={reportRef}
                companyName="이배산 숯불구이"
                year={year}
                month={month}
                sales={current.sales}
                foodItems={current.food}
                drinksItems={current.drinks}
                laborItems={current.labor}
                adsItems={current.ads}
                operationsItems={current.operations}
                fixedCostsItems={current.fixedCosts}
                taxReserve={current.taxReserve}
                operatingProfit={totals.operatingProfit}
                finalOperatingProfit={totals.finalOperatingProfit}
                memo={current.memo}
                previous={{
                  sales: previous.sales,
                  food: previousTotals.food,
                  drinks: previousTotals.drinks,
                  cost: previousTotals.food + previousTotals.drinks,
                  labor: previousTotals.labor,
                  ads: previousTotals.ads,
                  operations: previousTotals.operations,
                  fixedCosts: previousTotals.fixedCosts,
                  operatingProfit: previousTotals.operatingProfit,
                  finalOperatingProfit: previousTotals.finalOperatingProfit,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
