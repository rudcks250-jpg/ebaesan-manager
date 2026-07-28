import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { ScheduleGrid } from '@/features/schedule/ScheduleGrid';
import { ScheduleEditModal } from '@/features/schedule/ScheduleEditModal';
import { BulkApplyModal } from '@/features/schedule/BulkApplyModal';
import { ScheduleExport } from '@/features/schedule/ScheduleExport';
import { exportSchedulePng } from '@/features/schedule/scheduleImageExport';
import { useAuth } from '@/contexts/AuthContext';
import { employeeService } from '@/services/employeeService';
import { scheduleService } from '@/services/scheduleService';
import { notificationService } from '@/services/notificationService';
import {
  getMondayOfWeekStr,
  getWeekDates,
  addWeeks,
  parseDate,
  formatDate,
  formatMonthDay,
} from '@/utils/date';
import type { Employee, ScheduleWeek, ShiftEntry } from '@/data/types';
import { BellRing, ChevronLeft, ChevronRight, ClipboardCopy, LoaderCircle, Trash2, Zap } from 'lucide-react';

const FIXED_EMPLOYEE_ORDER = [
  '박경찬',
  '김경재',
  '김하은',
  '채린',
  '차우',
  '구동욱',
  '이도윤',
  '서진훈',
  '유경진',
  '이철영',
  '후에',
  '유준영',
  '투안',
  '프엉 안',
] as const;

const EMPLOYEE_ORDER_INDEX = new Map<string, number>(
  FIXED_EMPLOYEE_ORDER.map((name, index) => [name, index])
);

