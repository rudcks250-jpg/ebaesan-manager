import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, ChevronDown, ChevronLeft, ChevronRight, ImageDown, Pencil, Plus, ReceiptText, Share2, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
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
import { ExpenseImportModal } from '@/features/profitLoss/ExpenseImportModal';
import { rememberAppliedFingerprints, type ParsedExpense } from '@/features/profitLoss/expenseOcr';
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
  withholdingPayable?: number;
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
    withholdingPayable: 0,
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

function DetailAccordion({
  title,
  total,
  ratio,
  currentTrend,
  previousTrend,
  open,
  onToggle,
  children,
}: {
  title: string;
  total: number;
  ratio?: number;
  currentTrend?: number;
  previousTrend?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Card padded={false} className="overflow-hidden">
      <button type="button" onClick={onToggle} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
        <span className="min-w-0">
          <span className="block text-base font-bold text-ink">{title}</span>
          {currentTrend !== undefined && previousTrend !== undefined && (
            <span className="mt-0.5 block"><Trend current={currentTrend} previous={previousTrend} /></span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-3 text-right">
          <span>
            <span className="block text-base font-bold tabular-nums text-ink">{won(total)}</span>
            {ratio !== undefined && <span className="block text-[11px] font-semibold text-ink-faint">매출 대비 {ratioText(ratio)}</span>}
          </span>
          <ChevronDown size={18} className={`text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="border-t border-black/[0.05] px-4 pb-5 pt-4 sm:px-5">{children}</div>}
    </Card>
  );
}

type SectionField = 'food' | 'drinks' | 'labor' | 'ads' | 'operations' | 'fixedCosts';
type ViewMode = 'overview' | 'details';
type DetailSection = 'sales' | 'cost' | 'labor' | 'fixedCosts' | 'ads' | 'operations' | 'tax';

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
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [openSection, setOpenSection] = useState<DetailSection | null>(null);
  const [costAnalysisOpen, setCostAnalysisOpen] = useState(false);
  const [expenseImportOpen, setExpenseImportOpen] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const employeeNames = employees.map((employee) => employee.name);
  const current = normalizeMonth(allData[selectedMonth], employeeNames);
  const previous = normalizeMonth(allData[shiftMonth(selectedMonth, -1)], employeeNames);

  const toggleSection = (section: DetailSection) => {
    setOpenSection((currentSection) => currentSection === section ? null : section);
  };

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

  const handleApplyExpenses = async (items: ParsedExpense[]) => {
    if (!session || !items.length) return;
    const nextData = { ...allData };
    const targetField = (category: ParsedExpense['category']): SectionField | null => {
      if (category === '원가') return 'food';
      if (category === '인건비') return 'labor';
      if (category === '고정비' || category === '공과금') return 'fixedCosts';
      if (category === '광고비') return 'ads';
      if (category === '기타비용') return 'operations';
      return null;
    };
    for (const item of items) {
      const key = item.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(key)) throw new Error('유효하지 않은 거래일입니다.');
      const monthData = normalizeMonth(nextData[key], employeeNames);
      const field = targetField(item.category);
      if (field) {
        const label = item.counterparty.trim() || 'OCR 가져오기';
        monthData[field] = { ...monthData[field], [label]: (monthData[field][label] ?? 0) + item.appliedAmount };
      }
      if (item.withholdingAmount) monthData.withholdingPayable = (monthData.withholdingPayable ?? 0) + item.withholdingAmount;
      monthData.updatedAt = new Date().toISOString();
      nextData[key] = monthData;
    }
    const affectedMonths = [...new Set(items.map((item) => item.date.slice(0, 7)))];
    const payload = affectedMonths.map((key) => ({ year_month: key, data: nextData[key], updated_by: session.employeeId }));
    const { error } = await supabase.from('profit_loss_months').upsert(payload);
    if (error) {
      console.error('[ExpenseImport] apply failed', error);
      showToast('지출내역 반영에 실패했습니다. 다시 시도해주세요.', 'error');
      return;
    }
    setAllData(nextData);
    rememberAppliedFingerprints(items.map((item) => item.fingerprint));
    setExpenseImportOpen(false);
    showToast(`${items.length}건의 지출내역을 손익계산서에 반영했습니다.`);
  };
  const overviewCards = [
    { label: '총매출', value: current.sales, previous: previous.sales, accent: 'text-brand-red' },
    { label: '영업이익', value: totals.finalOperatingProfit, previous: previousTotals.finalOperatingProfit, accent: totals.finalOperatingProfit >= 0 ? 'text-ink' : 'text-red-500' },
    { label: '현재 순이익', value: totals.netProfit, previous: previousTotals.netProfit, accent: totals.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500' },
    {
      label: '영업이익률',
      value: percent(totals.finalOperatingProfit, current.sales),
      previous: percent(previousTotals.finalOperatingProfit, previous.sales),
      percent: true,
      accent: totals.finalOperatingProfit >= 0 ? 'text-ink' : 'text-red-500',
    },
  ];

  return (
    <Layout title="월 손익계산서">
      {!loaded ? (
        <div className="flex min-h-64 items-center justify-center"><Spinner /></div>
      ) : (
      <div className="space-y-4">
        <Card padded={false} className="sticky top-3 z-20 overflow-hidden p-3 sm:p-4">
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))} aria-label="이전달" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-beige-light press-scale">
              <ChevronLeft size={19} />
            </button>
            <p className="min-w-0 flex-1 text-center text-base font-bold text-ink sm:text-xl">{year}년 {month}월</p>
            <button type="button" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))} aria-label="다음달" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-soft hover:bg-brand-beige-light press-scale">
              <ChevronRight size={19} />
            </button>
            <button type="button" onClick={() => setReportOpen(true)} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-red px-3 text-xs font-bold text-white press-scale sm:px-4 sm:text-sm">
              <Camera size={15} /> 공유
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 rounded-xl bg-brand-beige-light p-1">
            {([
              ['overview', '한눈에 보기'],
              ['details', '상세 입력'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => setViewMode(key)} className={`min-h-9 rounded-lg text-sm font-bold transition ${viewMode === key ? 'bg-white text-brand-red shadow-sm' : 'text-ink-faint'}`}>
                {label}
              </button>
            ))}
          </div>
        </Card>

        {isAdmin && (
          <button type="button" onClick={() => setExpenseImportOpen(true)} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-brand-red/15 bg-white px-4 text-left shadow-sm press-scale">
            <span className="flex items-center gap-2 text-sm font-bold text-ink"><ReceiptText size={18} className="text-brand-red" /> 지출내역 캡처 가져오기</span>
            <span className="text-xs font-semibold text-ink-faint">무료 브라우저 OCR</span>
          </button>
        )}

        <button
          type="button"
          onClick={isAdmin ? openTaxModal : undefined}
          className={`flex min-h-11 w-full items-center justify-between rounded-2xl border border-black/[0.05] bg-white px-4 text-left ${isAdmin ? 'press-scale' : ''}`}
        >
          <span className="text-xs font-semibold text-ink-faint">전월 세금예비금</span>
          <span className="flex items-center gap-2 text-sm font-bold tabular-nums text-ink">
            {won(current.taxReserve)}
            {isAdmin && <span className="text-[11px] text-brand-red">수정</span>}
          </span>
        </button>

        {viewMode === 'overview' ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {overviewCards.map((card) => (
                <Card key={card.label} padded={false} className="min-h-[118px] p-4 sm:min-h-[135px] sm:p-5">
                  <p className="text-xs font-bold text-ink-faint">{card.label}</p>
                  <p className={`mt-3 break-keep text-xl font-bold tabular-nums sm:text-2xl ${card.accent}`}>
                    {card.percent ? ratioText(card.value) : won(card.value)}
                  </p>
                  <div className="mt-1"><Trend current={card.value} previous={card.previous} /></div>
                </Card>
              ))}
            </div>

            <Card padded={false} className="overflow-hidden">
              <button type="button" onClick={() => setCostAnalysisOpen((open) => !open)} className="flex min-h-14 w-full items-center justify-between px-4 text-left sm:px-5">
                <span className="text-sm font-bold text-ink">비용 분석</span>
                <span className="flex items-center gap-2 text-xs font-semibold text-ink-faint">
                  원가 · 인건비 · 광고비
                  <ChevronDown size={17} className={`transition-transform ${costAnalysisOpen ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {costAnalysisOpen && (
                <div className="grid grid-cols-3 gap-2 border-t border-black/[0.05] p-3 sm:p-4">
                  {[
                    ['원가율', percent(totals.cost, current.sales), percent(previousTotals.food + previousTotals.drinks, previous.sales)],
                    ['인건비율', percent(totals.labor, current.sales), percent(previousTotals.labor, previous.sales)],
                    ['광고비율', percent(totals.ads, current.sales), percent(previousTotals.ads, previous.sales)],
                  ].map(([label, value, previousValue]) => (
                    <div key={String(label)} className="rounded-xl bg-brand-beige-light p-3 text-center">
                      <p className="text-[11px] font-semibold text-ink-faint">{label}</p>
                      <p className="mt-1 text-lg font-bold text-ink">{ratioText(Number(value))}</p>
                      <Trend current={Number(value)} previous={Number(previousValue)} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        ) : (
          <div className="space-y-3">
            <DetailAccordion title="매출" total={current.sales} currentTrend={current.sales} previousTrend={previous.sales} open={openSection === 'sales'} onToggle={() => toggleSection('sales')}>
              <label><span className="mb-2 block text-xs font-semibold text-ink-soft">총매출</span><MoneyInput value={current.sales} onChange={(sales) => update({ sales })} /></label>
            </DetailAccordion>

            <DetailAccordion title="원가" total={totals.cost} ratio={percent(totals.cost, current.sales)} currentTrend={totals.cost} previousTrend={previousTotals.food + previousTotals.drinks} open={openSection === 'cost'} onToggle={() => toggleSection('cost')}>
              <p className="mb-3 text-xs font-bold text-ink-faint">식자재</p>
              <CustomItemGrid values={current.food} defaultKeys={FOOD} canEdit={isAdmin} onChange={(key, value) => updateMap('food', key, value)} onEditItem={(key) => openEditItem('food', key)} onDeleteItem={(key) => setDeleteItem({ field: 'food', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('food')} />}
              <div className="my-5 h-px bg-black/[0.05]" />
              <p className="mb-3 text-xs font-bold text-ink-faint">주류·음료</p>
              <CustomItemGrid values={current.drinks} defaultKeys={DRINKS} canEdit={isAdmin} onChange={(key, value) => updateMap('drinks', key, value)} onEditItem={(key) => openEditItem('drinks', key)} onDeleteItem={(key) => setDeleteItem({ field: 'drinks', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('drinks')} />}
            </DetailAccordion>

            <DetailAccordion title="인건비" total={totals.labor} ratio={percent(totals.labor, current.sales)} currentTrend={totals.labor} previousTrend={previousTotals.labor} open={openSection === 'labor'} onToggle={() => toggleSection('labor')}>
              <p className="mb-3 text-xs font-bold text-ink-faint">정직원</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {FULL_TIME.map((name) => <label key={name}><span className="mb-1.5 block text-xs font-semibold text-ink-soft">{name}</span><MoneyInput value={current.labor[name] ?? 0} onChange={(value) => updateMap('labor', name, value)} /></label>)}
              </div>
              <div className="my-5 h-px bg-black/[0.05]" />
              <p className="mb-3 text-xs font-bold text-ink-faint">파트타임</p>
              <CustomItemGrid values={Object.fromEntries(Object.entries(current.labor).filter(([name]) => !FULL_TIME.includes(name)))} defaultKeys={[...FULL_TIME, ...employeeNames]} canEdit={isAdmin} onChange={(key, value) => updateMap('labor', key, value)} onEditItem={(key) => openEditItem('labor', key)} onDeleteItem={(key) => setDeleteItem({ field: 'labor', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('labor')} />}
            </DetailAccordion>

            <DetailAccordion title="고정비" total={totals.fixedCosts} ratio={percent(totals.fixedCosts, current.sales)} currentTrend={totals.fixedCosts} previousTrend={previousTotals.fixedCosts} open={openSection === 'fixedCosts'} onToggle={() => toggleSection('fixedCosts')}>
              <CustomItemGrid values={current.fixedCosts} defaultKeys={FIXED_COSTS} canEdit={isAdmin} onChange={(key, value) => updateMap('fixedCosts', key, value)} onEditItem={(key) => openEditItem('fixedCosts', key)} onDeleteItem={(key) => setDeleteItem({ field: 'fixedCosts', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('fixedCosts')} />}
            </DetailAccordion>

            <DetailAccordion title="광고비" total={totals.ads} ratio={percent(totals.ads, current.sales)} currentTrend={totals.ads} previousTrend={previousTotals.ads} open={openSection === 'ads'} onToggle={() => toggleSection('ads')}>
              <CustomItemGrid values={current.ads} defaultKeys={ADS} canEdit={isAdmin} onChange={(key, value) => updateMap('ads', key, value)} onEditItem={(key) => openEditItem('ads', key)} onDeleteItem={(key) => setDeleteItem({ field: 'ads', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('ads')} />}
            </DetailAccordion>

            <DetailAccordion title="기타비용" total={totals.operations} ratio={percent(totals.operations, current.sales)} currentTrend={totals.operations} previousTrend={previousTotals.operations} open={openSection === 'operations'} onToggle={() => toggleSection('operations')}>
              <CustomItemGrid values={current.operations} defaultKeys={OPERATIONS} canEdit={isAdmin} onChange={(key, value) => updateMap('operations', key, value)} onEditItem={(key) => openEditItem('operations', key)} onDeleteItem={(key) => setDeleteItem({ field: 'operations', key })} />
              {isAdmin && <AddItemButton onClick={() => openAddItem('operations')} />}
            </DetailAccordion>

            <DetailAccordion title="세금" total={current.taxReserve} currentTrend={current.taxReserve} previousTrend={previous.taxReserve} open={openSection === 'tax'} onToggle={() => toggleSection('tax')}>
              <button type="button" onClick={isAdmin ? openTaxModal : undefined} className="flex min-h-12 w-full items-center justify-between rounded-xl bg-brand-beige-light px-4 text-left">
                <span className="text-xs font-semibold text-ink-soft">전월 세금예비금</span>
                <span className="font-bold tabular-nums text-ink">{won(current.taxReserve)}</span>
              </button>
              <div className="mt-3 flex min-h-12 items-center justify-between rounded-xl bg-amber-50 px-4">
                <span className="text-xs font-semibold text-amber-800">3.3% 원천세 예수금 (비용 합계 제외)</span>
                <span className="font-bold tabular-nums text-amber-900">{won(current.withholdingPayable ?? 0)}</span>
              </div>
              <div className="mt-5">
                <h3 className="mb-3 text-sm font-bold text-ink">관리자 메모</h3>
                <Textarea value={current.memo} onChange={(event) => update({ memo: event.target.value })} placeholder={`${year}년 ${month}월 특이사항을 입력하세요.`} />
                <p className="text-right text-xs text-ink-faint">입력 내용은 월별로 자동 저장됩니다.</p>
              </div>
            </DetailAccordion>
          </div>
        )}

        <p className={`text-center text-xs font-semibold ${saveState === 'error' ? 'text-red-500' : 'text-ink-faint'}`}>
          {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '자동 저장됨' : saveState === 'error' ? '저장 실패' : ''}
        </p>
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

      <ExpenseImportModal open={expenseImportOpen} employees={employees} onClose={() => setExpenseImportOpen(false)} onApply={handleApplyExpenses} />

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
