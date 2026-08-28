import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { Input, Select } from '@/components/common/Input';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { EmployeeCard } from '@/features/employee/EmployeeCard';
import { EmployeeFormModal } from '@/features/employee/EmployeeFormModal';
import { EmployeeDetailModal } from '@/features/employee/EmployeeDetailModal';
import { EmployeeResignModal } from '@/features/employee/EmployeeResignModal';
import { employeeService, type LoginStatusFilter } from '@/services/employeeService';
import type { Employee, EmployeeStatus, WageType } from '@/data/types';
import { Users, UserCheck, CircleDollarSign, UserPlus, UserRoundCheck, CircleX } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { Modal } from '@/components/common/Modal';
import { compareEmployeesByPayday, getEmployeePaydayInfo } from '@/features/employee/employeePayday';
import type { BulkAccountCreationResult } from '@/services/employeeService';

interface LocationState {
  loginFilter?: LoginStatusFilter;
}

type QuickFilter = 'all' | 'today' | 'week' | 'month' | 'monthly' | 'hourly' | 'partTime' | 'employee';

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'today', label: '오늘 지급' },
  { key: 'week', label: '이번주 지급' },
  { key: 'month', label: '이번달 지급' },
  { key: 'monthly', label: '월급제' },
  { key: 'hourly', label: '시급제' },
  { key: 'partTime', label: '파트타임' },
  { key: 'employee', label: '직원' },
];