export function SchedulePage() {
  const { session, effectiveRole, effectiveEmployeeId } = useAuth();
  const { showToast } = useToast();
  const isAdmin = effectiveRole === 'admin';
  const [weekStart, setWeekStart] = useState(() => getMondayOfWeekStr(formatDate(new Date())));
  const [refreshKey, setRefreshKey] = useState(0);
  const [editTarget, setEditTarget] = useState<{ employee: Employee; date: string; shift?: ShiftEntry } | null>(
    null
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [processing, setProcessing] = useState<'copy' | 'delete' | null>(null);
  const [exporting, setExporting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedCell, setSelectedCell] = useState<string>();
  const [fixedScheduleSuppressedWeek, setFixedScheduleSuppressedWeek] = useState<string>();
  const exportRef = useRef<HTMLDivElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [week, setWeek] = useState<ScheduleWeek>({ id: '', weekStartDate: '', shifts: [] });
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const sortedEmployees = useMemo(
    () =>
      employees
        .map((employee, originalIndex) => ({ employee, originalIndex }))
        .sort((a, b) => {
          const aOrder = EMPLOYEE_ORDER_INDEX.get(a.employee.name);
          const bOrder = EMPLOYEE_ORDER_INDEX.get(b.employee.name);

          if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
          if (aOrder !== undefined) return -1;
          if (bOrder !== undefined) return 1;
          return a.originalIndex - b.originalIndex;
        })
        .map(({ employee }) => employee),
    [employees]
  );

  useEffect(() => {
    let cancelled = false;
    const loadWeek = async () => {
      if (isAdmin && session && fixedScheduleSuppressedWeek !== weekStart) {
        const activeEmployees = await employeeService.listActive();
        await scheduleService.ensureFixedWeeklySchedules(
          weekStart,
          activeEmployees,
          session.employeeId
        );
      }
      const board = await scheduleService.getWeekBoard(weekStart);
      if (!cancelled) {
        setEmployees(board.employees);
        setWeek(board.week);
      }
    };
    void loadWeek().catch(() => {
      if (!cancelled) showToast('스케줄을 불러오지 못했습니다.', 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [
    fixedScheduleSuppressedWeek,
    isAdmin,
    refreshKey,
    session,
    showToast,
    weekStart,
  ]);

  const goWeek = (delta: number) => {
    setFixedScheduleSuppressedWeek(undefined);
    setWeekStart(formatDate(addWeeks(parseDate(weekStart), delta)));
  };

  const rangeLabel = `${formatMonthDay(weekDates[0])} ~ ${formatMonthDay(weekDates[6])}`;

  const handleCopyPreviousWeek = async () => {
    if (!session || processing) return;
    setProcessing('copy');
    try {
      const copied = await scheduleService.copyPreviousWeek(weekStart, session.employeeId);
      if (!copied) {
        showToast('복사할 지난주 스케줄이 없습니다.', 'error');
        return;
      }
      setCopyOpen(false);
      setRefreshKey((key) => key + 1);
      showToast('✅ 지난주 스케줄을 복사했습니다.');
    } catch {
      showToast('지난주 스케줄을 복사하지 못했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteWeek = async () => {
    if (processing) return;
    setProcessing('delete');
    try {
      await scheduleService.clearWeek(weekStart);
      setFixedScheduleSuppressedWeek(weekStart);
      setDeleteOpen(false);
      setRefreshKey((key) => key + 1);
      showToast('✅ 이번 주 스케줄이 삭제되었습니다.');
    } catch {
      showToast('이번 주 스케줄을 삭제하지 못했습니다.', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleDragCopy = async (employee: Employee, dates: string[], shift: ShiftEntry) => {
    if (!session || dates.length === 0) return;
    const previousShifts = dates.map((date) => ({
      date,
      shift: week.shifts.find((candidate) => candidate.employeeId === employee.id && candidate.date === date),
    }));
    try {
      const working = shift.status === 'working';
      await scheduleService.bulkApply(
        dates,
        [employee.id],
        {
          status: working ? 'working' : 'off',
          startTime: working ? shift.startTime : null,
          endTime: working ? shift.endTime : null,
          memo: shift.memo,
        },
        session.employeeId
      );
      setRefreshKey((key) => key + 1);
      showToast(`✅ ${dates.length}일의 스케줄을 복사했습니다.`);
    } catch (error) {
      await Promise.allSettled(
        previousShifts.map(({ date, shift: previousShift }) => {
          if (!previousShift || previousShift.status === 'unscheduled') {
            return scheduleService.clearShift(date, employee.id);
          }
          if (previousShift.status === 'leaveApproved') {
            return scheduleService.setApprovedLeave(date, employee.id, session.employeeId);
          }
          return scheduleService.setShift(
            date,
            employee.id,
            {
              status: previousShift.status,
              startTime: previousShift.startTime,
              endTime: previousShift.endTime,
              memo: previousShift.memo,
            },
            session.employeeId
          );
        })
      );
      setRefreshKey((key) => key + 1);
      showToast('스케줄 복사에 실패해 변경사항을 되돌렸습니다.', 'error');
      throw error;
    }
  };

  const handleShareSchedule = async () => {
    if (!exportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportSchedulePng(exportRef.current, `이배산-근무스케줄-${weekDates[0]}-${weekDates[6]}.png`);
      showToast('스케줄 이미지를 준비했습니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('[Schedule export failed]', error);
      showToast('스케줄 이미지를 만들지 못했습니다.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePublishSchedule = async () => {
    if (publishing) return;
    setPublishing(true);
    try {
      const count = await notificationService.publishSchedule(weekStart);
      showToast(count > 0 ? `스케줄을 배포하고 ${count}명에게 알림을 준비했습니다.` : '이미 배포된 주간 스케줄입니다.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '스케줄 배포에 실패했습니다.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Layout title="스케줄" showGreeting={false}>
      {isAdmin && (
        <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
          <Button size="sm" onClick={() => void handlePublishSchedule()} disabled={publishing}>
            <span className="inline-flex items-center gap-1.5">
              {publishing ? <LoaderCircle size={15} className="animate-spin" /> : <BellRing size={15} />} 스케줄 배포
            </span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void handleShareSchedule()} disabled={exporting}>
            <span className="inline-flex items-center gap-1.5">
              {exporting ? <LoaderCircle size={15} className="animate-spin" /> : <span aria-hidden="true">📸</span>} 스케줄 공유
            </span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setCopyOpen(true)} disabled={!!processing}>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCopy size={15} /> 지난주 복사
            </span>
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)} disabled={!!processing}>
            <span className="inline-flex items-center gap-1.5">
              <Trash2 size={15} /> 전체 삭제
            </span>
          </Button>
          <Button size="sm" onClick={() => setBulkOpen(true)} disabled={!!processing}>
            <span className="inline-flex items-center gap-1.5">
              <Zap size={15} /> 일괄등록
            </span>
          </Button>
        </div>
      )}

      {/* 상단: 좌우 화살표 + 가운데 날짜 범위 + 우측 일괄등록 */}
      <div className="flex items-center gap-3 mb-6 bg-surface border border-border shadow-premium rounded-card p-3">
        <button
          onClick={() => goWeek(-1)}
          aria-label="이전 주"
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-ink-soft bg-brand-beige-light hover:bg-brand-beige press-scale"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="flex-1 text-center font-bold text-ink text-lg sm:text-xl tracking-tight">{rangeLabel}</p>
        <button
          onClick={() => goWeek(1)}
          aria-label="다음 주"
          className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl text-ink-soft bg-brand-beige-light hover:bg-brand-beige press-scale"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <ScheduleGrid
        employees={sortedEmployees}
        weekDates={weekDates}
        shifts={week.shifts}
        currentEmployeeId={!isAdmin ? effectiveEmployeeId : undefined}
        clickable={isAdmin}
        selectedCell={selectedCell}
        onDragCopy={isAdmin ? handleDragCopy : undefined}
        onCellClick={
          isAdmin
            ? (employee, date) => {
                setSelectedCell(`${employee.id}:${date}`);
                setEditTarget({
                  employee,
                  date,
                  shift: week.shifts.find((s) => s.employeeId === employee.id && s.date === date),
                });
              }
            : undefined
        }
      />

      {!isAdmin && (
        <p className="text-xs text-ink-faint mt-5 text-center">
          본인 스케줄은 파란색 테두리로 강조됩니다. 수정은 관리자에게 문의해주세요.
        </p>
      )}

      {isAdmin && editTarget && (
        <ScheduleEditModal
          open
          onClose={() => setEditTarget(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          employee={editTarget.employee}
          date={editTarget.date}
          existingShift={editTarget.shift}
          adminId={session!.employeeId}
        />
      )}

      {isAdmin && (
        <BulkApplyModal
          open={bulkOpen}
          onClose={() => setBulkOpen(false)}
          onSaved={() => setRefreshKey((k) => k + 1)}
          employees={sortedEmployees}
          weekDates={weekDates}
          adminId={session!.employeeId}
        />
      )}

      {isAdmin && <Modal
        open={copyOpen}
        onClose={() => !processing && setCopyOpen(false)}
        title="지난주 스케줄을 복사하시겠습니까?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={!!processing} onClick={() => setCopyOpen(false)}>
              취소
            </Button>
            <Button fullWidth disabled={!!processing} onClick={() => void handleCopyPreviousWeek()}>
              <span className="inline-flex items-center gap-1.5">
                {processing === 'copy' && <LoaderCircle size={15} className="animate-spin" />}
                복사하기
              </span>
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft mb-4">
          현재 표시 중인 주의 스케줄을 모두 삭제한 뒤,<br />
          바로 이전 주의 스케줄을 복사합니다.
        </p>
        <label className="flex items-center gap-2 rounded-xl bg-brand-beige-light px-3 py-3 text-sm font-semibold text-ink mb-5">
          <input type="checkbox" checked readOnly className="w-4 h-4 accent-brand-red" />
          기존 스케줄 덮어쓰기
        </label>
      </Modal>}

      {isAdmin && <Modal
        open={deleteOpen}
        onClose={() => !processing && setDeleteOpen(false)}
        title="이번 주 스케줄을 모두 삭제하시겠습니까?"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth disabled={!!processing} onClick={() => setDeleteOpen(false)}>
              취소
            </Button>
            <Button variant="danger" fullWidth disabled={!!processing} onClick={() => void handleDeleteWeek()}>
              <span className="inline-flex items-center gap-1.5">
                {processing === 'delete' && <LoaderCircle size={15} className="animate-spin" />}
                삭제하기
              </span>
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-ink-soft pb-5">
          현재 화면의 이번 주 스케줄만 삭제됩니다.<br />
          직원 정보와 다른 주의 스케줄은 유지됩니다.
        </p>
      </Modal>}

      {isAdmin && (
        <ScheduleExport
          ref={exportRef}
          employees={sortedEmployees}
          weekDates={weekDates}
          shifts={week.shifts}
          rangeLabel={rangeLabel}
        />
      )}
    </Layout>
  );
}
