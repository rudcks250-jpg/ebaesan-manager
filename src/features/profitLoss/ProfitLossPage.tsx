import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, TrendingDown, TrendingUp } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Textarea } from '@/components/common/Input';
import { employeeService } from '@/services/employeeService';
import type { Employee } from '@/data/types';

type AmountMap = Record<string, number>;

interface MonthlyProfitLoss {
  sales: number;
  food: AmountMap;
  drinks: AmountMap;
  labor: AmountMap;
  ads: AmountMap;
  operations: AmountMap;
  taxReserve: number;
  memo: string;
  updatedAt: string;
}

const STORAGE_KEY = 'ebaesan.profit-loss.v1';
const FULL_TIME = ['김경재', '박경찬', '김하은'];
const FOOD = ['축산유통', '식자재유통'];
const DRINKS = ['주류', '음료'];
const ADS = ['메타', '네이버', '리워드', '블로그리뷰', '기타'];
const OPERATIONS = [
  '카드값', '임대료', '전기세', '수도요금', '가스', '세무기장료',
  '음식물처리', '화재보험', '외식업협회비', '4대보험', '기타운영비',
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
    taxReserve: 0,
    memo: '',
    updatedAt: new Date().toISOString(),
  };
}

function loadAll(): Record<string, MonthlyProfitLoss> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, MonthlyProfitLoss>;
  } catch {
    return {};
  }
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

function MoneyInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        value={value ? value.toLocaleString('ko-KR') : ''}
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '')) || 0)}
        placeholder="0"
        className="min-h-11 w-full rounded-xl bg-brand-beige-light px-3 pr-8 text-right text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-brand-red/30"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint">원</span>
    </div>
  );
}

function ExpenseSection({
  title,
  values,
  sales,
  previousTotal,
  onChange,
}: {
  title: string;
  values: AmountMap;
  sales: number;
  previousTotal: number;
  onChange: (key: string, value: number) => void;
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
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(values).map(([label, value]) => (
          <label key={label}>
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>
            <MoneyInput value={value} onChange={(next) => onChange(label, next)} />
          </label>
        ))}
      </div>
    </Card>
  );
}