export function EmployeeListPage() {
  const location = useLocation();
  const { showToast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | ''>('active');
  const [wageFilter, setWageFilter] = useState<WageType | ''>('');
  const [loginFilter, setLoginFilter] = useState<LoginStatusFilter | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | undefined>(undefined);
  const [detailTarget, setDetailTarget] = useState<Employee | undefined>(undefined);
  const [resignTarget, setResignTarget] = useState<Employee | undefined>(undefined);
  const [restoreTarget, setRestoreTarget] = useState<Employee | undefined>(undefined);
  const [lastWorkDates, setLastWorkDates] = useState<Record<string, string>>({});
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [creatingAccounts, setCreatingAccounts] = useState(false);
  const [accountResult, setAccountResult] = useState<BulkAccountCreationResult | undefined>();

  // 대시보드 "로그인 관리" 카드에서 넘어온 경우 필터를 자동 적용합니다.
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.loginFilter) setLoginFilter(state.loginFilter);
  }, [location.state]);

  const [positions, setPositions] = useState<string[]>([]);
  const [positionFilter, setPositionFilter] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    employeeService.listPositions().then(setPositions).catch(() => {
      showToast('직책 목록을 불러오지 못했습니다.', 'error');
    });
  }, [refreshKey, showToast]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    employeeService
      .list({
        keyword,
        status: statusFilter || undefined,
        wageType: wageFilter || undefined,
        position: positionFilter || undefined,
        loginStatus: loginFilter || undefined,
      })
      .then((list) => {
        if (!cancelled) setEmployees(list);
      })
      .catch(() => {
        if (!cancelled) showToast('직원 목록을 불러오지 못했습니다.', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [keyword, statusFilter, wageFilter, positionFilter, loginFilter, refreshKey, showToast]);

  useEffect(() => {
    const resignedIds = employees.filter((employee) => employee.status === 'resigned').map((employee) => employee.id);
    if (resignedIds.length === 0) {
      setLastWorkDates({});
      return;
    }
    employeeService.getLastWorkDates(resignedIds).then(setLastWorkDates).catch(() => setLastWorkDates({}));
  }, [employees]);

  const visibleEmployees = employees
    .filter((employee) => {
      const payday = getEmployeePaydayInfo(employee.payday);
      if (quickFilter === 'today') return payday.daysUntil === 0;
      if (quickFilter === 'week') return payday.daysUntil <= 7;
      if (quickFilter === 'month') return payday.occursThisMonth;
      if (quickFilter === 'monthly') return employee.wageType === 'monthly';
      if (quickFilter === 'hourly') return employee.wageType === 'hourly';
      if (quickFilter === 'partTime') return employee.position === '파트타임';
      if (quickFilter === 'employee') return employee.position === '직원';
      return true;
    })
    .sort(compareEmployeesByPayday);

  const [formNonce, setFormNonce] = useState(0);

  const openCreate = () => {
    setEditTarget(undefined);
    setFormOpen(true);
    setFormNonce((n) => n + 1);
  };
  const openEdit = (emp: Employee) => {
    setDetailTarget(undefined);
    setEditTarget(emp);
    setFormOpen(true);
    setFormNonce((n) => n + 1);
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    try {
      await employeeService.restore(restoreTarget.id);
      setDetailTarget(undefined);
      setRefreshKey((k) => k + 1);
      showToast(`${restoreTarget.name} 직원을 재직 복구했습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '재직 복구에 실패했습니다.';
      showToast(message, 'error');
    } finally {
      setRestoreTarget(undefined);
    }
  };

  const handleBulkAccountCreation = async () => {
    if (creatingAccounts) return;
    setCreatingAccounts(true);
    try {
      const result = await employeeService.createAccountsForExistingEmployees();
      setAccountResult(result);
      setRefreshKey((key) => key + 1);
      showToast('기존 직원 계정 생성을 완료했습니다.');
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : '기존 직원 계정 생성에 실패했습니다.',
        'error',
      );
    } finally {
      setCreatingAccounts(false);
    }
  };

  return (
    <Layout title="직원관리">
      <div className="flex items-center justify-between mb-5 gap-2">
        <div>
          <p className="text-lg font-bold text-ink">직원 디렉토리</p>
          <p className="text-xs text-ink-soft mt-1">직원 정보와 오늘의 근무 상태를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={creatingAccounts}
            onClick={() => void handleBulkAccountCreation()}
          >
            {creatingAccounts ? '계정 생성 중...' : '기존 직원 계정 생성'}
          </Button>
          <Button size="sm" onClick={openCreate}>
            직원 등록
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard icon={Users} label="전체 직원" value={`${employees.length}명`} />
        <StatCard icon={UserCheck} label="재직 중" value={`${employees.filter((e) => e.status === 'active').length}명`} tone="green" />
        <StatCard icon={CircleDollarSign} label="시급제" value={`${employees.filter((e) => e.wageType === 'hourly').length}명`} tone="orange" />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl bg-brand-beige-light p-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter('active')}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${statusFilter === 'active' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
        >
          재직 중
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('resigned')}
          className={`rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${statusFilter === 'resigned' ? 'bg-white text-ink shadow-sm' : 'text-ink-soft'}`}
        >
          퇴사자
        </button>
      </div>

      <div className="bg-surface border border-border shadow-premium rounded-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <div className="col-span-2 sm:col-span-1">
          <Input
            placeholder="이름 · 직책 검색"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="!mb-0"
          />
        </div>
        <Select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
          className="!mb-0"
        >
          <option value="">전체 직책</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as EmployeeStatus | '')}
          className="!mb-0"
        >
          <option value="">전체 상태</option>
          <option value="active">재직</option>
          <option value="inactive">비활성</option>
          <option value="resigned">퇴사</option>
        </Select>
        <Select
          value={wageFilter}
          onChange={(e) => setWageFilter(e.target.value as WageType | '')}
          className="!mb-0"
        >
          <option value="">전체 급여형태</option>
          <option value="hourly">시급제</option>
          <option value="monthly">월급제</option>
        </Select>
      </div>

      {/* 로그인 상태 필터 */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-thin">
        {(
          [
            { key: '', label: '전체' },
            { key: 'pending', label: '첫 로그인 미완료' },
            { key: 'completed', label: '첫 로그인 완료' },
          ] as const
        ).map((f) => (
          <button
            key={f.key}
            onClick={() => setLoginFilter(f.key)}
            className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border press-scale ${
              loginFilter === f.key
                ? 'bg-brand-red text-white border-brand-red'
                : 'border-border text-ink-soft'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-thin pb-1">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setQuickFilter(filter.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold press-scale ${
              quickFilter === filter.key
                ? 'bg-ink text-white shadow-premium'
                : 'bg-surface border border-border text-ink-soft hover:bg-brand-beige-light'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-faint text-center py-10">불러오는 중...</p>
      ) : visibleEmployees.length === 0 ? (
        <EmptyState icon="🔍" title="조건에 맞는 직원이 없습니다" description="검색 또는 필터를 확인해주세요." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleEmployees.map((emp) => (
            <EmployeeCard
              key={emp.id}
              employee={emp}
              onOpenDetail={() => setDetailTarget(emp)}
              onEdit={() => openEdit(emp)}
              onResign={() => setResignTarget(emp)}
              onRestore={() => setRestoreTarget(emp)}
              lastWorkDate={lastWorkDates[emp.id]}
            />
          ))}
        </div>
      )}

      <EmployeeFormModal
        key={`${editTarget?.id ?? 'new'}-${formNonce}`}
        open={formOpen}
        employee={editTarget}
        onClose={() => setFormOpen(false)}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />

      {detailTarget && (
        <EmployeeDetailModal
          employee={detailTarget}
          onClose={() => setDetailTarget(undefined)}
          onChanged={() => setRefreshKey((k) => k + 1)}
          onEdit={() => openEdit(detailTarget)}
          onResign={() => {
            setResignTarget(detailTarget);
            setDetailTarget(undefined);
          }}
          onRestore={() => setRestoreTarget(detailTarget)}
        />
      )}

      {resignTarget && (
        <EmployeeResignModal
          employee={resignTarget}
          onClose={() => setResignTarget(undefined)}
          onCompleted={(deletedScheduleCount) => {
            showToast(`${resignTarget.name} 직원을 퇴사 처리했습니다.${deletedScheduleCount > 0 ? ` 미래 스케줄 ${deletedScheduleCount}건을 정리했습니다.` : ''}`);
            setResignTarget(undefined);
            setRefreshKey((key) => key + 1);
          }}
        />
      )}

      <ConfirmDialog
        open={!!restoreTarget}
        title="재직 복구"
        description={
          restoreTarget
            ? `${restoreTarget.name} 직원을 재직 상태로 복구합니다. 이미 정리된 미래 스케줄은 자동 복원되지 않습니다.`
            : undefined
        }
        confirmLabel="복구"
        onConfirm={() => {
          void handleRestore();
        }}
        onClose={() => setRestoreTarget(undefined)}
      />

      <Modal
        open={!!accountResult}
        title="기존 직원 계정 생성 결과"
        onClose={() => setAccountResult(undefined)}
        footer={
          <Button fullWidth onClick={() => setAccountResult(undefined)}>
            확인
          </Button>
        }
      >
        {accountResult && (
          <div className="space-y-3 pb-5 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Users} label="총 직원" value={`${accountResult.total}명`} />
              <StatCard icon={UserPlus} label="생성 완료" value={`${accountResult.created}명`} tone="green" />
              <StatCard icon={UserRoundCheck} label="이미 존재" value={`${accountResult.existing}명`} />
              <StatCard
                icon={CircleX}
                label="실패"
                value={`${accountResult.failed}명`}
                tone={accountResult.failed > 0 ? 'red' : undefined}
              />
            </div>
            {accountResult.failures.length > 0 && (
              <div className="rounded-xl bg-status-rejected/5 p-3">
                <p className="font-semibold text-status-rejected mb-2">실패 내역</p>
                {accountResult.failures.map((failure) => (
                  <p key={failure.employeeId} className="text-xs text-ink-soft">
                    {failure.name}: {failure.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
