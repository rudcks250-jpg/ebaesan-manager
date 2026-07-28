import type { ReactNode } from 'react';

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-3 px-1">
      <div>
        <h2 className="text-[17px] font-bold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
