import { forwardRef, type ReactNode } from 'react';

type AmountMap = Record<string, number>;

const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif';
const INK = '#191F28';
const SOFT = '#6B7684';
const FAINT = '#8B95A1';
const BLUE = '#3182F6';
const BLUE_LIGHT = '#EAF3FF';
const GREEN = '#16A36A';
const RED = '#E5484D';
const SURFACE = '#F7F8FA';
const BORDER = '#E5E8EB';

export interface ProfitLossReportProps {
  companyName: string;
  year: number;
  month: number;
  sales: number;
  foodItems: AmountMap;
  drinksItems: AmountMap;
  laborItems: AmountMap;
  adsItems: AmountMap;
  operationsItems: AmountMap;
  fixedCostsItems: AmountMap;
  taxReserve: number;
  operatingProfit: number;
  finalOperatingProfit: number;
  memo: string;
  previous: {
    sales: number;
    food: number;
    drinks: number;
    cost: number;
    labor: number;
    ads: number;
    operations: number;
    fixedCosts: number;
    operatingProfit: number;
    finalOperatingProfit: number;
  };
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

function ratio(value: number): string {
  return `${value.toFixed(1)}%`;
}

function trend(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? '전월 동일' : '전월 비교 없음';
  const value = ((current - previous) / Math.abs(previous)) * 100;
  return `${value >= 0 ? '▲ +' : '▼ '}${value.toFixed(1)}%`;
}

function ReportPage({
  page,
  title,
  subtitle,
  children,
}: {
  page: number;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section
      data-profit-report-page
      data-page-number={page}
      style={{
        width: 680,
        boxSizing: 'border-box',
        padding: '34px 34px 28px',
        background: '#FFFFFF',
        color: INK,
        fontFamily: FONT,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: 18, borderBottom: `1px solid ${BORDER}` }}>
        <div>
          <p style={{ margin: 0, color: SOFT, fontSize: 13, fontWeight: 700 }}>이배산 숯불구이 월 손익 보고</p>
          <h2 style={{ margin: '6px 0 0', fontSize: 25, lineHeight: 1.25, letterSpacing: '-0.03em' }}>{title}</h2>
          <p style={{ margin: '6px 0 0', color: BLUE, fontSize: 14, fontWeight: 700 }}>{subtitle}</p>
        </div>
        <span style={{ color: FAINT, fontSize: 12, fontWeight: 700 }}>{page} / 4</span>
      </header>
      <div style={{ paddingTop: 22 }}>{children}</div>
      <footer style={{ marginTop: 24, paddingTop: 14, borderTop: `1px solid ${BORDER}`, color: FAINT, fontSize: 10, textAlign: 'right' }}>
        이배산 숯불구이 · 내부 보고용
      </footer>
    </section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 20, padding: '18px 20px', border: `1px solid ${BORDER}`, borderRadius: 18, background: '#FFFFFF' }}>
      <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{title}</h3>
      {children}
    </div>
  );
}

