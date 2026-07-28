export function Spinner({ label = '불러오는 중...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <div className="w-8 h-8 rounded-full border-[3px] border-brand-beige border-t-brand-red animate-spin" />
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
