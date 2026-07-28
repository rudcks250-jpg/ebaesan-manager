import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div title={icon} className="w-12 h-12 rounded-2xl bg-brand-beige-light text-ink-faint flex items-center justify-center mb-4">
        <Inbox size={22} />
      </div>
      <p className="text-ink font-semibold">{title}</p>
      {description && <p className="text-ink-soft text-sm mt-1.5">{description}</p>}
    </div>
  );
}
