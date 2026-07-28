import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Header({ title, showGreeting = true }: { title: string; showGreeting?: boolean }) {
  const { session, logout } = useAuth();

  return (
    <header className="sm:hidden sticky top-0 z-30 bg-bg/85 backdrop-blur-xl px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 flex items-center justify-between border-b border-black/[0.03]">
      <div>
        <p className="text-[28px] leading-tight font-bold text-ink tracking-[-0.035em]">{title}</p>
        {showGreeting && (
          <p className="text-xs text-ink-soft mt-1">
            {session?.name}님 · {session?.role === 'admin' ? '대표' : '직원'}
          </p>
        )}
      </div>
      <button
        onClick={logout}
        aria-label="로그아웃"
        className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border shadow-premium text-ink-soft hover:bg-brand-beige-light press-scale"
      >
        <LogOut size={18} />
      </button>
    </header>
  );
}
