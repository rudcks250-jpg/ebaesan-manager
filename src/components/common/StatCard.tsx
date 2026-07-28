import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/common/Card';

export function StatCard({ label, value, detail, icon: Icon, tone = 'blue' }: {
  label: string; value: string; detail?: string; icon: LucideIcon; tone?: 'blue' | 'green' | 'orange' | 'red';
}) {
  const tones = {
    blue: 'bg-brand-red-light text-brand-red', green: 'bg-status-working-bg text-status-working',
    orange: 'bg-status-pending-bg text-status-pending', red: 'bg-status-rejected-bg text-status-rejected',
  };
  return (
    <Card hover className="min-h-[154px] flex flex-col justify-between relative overflow-hidden">
      <div className={`card-icon w-10 h-10 rounded-[14px] flex items-center justify-center ${tones[tone]}`}><Icon size={19} strokeWidth={2.2} /></div>
      <div className={`absolute -right-5 -top-5 w-24 h-24 rounded-full opacity-40 blur-2xl ${tones[tone].split(' ')[0]}`} />
      <div className="mt-6 relative">
        <p className="text-[27px] leading-none font-bold tracking-[-.035em] tabular-num text-ink">{value}</p>
        <p className="text-sm font-medium text-ink-soft mt-1">{label}</p>
        {detail && <p className="text-[11px] text-ink-faint mt-1">{detail}</p>}
      </div>
    </Card>
  );
}
