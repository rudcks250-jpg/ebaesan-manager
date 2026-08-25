import { useEffect, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { NoticeCard } from '@/features/dashboard/NoticeCard';
import { LeaveStatusBadge } from '@/features/leave/LeaveStatusBadge';
import { WorkTimeEntryModal } from '@/features/worktime/WorkTimeEntryModal';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '@/services/dashboardService';
import { workTimeService } from '@/services/workTimeService';
import { leaveService } from '@/services/leaveService';
import { employeeService } from '@/services/employeeService';
import { vendorService } from '@/services/vendorService';
import { employeeDiscountService } from '@/services/employeeDiscountService';
import { MyPayrollCard } from '@/features/payroll/MyPayrollCard';
import { formatMonthDay, getWeekdayLabel, isToday, todayStr, WEEKDAY_LABELS_KO } from '@/utils/date';
import { ArrowRight, BadgePercent, CalendarCheck2, Clock3, Coffee, PackageCheck, Sparkles, TimerReset, Users } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

export function DashboardPage() {
  const { effectiveRole, effectiveEmployeeId } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  return (
    <Layout title="대시보드">
      {isAdmin ? <AdminDashboard /> : <StaffDashboard employeeId={effectiveEmployeeId!} />}
    </Layout>
  );
}

function AdminDashboard() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardService.getAdminDashboard>> | null>(null);
  const [recentLeaveRequests, setRecentLeaveRequests] = useState<Awaited<ReturnType<typeof leaveService.listAll>>>([]);
  const [employeeNameById, setEmployeeNameById] = useState<Map<string, string>>(new Map());
  const [vendors, setVendors] = useState<Awaited<ReturnType<typeof vendorService.list>>>([]);

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 (${WEEKDAY_LABELS_KO[today.getDay() === 0 ? 6 : today.getDay() - 1]})`;

  useEffect(() => {
    dashboardService.getAdminDashboard().then(setData);
    leaveService.listAll().then((all) => setRecentLeaveRequests(all.slice(0, 3)));
    employeeService.list().then((list) => {
      const map = new Map<string, string>();
      list.forEach((e) => map.set(e.id, e.name));
      setEmployeeNameById(map);
    });
  }, []);

  useEffect(() => {
    if (!session) return;
    const load = () => { void vendorService.list(session.employeeId).then(setVendors); };
    load();
    return vendorService.subscribe(load);
  }, [session]);

  const orderedCount = vendors.filter((v) => vendorService.isOrderedToday(v)).length;

  if (!data) return <p className="text-sm text-ink-faint text-center py-10">불러오는 중...</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <p className="text-ink-soft text-sm px-1 sm:col-span-2">{dateLabel}</p>

      <section className="hero-surface rounded-[28px] p-6 sm:p-8 sm:col-span-2 shadow-[0_26px_70px_-32px_rgba(8,35,74,.65)]">
        <div className="relative z-10 grid md:grid-cols-[1.25fr_.75fr] gap-8 items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 mb-5">
              <Sparkles size={13} /> Live Operations
            </div>
            <h2 className="text-3xl sm:text-[40px] leading-[1.08] font-bold tracking-[-.045em] max-w-xl">
              오늘의 매장 운영이<br />순조롭게 진행 중입니다.
            </h2>
            <p className="text-sm text-white/60 mt-4 max-w-md">
              {data.workingTodayCount}명이 근무 예정이며, {data.currentlyWorkingCount}명이 현재 근무 중입니다.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/schedule')} className="rounded-2xl bg-white/10 hover:bg-white/16 border border-white/10 p-4 text-left press-scale">
              <CalendarCheck2 size={20} className="mb-3 text-[#67B0FF]" />
              <span className="block text-sm font-semibold">스케줄 보기</span>
              <span className="text-[11px] text-white/50">이번 주 운영 계획</span>
            </button>
            <button onClick={() => navigate('/order')} className="rounded-2xl bg-white text-ink hover:-translate-y-0.5 p-4 text-left press-scale">
              <PackageCheck size={20} className="mb-3 text-brand-red" />
              <span className="block text-sm font-semibold">발주 확인</span>
              <span className="text-[11px] text-ink-faint">{orderedCount}/{vendors.length} 완료</span>
            </button>
          </div>
        </div>
      </section>

      <div className="sm:col-span-2 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="오늘 근무" value={`${data.workingTodayCount}명`} detail={`${data.currentlyWorkingCount}명 근무 중`} />
        <StatCard icon={Coffee} label="오늘 휴무" value={`${data.offTodayCount}명`} tone="orange" />
        <StatCard icon={TimerReset} label="시간 누락" value={`${data.missingWorkTimeCount}건`} tone={data.missingWorkTimeCount ? 'red' : 'green'} />
        <StatCard icon={Clock3} label="주간 예정" value={`${Math.round(data.weeklyScheduledMinutes / 60)}시간`} tone="green" />
      </div>

      {/* ① 오늘 근무 직원 */}
      <Card className="sm:row-span-2">
        <div className="flex items-center justify-between mb-4">
          <div><p className="font-bold text-ink">오늘의 타임라인</p><p className="text-xs text-ink-soft mt-1">출근 시간 순서</p></div>
          <div className="icon-well bg-brand-red-light text-brand-red"><Clock3 size={18} /></div>
        </div>
        {data.todayWorkingByTime.length === 0 ? (
          <p className="text-sm text-ink-faint">오늘 근무 예정 직원이 없습니다.</p>
        ) : (
          <div className="grouped-list">
            {data.todayWorkingByTime.map(({ employee, startTime, endTime }) => (
              <div key={employee.id} className="flex items-center justify-between text-sm py-3 first:pt-0">
                <div className="flex items-center gap-3"><span className="w-8 h-8 rounded-xl bg-brand-beige-light flex items-center justify-center font-bold text-brand-red">{employee.name.slice(0,1)}</span><span className="text-ink font-medium">{employee.name}</span></div>
                <span className="text-ink-soft tabular-num">
                  {startTime} ~ {endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ② 오늘 휴무 직원 */}
      <Card>
        <div className="flex items-center justify-between mb-4"><p className="font-bold text-ink">오늘 휴무 직원</p><Coffee size={18} className="text-status-pending" /></div>
        {data.todayOffEmployees.length === 0 ? (
          <p className="text-sm text-ink-faint">오늘 휴무인 직원이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.todayOffEmployees.map((e) => (
              <span key={e.id} className="text-sm font-medium text-ink bg-brand-beige-light rounded-full px-3 py-1.5">
                {e.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ③ 근무시간 미입력 직원 */}
      <Card hover onClick={() => navigate('/worktime')} className="cursor-pointer">
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-ink">근무시간 미입력 직원</p>
          {data.todayMissingWorkTimeEmployees.length > 0 && (
            <span className="text-xs font-bold text-status-rejected">{data.todayMissingWorkTimeEmployees.length}명</span>
          )}
        </div>
        {data.todayMissingWorkTimeEmployees.length === 0 ? (
          <p className="text-sm text-ink-faint">오늘 근무자 전원 입력을 완료했습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.todayMissingWorkTimeEmployees.map((e) => (
              <span key={e.id} className="text-sm font-medium text-status-rejected bg-status-rejected-bg rounded-full px-3 py-1.5">
                {e.name}
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* ④ 최근 휴무신청 */}
      <Card hover onClick={() => navigate('/leave')} className="cursor-pointer">
        <p className="font-bold text-ink mb-3">최근 휴무신청</p>
        {recentLeaveRequests.length === 0 ? (
          <p className="text-sm text-ink-faint">신청된 휴무가 없습니다.</p>
        ) : (
          <div className="space-y-2.5">
            {recentLeaveRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-ink font-medium">{employeeNameById.get(r.employeeId) ?? '알 수 없음'}</span>
                  <span className="text-ink-faint ml-1.5">
                    {formatMonthDay(r.requestedDate)} ({getWeekdayLabel(r.requestedDate)})
                  </span>
                </div>
                <LeaveStatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ⑤ 오늘 발주 체크 */}
      <Card hover onClick={() => navigate('/order')} className="cursor-pointer bg-gradient-to-br from-white to-brand-red-light/50">
        <div className="flex items-center justify-between mb-3"><p className="font-bold text-ink">오늘 발주 체크</p><ArrowRight size={17} className="text-brand-red" /></div>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold text-ink">
            {orderedCount}
            <span className="text-sm font-semibold text-ink-faint ml-1">/ {vendors.length}거래처 완료</span>
          </p>
        </div>
      </Card>

    </div>
  );
}

function StaffDashboard({ employeeId }: { employeeId: string }) {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardService.getStaffDashboard>> | null>(null);
  const [todayRecord, setTodayRecord] = useState<Awaited<ReturnType<typeof workTimeService.get>>>(undefined);
  const [discountSummary, setDiscountSummary] = useState<{ monthlyLimit: number; remaining: number } | null>(null);
  const today = todayStr();

  useEffect(() => {
    dashboardService.getStaffDashboard(employeeId).then(setData);
    workTimeService.get(employeeId, today).then(setTodayRecord);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    employeeDiscountService
      .getMine(employeeId, month)
      .then(({ requests, setting }) => {
        const monthlyLimit = setting.monthlyLimit;
        const usedCount = requests.filter((request) => request.status === 'completed').length;
        setDiscountSummary({ monthlyLimit, remaining: Math.max(0, monthlyLimit - usedCount) });
      })
      .catch((error) => {
        console.error('[Dashboard] employee discount summary failed', error);
        setDiscountSummary(null);
      });
  }, [employeeId, today, refreshKey]);

  if (!data) return <p className="text-sm text-ink-faint text-center py-10">불러오는 중...</p>;

  const todayShiftText =
    data.todayShift?.status === 'working' && data.todayShift.startTime && data.todayShift.endTime
      ? `${data.todayShift.startTime}~${data.todayShift.endTime}`
      : data.todayShift?.status === 'off' || data.todayShift?.status === 'leaveApproved'
        ? '휴무'
        : '스케줄 없음';

  return (
    <div className="space-y-4">
      {/* 앱을 열면 가장 먼저 확인하는 공지사항 */}
      <NoticeCard />

      {/* ① 오늘 근무 */}
      <Card>
        <p className="text-sm text-ink-soft mb-1">오늘 근무</p>
        <p className="text-3xl font-bold text-ink mb-4">{todayShiftText}</p>
        {/* 근로시간 탭과 동일한 오늘 기록을 직접 입력/수정 */}
        <button
          onClick={() => setEntryModalOpen(true)}
          className="w-full text-sm font-semibold text-brand-red mt-3 press-scale"
        >
          {todayRecord ? '오늘 근무 수정' : '오늘 근무 입력'}
        </button>
      </Card>

      {/* 모바일 직원이 하단 메뉴를 늘리지 않고 바로 들어갈 수 있는 직원할인 진입점 */}
      <Card
        hover
        onClick={() => navigate('/employee-discount')}
        className="cursor-pointer border-brand-red/10 bg-gradient-to-r from-white to-brand-red-light/45"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-red-light text-brand-red">
            <BadgePercent size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">직원 할인</p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {discountSummary
                ? `이번 달 ${discountSummary.monthlyLimit}회 중 ${discountSummary.remaining}회 남음`
                : '이번 달 할인 혜택 확인하기'}
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-brand-red" />
        </div>
      </Card>

      {entryModalOpen && (
        <WorkTimeEntryModal
          open
          onClose={() => setEntryModalOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          employeeId={employeeId}
          date={today}
          existing={todayRecord}
          scheduleShift={data.todayShift}
          editedBy={employeeId}
        />
      )}

      {/* ② 이번주 스케줄 - 작은 미리보기 */}
      <Card>
        <p className="font-bold text-ink mb-3">이번주 스케줄</p>
        <div className="grid grid-cols-7 gap-1.5">
          {data.weekDates.map((d) => {
            const shift = data.weekShifts.find((s) => s.date === d);
            const working = shift?.status === 'working' && shift.startTime && shift.endTime;
            const today = isToday(d);
            return (
              <div
                key={d}
                className={`rounded-control py-2 text-center ${today ? 'bg-brand-red-light' : 'bg-brand-beige-light'}`}
              >
                <p className={`text-[10px] font-semibold ${today ? 'text-brand-red' : 'text-ink-faint'}`}>
                  {getWeekdayLabel(d)}
                </p>
                <p className={`text-[10px] font-bold mt-0.5 ${working ? 'text-status-working' : 'text-ink-faint'}`}>
                  {working ? shift!.startTime!.slice(0, 2) : '휴'}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 내 급여 현황 - 본인 급여일 기준 현재 진행 중인 기간 */}
      <MyPayrollCard employeeId={employeeId} refreshKey={refreshKey} />

      {/* ③ 남은 휴무 (최근 신청 현황) */}
      <Card>
        <p className="font-bold text-ink mb-3">휴무 신청 현황</p>
        {data.latestLeaveRequest ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">
                {formatMonthDay(data.latestLeaveRequest.requestedDate)} (
                {getWeekdayLabel(data.latestLeaveRequest.requestedDate)})
              </p>
              <p className="text-xs text-ink-soft mt-0.5">{data.latestLeaveRequest.reason}</p>
            </div>
            <LeaveStatusBadge status={data.latestLeaveRequest.status} />
          </div>
        ) : (
          <p className="text-sm text-ink-faint">신청한 휴무가 없습니다.</p>
        )}
      </Card>

      {/* ⑤⑥ 바로가기 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate('/leave')}
          className="bg-surface border border-border rounded-card p-4 text-left press-scale shadow-premium"
        >
          <p className="text-sm font-bold text-ink">휴무신청</p>
          <p className="text-xs text-ink-faint mt-0.5">바로가기 →</p>
        </button>
        <button
          onClick={() => navigate('/worktime')}
          className="bg-surface border border-border rounded-card p-4 text-left press-scale shadow-premium"
        >
          <p className="text-sm font-bold text-ink">근무시간 입력</p>
          <p className="text-xs text-ink-faint mt-0.5">바로가기 →</p>
        </button>
      </div>
    </div>
  );
}
