import type { ReactNode } from 'react';
import { Card } from '@/components/common/Card';

export function SummaryCard({
  label,
  value,
  unit,
  accent = false,
  onClick,
  sub,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: boolean;
  onClick?: () => void;
  sub?: string;
}) {
  const isLongText = typeof value === 'string' && value.length > 6;
  return (
    <Card
      onClick={onClick}
      className={`${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
    >
      <p className="text-sm text-ink-soft mb-2">{label}</p>
      <p
        className={`font-bold leading-tight ${isLongText ? 'text-xl' : 'text-3xl leading-none'} ${
          accent ? 'text-brand-red' : 'text-ink'
        }`}
      >
        {value}
        {unit && <span className="text-base font-semibold ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-ink-faint mt-2">{sub}</p>}
    </Card>
  );
}
