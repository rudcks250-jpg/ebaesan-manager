import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { employeeService } from '@/services/employeeService';
import { useToast } from '@/components/common/Toast';
import { formatDateTimeKo } from '@/utils/date';
import type { Employee } from '@/data/types';

interface EmployeeDetailModalProps {
  employee: Employee;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
}

export function EmployeeDetailModal({ employee, onClose, onChanged, onEdit }: EmployeeDetailModalProps) {
  const { showToast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const wageText =
    employee.wageType === 'hourly'
      ? `시급 ${employee.hourlyWage?.toLocaleString()}원`
      : `월급 ${employee.monthlySalary?.toLocaleString()}원`;

  const handleResetPassword = async () => {
    try {
      await employeeService.resetPassword(employee.id);
      showToast('비밀번호가 등록된 개인번호로 초기화되었습니다.');
      onChanged();
      onClose();
    } catch {
      showToast('비밀번호 초기화에 실패했습니다.', 'error');
    }
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="직원 상세 정보"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={onEdit}>
              정보 수정
            </Button>
            <Button variant="danger" fullWidth onClick={() => setConfirmReset(true)}>
              비밀번호 초기화
            </Button>
          </div>
        }
      >
        <div className="space-y-1 mb-5">
          <p className="text-xl font-bold text-ink">{employee.name}</p>
          <p className="text-sm text-ink-soft">{employee.position}</p>
          <p className="text-sm font-semibold text-ink">{wageText}</p>
          <p className="text-sm text-ink-soft">개인번호 : {employee.phone}</p>
          <p className="text-sm text-ink-soft">급여일 : {employee.payday ?? '미설정'}</p>
        </div>

        <div className="rounded-control bg-brand-beige-light p-4 mb-4">
          <p className="text-sm font-bold text-ink mb-2">로그인 정보</p>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-ink-soft">로그인 아이디</span>
            <span className="font-semibold text-ink">{employee.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-soft">초기 비밀번호</span>
            <span className="font-semibold text-ink">********</span>
          </div>
          <p className="text-[11px] text-ink-faint mt-2">관리자는 현재 비밀번호를 확인할 수 없습니다.</p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-ink-soft">로그인 상태</span>
          {employee.isFirstLogin ? (
            <Badge tone="pending">⚠ 첫 로그인 미완료</Badge>
          ) : (
            <Badge tone="approved">✅ 첫 로그인 완료</Badge>
          )}
        </div>

        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-ink-soft">마지막 로그인</span>
          <span className="text-sm font-semibold text-ink text-right">
            {employee.lastLoginAt ? formatDateTimeKo(employee.lastLoginAt) : '로그인 기록 없음'}
          </span>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="비밀번호 초기화"
        description="정말 초기화하시겠습니까? 비밀번호가 등록된 개인번호로 재설정되고, 다음 로그인 시 다시 비밀번호를 변경해야 합니다."
        confirmLabel="초기화"
        danger
        onConfirm={handleResetPassword}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}
