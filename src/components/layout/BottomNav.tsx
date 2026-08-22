import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Coffee,
  Package,
  Users,
  Wallet,
  Clock,
  LogOut,
  UserCircle2,
  MoreHorizontal,
  ClipboardList,
  Megaphone,
  CreditCard,
  ChartNoAxesCombined,
  BadgePercent,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canAccess, canAccessTomorrowPrep, canManageNotices, canViewProfitLoss, type FeatureKey } from '@/utils/permission';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  feature: FeatureKey;
}

// 관리자 하단 기본(Primary) 탭 후보 - 대시보드/스케줄/휴무신청/발주관리/직원관리/급여관리 순서
const ADMIN_PRIMARY: NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard, feature: 'dashboard' },
  { to: '/schedule', label: '스케줄', icon: CalendarDays, feature: 'schedule' },
  { to: '/leave', label: '휴무신청', icon: Coffee, feature: 'leave' },
  { to: '/employee-discount', label: '직원할인', icon: BadgePercent, feature: 'employeeDiscount' },
  { to: '/order', label: '발주관리', icon: Package, feature: 'order' },
  { to: '/employee', label: '직원관리', icon: Users, feature: 'employee' },
  { to: '/payroll', label: '급여관리', icon: Wallet, feature: 'payroll' },
];

// 직원 모드(실제 직원 또는 관리자의 직원 모드 미리보기) - 대시보드/스케줄/휴무신청/근로시간/로그아웃 5개만 직접 노출
const EMPLOYEE_TABS: NavItem[] = [
  { to: '/dashboard', label: '대시보드', icon: LayoutDashboard, feature: 'dashboard' },
  { to: '/schedule', label: '스케줄', icon: CalendarDays, feature: 'schedule' },
  { to: '/leave', label: '휴무신청', icon: Coffee, feature: 'leave' },
  { to: '/worktime', label: '근로시간', icon: Clock, feature: 'worktime' },
];

const TOMORROW_PREP_TAB: NavItem = {
  to: '/tomorrow-prep',
  label: '내일 준비',
  icon: ClipboardList,
  feature: 'tomorrowPrep',
};

const NOTICES_TAB: NavItem = {
  to: '/notices',
  label: '공지사항',
  icon: Megaphone,
  feature: 'notices',
};

const PREPAYMENTS_TAB: NavItem = {
  to: '/prepayments',
  label: '선결제',
  icon: CreditCard,
  feature: 'prepayments',
};

const GRID_COLS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
  8: 'grid-cols-8',
  9: 'grid-cols-9',
};

