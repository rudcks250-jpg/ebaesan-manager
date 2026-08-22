import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { SideNav } from '@/components/layout/SideNav';
import { BottomNav } from '@/components/layout/BottomNav';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { BadgePercent, CalendarDays, ChartNoAxesCombined, ClipboardList, Clock3, Coffee, CreditCard, LayoutDashboard, Megaphone, Package, Users, WalletCards } from 'lucide-react';

const PAGE_META = {
  '대시보드': { description: '매장의 오늘을 한눈에 보고, 다음 행동에 집중하세요.', icon: LayoutDashboard },
  '직원관리': { description: '팀의 상태, 일정, 급여 정보를 하나의 디렉토리에서 관리하세요.', icon: Users },
  '스케줄': { description: '한 주의 인력을 균형 있게 계획하고 빠르게 조정하세요.', icon: CalendarDays },
  '휴무신청': { description: '휴무 요청과 승인 흐름을 명확하게 관리하세요.', icon: Coffee },
  '휴무관리': { description: '휴무 요청과 승인 흐름을 명확하게 관리하세요.', icon: Coffee },
  '발주관리': { description: '오늘 필요한 주문을 놓치지 않고 마무리하세요.', icon: Package },
  '직원할인': { description: '이번 달 직원 식사 할인 혜택을 빠르게 요청하고 처리하세요.', icon: BadgePercent },
  '내일 해야 할 것': { description: '다음 오픈 준비를 함께 확인하고 빠짐없이 마무리하세요.', icon: ClipboardList },
  '공지사항': { description: '매장 공지를 작성하고 직원 확인 현황을 관리하세요.', icon: Megaphone },
  '선결제 관리': { description: '회사별 선결제 잔액과 사용 내역을 정확하게 관리하세요.', icon: CreditCard },
  '월 손익계산서': { description: '월별 매출과 비용을 입력하고 매장의 수익성을 한눈에 확인하세요.', icon: ChartNoAxesCombined },
  '급여관리': { description: '근무 기록에서 정산까지 투명하게 확인하세요.', icon: WalletCards },
  '급여명세': { description: '직원별 근무와 지급 내역을 자세히 확인하세요.', icon: WalletCards },
  '근로시간': { description: '출퇴근과 누적 근무시간을 정확하게 기록하세요.', icon: Clock3 },
};

export function Layout({ title, children, showGreeting = true }: { title: string; children: ReactNode; showGreeting?: boolean }) {
  const location = useLocation();
  const { isStaffPreview, exitStaffPreview } = useAuth();

  return (
    <div className="app-canvas min-h-screen flex bg-transparent">
      <SideNav />
      <div className="flex-1 min-w-0">
        {isStaffPreview && (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold bg-ink text-white">
            <span>현재 직원 모드로 보고 있습니다.</span>
            <button
              onClick={exitStaffPreview}
              className="shrink-0 rounded-full bg-white/20 px-3 py-1.5 press-scale hover:bg-white/30"
            >
              관리자 모드로 돌아가기
            </button>
          </div>
        )}
        <Header title={title} showGreeting={showGreeting} />
        <main className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 sm:py-11 pb-28 sm:pb-16">
          <PageHeader title={title} description={PAGE_META[title as keyof typeof PAGE_META]?.description} icon={PAGE_META[title as keyof typeof PAGE_META]?.icon} />
          <div key={location.pathname} className="animate-page-fade">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
