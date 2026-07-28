import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthNavProps {
  year: number;
  month: number; // 1~12
  onChange: (year: number, month: number) => void;
}

// 모든 캘린더 화면(근로시간 등)에서 공통으로 사용하는 월 이동 컴포넌트입니다.
// 연도가 항상 함께 표시되며, 12월/1월 경계에서 연도가 자동으로 넘어갑니다.
export function MonthNav({ year, month, onChange }: MonthNavProps) {
  const goPrev = () => {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  };

  const goNext = () => {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  };

  const goToday = () => {
    const now = new Date();
    onChange(now.getFullYear(), now.getMonth() + 1);
  };

  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        onClick={goPrev}
        aria-label="이전 달"
        className="w-10 h-10 shrink-0 rounded-xl bg-surface border border-border shadow-premium flex items-center justify-center text-ink-soft hover:bg-brand-beige-light press-scale"
      >
        <ChevronLeft size={18} />
      </button>

      <p className="font-bold text-ink text-lg sm:text-xl tracking-tight text-center">
        {year}년 {month}월
      </p>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={goNext}
          aria-label="다음 달"
          className="w-10 h-10 rounded-xl bg-surface border border-border shadow-premium flex items-center justify-center text-ink-soft hover:bg-brand-beige-light press-scale"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={goToday}
          disabled={isCurrentMonth}
          className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-surface border border-border shadow-premium text-ink-soft hover:bg-brand-beige-light disabled:opacity-40 disabled:cursor-default"
        >
          오늘
        </button>
      </div>
    </div>
  );
}
