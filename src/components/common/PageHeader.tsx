import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({ title, description, action, icon: Icon }: {
  title: string; description?: string; action?: ReactNode; icon?: LucideIcon;
}) {
  return (
    <div className="hidden sm:flex items-center justify-between gap-6 mb-10">
      <div className="flex items-center gap-4">
        {Icon && <div className="w-12 h-12 rounded-2xl bg-surface shadow-premium border border-white flex items-center justify-center text-brand-red"><Icon size={23} strokeWidth={2.1} /></div>}
        <div>
          <p className="text-[11px] uppercase tracking-[.13em] font-bold text-brand-red mb-1.5">Restaurant OS</p>
          <h1 className="text-[36px] leading-none font-bold tracking-[-0.045em] text-ink">{title}</h1>
          {description && <p className="text-sm text-ink-soft mt-2.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