export function ProfitLossPage() {
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date()));
  const [allData, setAllData] = useState<Record<string, MonthlyProfitLoss>>(loadAll);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const current = allData[selectedMonth] ?? emptyMonth();
  const previous = allData[shiftMonth(selectedMonth, -1)] ?? emptyMonth();

  useEffect(() => {
    void employeeService.listActive().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    const names = employees.map((employee) => employee.name);
    setAllData((existing) => {
      const month = existing[selectedMonth] ?? emptyMonth(names);
      const labor = { ...emptyMap([...FULL_TIME, ...names.filter((name) => !FULL_TIME.includes(name))]), ...month.labor };
      if (existing[selectedMonth] && Object.keys(labor).length === Object.keys(month.labor).length) return existing;
      return { ...existing, [selectedMonth]: { ...month, labor } };
    });
  }, [employees, selectedMonth]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allData));
  }, [allData]);

  const totals = useMemo(() => {
    const food = sum(current.food);
    const drinks = sum(current.drinks);
    const labor = sum(current.labor);
    const ads = sum(current.ads);
    const operations = sum(current.operations);
    const cost = food + drinks;
    const operatingProfit = current.sales - cost - labor - ads - operations;
    const netProfit = operatingProfit - current.taxReserve;
    return { food, drinks, labor, ads, operations, cost, operatingProfit, netProfit };
  }, [current]);

  const previousTotals = useMemo(() => {
    const food = sum(previous.food);
    const drinks = sum(previous.drinks);
    const labor = sum(previous.labor);
    const ads = sum(previous.ads);
    const operations = sum(previous.operations);
    const cost = food + drinks;
    const operatingProfit = previous.sales - cost - labor - ads - operations;
    return { food, drinks, labor, ads, operations, operatingProfit, netProfit: operatingProfit - previous.taxReserve };
  }, [previous]);

  const update = (patch: Partial<MonthlyProfitLoss>) => {
    setAllData((existing) => ({
      ...existing,
      [selectedMonth]: { ...(existing[selectedMonth] ?? emptyMonth(employees.map((employee) => employee.name))), ...patch, updatedAt: new Date().toISOString() },
    }));
  };

  const updateMap = (field: 'food' | 'drinks' | 'labor' | 'ads' | 'operations', key: string, value: number) => {
    update({ [field]: { ...current[field], [key]: value } });
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const cards = [
    { label: '영업이익', value: totals.operatingProfit, previous: previousTotals.operatingProfit },
    { label: '영업이익률', value: percent(totals.operatingProfit, current.sales), previous: percent(previousTotals.operatingProfit, previous.sales), percent: true },
    { label: '원가율', value: percent(totals.cost, current.sales), previous: percent(previousTotals.food + previousTotals.drinks, previous.sales), percent: true },
    { label: '인건비율', value: percent(totals.labor, current.sales), previous: percent(previousTotals.labor, previous.sales), percent: true },
    { label: '광고비율', value: percent(totals.ads, current.sales), previous: percent(previousTotals.ads, previous.sales), percent: true },
    { label: '현재 순이익률', value: percent(totals.netProfit, current.sales), previous: percent(previousTotals.netProfit, previous.sales), percent: true },
  ];

  return (
    <Layout title="월 손익계산서">
      <div className="space-y-5">
        <Card className="sticky top-3 z-20">
          <div className="flex items-center justify-between gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}><ChevronLeft size={17} /> 이전달</Button>
            <p className="text-xl font-bold text-ink">{year}년 {month}월</p>
            <Button size="sm" variant="ghost" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>다음달 <ChevronRight size={17} /></Button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => {
              const source = allData[shiftMonth(selectedMonth, -1)];
              if (!source) return;
              update({ ...structuredClone(source), memo: source.memo });
            }} disabled={!allData[shiftMonth(selectedMonth, -1)]}>
              <span className="flex items-center gap-1"><Copy size={14} /> 이번 달 복사</span>
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

        <ExpenseSection title="식자재" values={current.food} sales={current.sales} previousTotal={previousTotals.food} onChange={(key, value) => updateMap('food', key, value)} />
        <ExpenseSection title="주류·음료" values={current.drinks} sales={current.sales} previousTotal={previousTotals.drinks} onChange={(key, value) => updateMap('drinks', key, value)} />

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
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(current.labor).filter((name) => !FULL_TIME.includes(name)).map((name) => <label key={name}><span className="mb-1.5 block text-xs font-semibold text-ink-soft">{name}</span><MoneyInput value={current.labor[name] ?? 0} onChange={(value) => updateMap('labor', name, value)} /></label>)}
          </div>
        </Card>

        <ExpenseSection title="광고비" values={current.ads} sales={current.sales} previousTotal={previousTotals.ads} onChange={(key, value) => updateMap('ads', key, value)} />
        <ExpenseSection title="운영비" values={current.operations} sales={current.sales} previousTotal={previousTotals.operations} onChange={(key, value) => updateMap('operations', key, value)} />

        <Card>
          <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-ink">빼놓은 세금</h2><p className="text-xl font-bold text-ink">{won(current.taxReserve)}</p></div>
          <div className="mt-5"><MoneyInput value={current.taxReserve} onChange={(taxReserve) => update({ taxReserve })} /></div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-bold text-ink">관리자 메모</h2>
          <Textarea value={current.memo} onChange={(event) => update({ memo: event.target.value })} placeholder={`${year}년 ${month}월 특이사항을 입력하세요.`} />
          <p className="text-right text-xs text-ink-faint">입력 내용은 월별로 자동 저장됩니다.</p>
        </Card>
      </div>
    </Layout>
  );
}
