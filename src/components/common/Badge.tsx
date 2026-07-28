import type { ReactNode } from 'react';

export type BadgeTone =
  | 'working'
  | 'off'
  | 'leave'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  working: 'bg-status-working-bg text-status-working',
  off: 'bg-status-off-bg text-status-off',
  leave: 'bg-status-leave-bg text-status-leave',
  pending: 'bg-status-pending-bg text-status-pending',
  approved: 'bg-status-approved-bg text-status-approved',
  rejected: 'bg-status-rejected-bg text-status-rejected',
  neutral: 'bg-brand-beige-light text-ink-soft',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