function MoneyRows({ values, totalLabel = '합계', sales, previousTotal }: { values: AmountMap; totalLabel?: string; sales: number; previousTotal?: number }) {
  const total = sum(values);
  return (
    <>
      {Object.entries(values).map(([label, value]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, minHeight: 31, color: SOFT, fontSize: 13 }}>
          <span>{label}</span>
          <strong style={{ color: INK, fontSize: 14, whiteSpace: 'nowrap' }}>{won(value)}</strong>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 12, borderTop: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>{totalLabel}</span>
        <span style={{ textAlign: 'right' }}>
          <strong style={{ display: 'block', color: BLUE, fontSize: 18 }}>{won(total)}</strong>
          <small style={{ color: FAINT, fontSize: 11 }}>매출 대비 {ratio(percent(total, sales))}</small>
          {previousTotal !== undefined && <small style={{ display: 'block', marginTop: 2, color: FAINT, fontSize: 10 }}>전월 대비 {trend(total, previousTotal)}</small>}
        </span>
      </div>
    </>
  );
}

function Kpi({ label, value, note, tone = INK }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div style={{ minHeight: 92, boxSizing: 'border-box', padding: '16px 17px', borderRadius: 16, background: SURFACE }}>
      <p style={{ margin: 0, color: FAINT, fontSize: 11, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: '7px 0 0', color: tone, fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em', whiteSpace: 'nowrap' }}>{value}</p>
      {note && <p style={{ margin: '5px 0 0', color: note.startsWith('▼') ? RED : note.startsWith('▲') ? GREEN : FAINT, fontSize: 10, fontWeight: 700 }}>{note}</p>}
    </div>
  );
}

export const ProfitLossReport = forwardRef<HTMLDivElement, ProfitLossReportProps>(function ProfitLossReport(props, ref) {
  const {
    companyName, year, month, sales, foodItems, drinksItems, laborItems, adsItems,
    operationsItems, fixedCostsItems, taxReserve, operatingProfit, finalOperatingProfit,
    memo, previous,
  } = props;
  const food = sum(foodItems);
  const drinks = sum(drinksItems);
  const cost = food + drinks;
  const labor = sum(laborItems);
  const ads = sum(adsItems);
  const operations = sum(operationsItems);
  const fixedCosts = sum(fixedCostsItems);
  const totalExpenses = cost + labor + ads + operations + fixedCosts;
  const subtitle = `${year}년 ${month}월 손익계산서`;

  return (
    <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, background: SURFACE }}>
      <ReportPage page={1} title={`${year}년 ${month}월 손익계산서`} subtitle={`${companyName} · 핵심 요약`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 20 }}>
          <Kpi label="총매출" value={won(sales)} note={trend(sales, previous.sales)} tone={BLUE} />
          <Kpi label="총비용" value={won(totalExpenses)} />
          <Kpi label="최종 영업이익" value={won(finalOperatingProfit)} note={trend(finalOperatingProfit, previous.finalOperatingProfit)} tone={finalOperatingProfit >= 0 ? GREEN : RED} />
          <Kpi label="영업이익률" value={ratio(percent(finalOperatingProfit, sales))} tone={finalOperatingProfit >= 0 ? GREEN : RED} />
          <Kpi label="원가율" value={ratio(percent(cost, sales))} note={trend(cost, previous.cost)} />
          <Kpi label="인건비율" value={ratio(percent(labor, sales))} note={trend(labor, previous.labor)} />
          <Kpi label="광고비율" value={ratio(percent(ads, sales))} note={trend(ads, previous.ads)} />
          <Kpi label="전월 세금대비금" value={won(taxReserve)} />
        </div>
        <Section title="손익 요약">
          <MoneyRows values={{ '총 원가': cost, '인건비': labor, '광고비': ads, '운영비': operations, '고정비': fixedCosts }} totalLabel="총비용" sales={sales} />
          <div style={{ marginTop: 14, padding: '15px 16px', borderRadius: 14, background: BLUE_LIGHT, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>최종 영업이익</span>
            <strong style={{ color: BLUE, fontSize: 19 }}>{won(finalOperatingProfit)}</strong>
          </div>
        </Section>
      </ReportPage>

      <ReportPage page={2} title="매출·원가 상세" subtitle={subtitle}>
        <Section title="총매출">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: SOFT, fontSize: 14 }}>해당 월 총매출</span>
            <strong style={{ color: BLUE, fontSize: 24 }}>{won(sales)}</strong>
          </div>
          <p style={{ margin: '8px 0 0', color: FAINT, fontSize: 11 }}>전월 대비 {trend(sales, previous.sales)}</p>
        </Section>
        <Section title="식자재 상세"><MoneyRows values={foodItems} sales={sales} previousTotal={previous.food} /></Section>
        <Section title="주류·음료 상세"><MoneyRows values={drinksItems} sales={sales} previousTotal={previous.drinks} /></Section>
        <div style={{ padding: '17px 20px', borderRadius: 16, background: BLUE_LIGHT, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><p style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>총 원가</p><p style={{ margin: '4px 0 0', color: FAINT, fontSize: 11 }}>원가율 {ratio(percent(cost, sales))}</p></div>
          <strong style={{ color: BLUE, fontSize: 22 }}>{won(cost)}</strong>
        </div>
      </ReportPage>

      <ReportPage page={3} title="인건비·광고비 상세" subtitle={subtitle}>
        <Section title="인건비 상세"><MoneyRows values={laborItems} sales={sales} previousTotal={previous.labor} /></Section>
        <Section title="광고비 상세"><MoneyRows values={adsItems} sales={sales} previousTotal={previous.ads} /></Section>
      </ReportPage>

      <ReportPage page={4} title="운영비·월 마감" subtitle={subtitle}>
        <Section title="운영비 상세"><MoneyRows values={operationsItems} sales={sales} previousTotal={previous.operations} /></Section>
        <Section title="고정비 상세"><MoneyRows values={fixedCostsItems} sales={sales} previousTotal={previous.fixedCosts} /></Section>
        <Section title="월 마감 참고">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Kpi label="세금대비금 반영 전 영업이익" value={won(operatingProfit)} note={trend(operatingProfit, previous.operatingProfit)} />
            <Kpi label="전월 세금대비금" value={won(taxReserve)} />
          </div>
          <div style={{ marginTop: 12, padding: '16px 18px', borderRadius: 15, background: BLUE_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 800 }}>최종 영업이익</span>
            <strong style={{ color: BLUE, fontSize: 21 }}>{won(finalOperatingProfit)}</strong>
          </div>
        </Section>
        <Section title="관리자 메모">
          <p style={{ minHeight: 58, margin: 0, color: memo.trim() ? INK : FAINT, fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {memo.trim() || '등록된 메모가 없습니다.'}
          </p>
        </Section>
      </ReportPage>
    </div>
  );
});
