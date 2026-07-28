import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { MonthNav } from '@/components/common/MonthNav';
import { payrollService } from '@/services/payrollService';
import { ArrowUpRight, BadgeCheck, CircleDollarSign } from 'lucide-react';

export function PayrollListPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const navigate = useNavigate();

  const [summary, setSummary] = useState<Awaited<ReturnType<typeof payrollService.getMonthlyPayroll>> | null>(null);

  useEffect(() => {
    payrollService.getMonthlyPayroll(year, month).then(setSummary);
  }, [year, month]);

  if (!summary) {
    return (
      <Layout title="급여관리">
        <p className="text-sm text-ink-faint text-center py-10">불러오는 중...</p>
      </Layout>
    );
  }

  return (
    <Layout title="급여관리">
      <div className="space-y-5">
        <section className="hero-surface rounded-[28px] p-6 sm:p-8 shadow-[0_26px_70px_-32px_rgba(8,35,74,.65)]">
          <div className="relative z-10 flex items-end justify-between gap-6">
            <div>
              <div className="icon-well bg-white/10 text-[#67B0FF] mb-5"><CircleDollarSign size={20} /></div>
              <p className="text-sm text-white/55">이번 달 총 인건비</p>
              <p className="text-3xl sm:text-[42px] leading-none font-bold tracking-[-.04em] mt-2 tabular-num">{summary.totalLaborCost.toLocaleString()}원</p>
              <p className="text-xs text-white/45 mt-4">{summary.rows.length}명의 급여 내역을 기준으로 계산되었습니다.</p>
            </div>
            <div className="hidden sm:flex items-center gap-2 rounded-2xl bg-white/10 border border-white/10 px-4 py-3">
              <BadgeCheck size={18} className="text-status-working" />
              <div><p className="text-xs text-white/50">정산 진행률</p><p className="font-bold">{summary.settledCount}/{summary.rows.length} 완료</p></div>
            </div>
          </div>
        </section>
        <MonthNav year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-white to-brand-red-light/50">
            <p className="text-xs text-ink-soft mb-1.5">총 인건비</p>
            <p className="text-2xl font-bold text-ink tabular-num">{summary.totalLaborCost.toLocaleString()}원</p>
          </Card>
          <Card>
            <p className="text-xs text-ink-soft mb-1.5">정산 완료</p>
            <p className="text-2xl font-bold text-status-working">{summary.settledCount}명</p>
          </Card>
          <Card>
            <p className="text-xs text-ink-soft mb-1.5">미정산</p>
            <p className="text-2xl font-bold text-status-rejected">{summary.unsettledCount}명</p>
          </Card>
        </div>

        {summary.rows.length === 0 ? (
          <p className="text-sm text-ink-faint text-center py-10">해당 월에 재직 중인 직원이 없습니다.</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {summary.rows.map((row) => (
              <Card
                key={row.employee.id}
                hover
                onClick={() => navigate(`/payroll/${row.employee.id}?year=${year}&month=${month}`)}
                className="cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-ink text-lg">{row.employee.name}</p>
                    <p className="text-sm text-ink-soft">{row.employee.position}</p>
                  </div>
                  <span
                    className={`text-xs font-bold rounded-full px-3 py-1.5 ${
                      row.settled ? 'bg-status-working-bg text-status-working' : 'bg-status-rejected-bg text-status-rejected'
                    }`}
                  >
                    {row.settled ? '정산완료' : '미정산'}
                  </span>
                </div>

                <div className="rounded-control bg-brand-beige-light px-3 py-2.5 mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-soft">급여 지급일</span>
                    <span className="font-semibold text-ink">{row.employee.payday ?? '미설정'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-ink-soft">계산 기간</span>
                    <span className="font-semibold text-ink tabular-num">
                      {row.period.start.replace(/-/g, '.')} ~ {row.period.end.replace(/-/g, '.')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-1.5 text-sm mb-3">
                  <span className="text-ink-soft">총 근무시간</span>
                  <span className="text-right font-semibold text-ink tabular-num">
                    {Math.floor(row.totalMinutes / 60)}시간 {row.totalMinutes % 60}분
                  </span>
                  <span className="text-ink-soft">총 근무일</span>
                  <span className="text-right font-semibold text-ink tabular-num">{row.totalDays}일</span>
                  <span className="text-ink-soft">{row.employee.wageType === 'hourly' ? '시급' : '월급'}</span>
                  <span className="text-right font-semibold text-ink tabular-num">
                    {(row.employee.wageType === 'hourly' ? row.employee.hourlyWage : row.employee.monthlySalary)?.toLocaleString()}원
                  </span>
                </div>

                <div className="border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">세전 급여</span>
                    <span className="font-semibold text-ink tabular-num">{row.gross.toLocaleString()}원</span>
                  </div>
                  {payrollService.isWithholdingApplicable(row.employee) && (
                    <div className="flex justify-between">
                      <span className="text-ink-soft">3.3% 공제</span>
                      <span className="font-semibold text-status-rejected tabular-num">-{row.deduction.toLocaleString()}원</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-ink font-bold">실수령액</span>
                    <span className="font-bold text-brand-red tabular-num flex items-center gap-1">{row.net.toLocaleString()}원 <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
