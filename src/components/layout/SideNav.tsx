import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Coffee, Package, Users, Wallet, Clock, LogOut, UserCircle2, Flame, Settings, BellRing } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canAccess, type FeatureKey } from '@/utils/permission';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature: FeatureKey;
}

// 최종 순서: 대시보드, 스케줄, 휴무신청, 발주관리, 직원관리, 급여관리, 근로시간
const ALL_ITEMS: NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard, feature: 'dashboard' },
  { to: '/schedule', label: '스케줄', icon: CalendarDays, feature: 'schedule' },
  { to: '/leave', label: '휴무신청', icon: Coffee, feature: 'leave' },
  { to: '/order', label: '발주관리', icon: Package, feature: 'order' },
  { to: '/employee', label: '직원관리', icon: Users, feature: 'employee' },
  { to: '/payroll', label: '급여관리', icon: Wallet, feature: 'payroll' },
  { to: '/worktime', label: '근로시간', icon: Clock, feature: 'worktime' },
  { to: '/settings', label: '알림 설정', icon: Settings, feature: 'settings' },
  { to: '/notifications', label: '알림 관리', icon: BellRing, feature: 'notifications' },
];

export function SideNav() {
  const { session, effectiveRole, isStaffPreview, enterStaffPreview, logout } = useAuth();
  const items = ALL_ITEMS.filter((item) => canAccess(effectiveRole, item.feature));
  const isRealAdmin = session?.role === 'admin';
  const operationItems = items.filter((item) => ['/dashboard', '/schedule', '/leave', '/order'].includes(item.to));
  const managementItems = items.filter((item) => !operationItems.includes(item));
  const renderItems = (group: NavItem[]) => group.map((item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        className={({ isActive }) =>
          `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-200 press-scale ${
            isActive
              ? 'bg-brand-red text-white shadow-[0_7px_18px_-10px_rgba(0,122,255,.8)]'
              : 'text-ink-soft hover:bg-white hover:text-ink hover:shadow-premium'
          }`
        }
      >
        <Icon size={18} strokeWidth={2} className="transition-transform duration-200 group-hover:scale-105" />
        {item.label}
      </NavLink>
    );
  });

  return (
    <aside className="hidden sm:flex flex-col w-[272px] shrink-0 border-r border-black/[0.05] bg-surface/80 backdrop-blur-xl min-h-screen px-4 py-6 sticky top-0 h-screen">
      <div className="px-3 mb-8 flex items-center gap-3">
        <div className="w-10 h-10 rounded-[13px] bg-gradient-to-b from-[#248CFF] to-brand-red text-white flex items-center justify-center shadow-[0_7px_18px_-7px_rgba(0,122,255,.8)]">
          <Flame size={20} fill="currentColor" />
        </div>
        <div>
          <p className="whitespace-nowrap text-[15px] font-bold text-ink tracking-[-0.02em]">이배산 숯불구이</p>
          <p className="text-[11px] text-ink-faint mt-0.5">Restaurant Operations</p>
        </div>
      </div>

      {isStaffPreview && (
        <div className="mb-4 rounded-2xl bg-ink px-3 py-2.5 text-xs font-semibold text-white">
          현재 직원 모드입니다.
        </div>
      )}

      <nav className="flex flex-col grow">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Operations</p>
        <div className="flex flex-col gap-1">{renderItems(operationItems)}</div>
        {managementItems.length > 0 && <>
          <div className="h-px bg-black/[0.055] mx-3 my-5" />
          <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">Team & Finance</p>
          <div className="flex flex-col gap-1">{renderItems(managementItems)}</div>
        </>}
      </nav>

      <div className="glass-surface rounded-[20px] p-3 mt-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-brand-beige-light flex items-center justify-center text-sm font-bold text-brand-red">{session?.name?.slice(0, 1)}</div>
          <div>
        <p className="text-sm font-semibold text-ink">{session?.name}</p>
        <p className="text-[11px] text-ink-soft">
          {session?.role === 'admin' ? '대표' : session?.role === 'manager' ? '매니저' : '직원'}
        </p>
          </div>
        </div>

        {isRealAdmin && !isStaffPreview && (
          <button
            onClick={enterStaffPreview}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-brand-red press-scale mb-2.5"
          >
            <UserCircle2 size={13} />
            직원 모드로 보기
          </button>
        )}

        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-status-rejected hover:bg-status-rejected-bg rounded-xl py-2 press-scale"
        >
          <LogOut size={13} />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