export function BottomNav() {
  const { session, effectiveRole, enterStaffPreview, logout } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const isRealAdmin = session?.role === 'admin';
  const hasTomorrowPrepAccess = canAccessTomorrowPrep(session?.name);
  const hasNoticeManagementAccess = canManageNotices(session?.name);
  const hasProfitLossAccess = canViewProfitLoss(session?.name);

  // 직원 계열 화면: 매니저에게만 발주관리 탭을 추가합니다.
  if (effectiveRole === 'employee' || effectiveRole === 'manager') {
    const roleTabs =
      effectiveRole === 'manager'
        ? [...EMPLOYEE_TABS.slice(0, 3), ADMIN_PRIMARY[3], ...EMPLOYEE_TABS.slice(3)]
        : EMPLOYEE_TABS;
    let workerTabs = hasTomorrowPrepAccess
      ? [...roleTabs.slice(0, -1), TOMORROW_PREP_TAB, roleTabs.at(-1)!]
      : roleTabs;
    if (hasNoticeManagementAccess) {
      workerTabs = [...workerTabs.slice(0, -1), NOTICES_TAB, workerTabs.at(-1)!];
    }
    workerTabs = [...workerTabs.slice(0, -1), PREPAYMENTS_TAB, workerTabs.at(-1)!];
    const totalWorkerCols = workerTabs.length + 1;
    return (
      <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-surface/88 backdrop-blur-2xl border border-white/80 rounded-[22px] shadow-premium-lg pb-[env(safe-area-inset-bottom)] overflow-hidden">
        <div className={`grid ${GRID_COLS[totalWorkerCols] ?? 'grid-cols-6'}`}>
          {workerTabs.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold press-scale ${
                    isActive ? 'text-brand-red bg-brand-red-light/70' : 'text-ink-faint'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold press-scale text-ink-faint"
          >
            <LogOut size={18} strokeWidth={2} />
            로그아웃
          </button>
        </div>
      </nav>
    );
  }

  // 관리자 모드: 기존 primary 탭 + 더보기(근로시간/직원 모드 진입/로그아웃)
  const primary = ADMIN_PRIMARY.filter((item) => canAccess(effectiveRole, item.feature));
  const totalCols = primary.length + 1;

  return (
    <>
      {moreOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" />
          <div className="absolute bottom-[68px] inset-x-0 bg-surface rounded-t-card border-t border-border p-5 pb-7 animate-sheet-in shadow-premium-lg">
            <p className="text-xs font-semibold text-ink-faint px-2 pb-3">더보기</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setMoreOpen(false);
                  navigate('/worktime');
                }}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
              >
                <Clock size={21} className="text-ink" strokeWidth={2} />
                <span className="text-xs font-semibold text-ink">근로시간</span>
              </button>

              {isRealAdmin && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    enterStaffPreview();
                  }}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
                >
                  <UserCircle2 size={21} className="text-ink" strokeWidth={2} />
                  <span className="text-xs font-semibold text-ink">직원 모드</span>
                </button>
              )}

              {hasTomorrowPrepAccess && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/tomorrow-prep');
                  }}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
                >
                  <ClipboardList size={21} className="text-ink" strokeWidth={2} />
                  <span className="text-xs font-semibold text-ink">내일 준비</span>
                </button>
              )}

              <button
                onClick={() => { setMoreOpen(false); navigate('/employee-discount'); }}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
              >
                <BadgePercent size={21} className="text-ink" strokeWidth={2} />
                <span className="text-xs font-semibold text-ink">직원할인</span>
              </button>

              {hasNoticeManagementAccess && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/notices');
                  }}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
                >
                  <Megaphone size={21} className="text-ink" strokeWidth={2} />
                  <span className="text-xs font-semibold text-ink">공지사항</span>
                </button>
              )}

              {hasProfitLossAccess && (
                <button
                  onClick={() => {
                    setMoreOpen(false);
                    navigate('/profit-loss');
                  }}
                  className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
                >
                  <ChartNoAxesCombined size={21} className="text-ink" strokeWidth={2} />
                  <span className="text-xs font-semibold text-ink">손익계산서</span>
                </button>
              )}

              <button
                onClick={() => {
                  setMoreOpen(false);
                  navigate('/prepayments');
                }}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
              >
                <CreditCard size={21} className="text-ink" strokeWidth={2} />
                <span className="text-xs font-semibold text-ink">선결제</span>
              </button>

              <button
                onClick={() => {
                  setMoreOpen(false);
                  logout();
                }}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl hover:bg-brand-beige-light press-scale"
              >
                <LogOut size={21} className="text-status-rejected" strokeWidth={2} />
                <span className="text-xs font-semibold text-status-rejected">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      )}
      <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40 bg-surface/88 backdrop-blur-2xl border border-white/80 rounded-[22px] shadow-premium-lg pb-[env(safe-area-inset-bottom)] overflow-hidden">
        <div className={`grid ${GRID_COLS[totalCols] ?? 'grid-cols-6'}`}>
          {primary.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold press-scale ${
                    isActive ? 'text-brand-red bg-brand-red-light/70' : 'text-ink-faint'
                  }`
                }
              >
                <Icon size={18} strokeWidth={2} />
                {item.label}
              </NavLink>
            );
          })}
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className={`flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold press-scale ${
              moreOpen ? 'text-brand-red' : 'text-ink-faint'
            }`}
          >
            <MoreHorizontal size={18} strokeWidth={2} />
            더보기
          </button>
        </div>
      </nav>
    </>
  );
}
