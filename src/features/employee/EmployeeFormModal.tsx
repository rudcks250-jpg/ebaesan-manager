import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input, Select } from '@/components/common/Input';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { employeeService } from '@/services/employeeService';
import { useToast } from '@/components/common/Toast';
import type { Employee, EmployeeStatus, UserRole, WageType } from '@/data/types';

interface EmployeeFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employee?: Employee; // 없으면 등록 모드
}

export function EmployeeFormModal({ open, onClose, onSaved, employee }: EmployeeFormModalProps) {
  const { showToast } = useToast();
  const isEdit = !!employee;

  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [position, setPosition] = useState(employee?.position ?? '홀');
  const [role, setRole] = useState<UserRole>(employee?.role ?? 'employee');
  const [wageType, setWageType] = useState<WageType>(employee?.wageType ?? 'hourly');
  const [hourlyWage, setHourlyWage] = useState(String(employee?.hourlyWage ?? ''));
  const [monthlySalary, setMonthlySalary] = useState(String(employee?.monthlySalary ?? ''));
  const [payday, setPayday] = useState(employee?.payday ?? '매월 10일');
  const [hireDate, setHireDate] = useState(
    employee?.hireDate ?? new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState<EmployeeStatus>(employee?.status ?? 'active');
  const [error, setError] = useState('');
  const [confirmResign, setConfirmResign] = useState(false);
  const [confirmResetPw, setConfirmResetPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim() || !phone.trim() || !position.trim()) {
      setError('이름, 전화번호, 직책은 필수입니다.');
      return;
    }
    const phoneDigits = phone.replace(/\D/g, '');
    if (!/^0\d{9,10}$/.test(phoneDigits)) {
      setError('전화번호가 올바르지 않습니다.');
      return;
    }
    const wageAmount = wageType === 'hourly' ? Number(hourlyWage) : Number(monthlySalary);
    if (!wageAmount || wageAmount <= 0) {
      setError('급여 금액을 올바르게 입력해주세요.');
      return;
    }

    try {
      setSaving(true);
      if (isEdit && employee) {
        await employeeService.update(employee.id, {
          name: name.trim(),
          phone: phone.trim(),
          position: position.trim(),
          hireDate,
          payday: payday.trim() || undefined,
        });
        await employeeService.changeRole(employee.id, role);
        await employeeService.changeWage(employee.id, wageType, wageAmount);
        await employeeService.setStatus(employee.id, status);
        showToast('직원 정보가 수정되었습니다.');
      } else {
        await employeeService.create({
          name: name.trim(),
          phone: phone.trim(),
          position: position.trim(),
          role,
          wageType,
          hourlyWage: wageType === 'hourly' ? wageAmount : undefined,
          monthlySalary: wageType === 'monthly' ? wageAmount : undefined,
          hireDate,
          payday: payday.trim() || undefined,
        });
        showToast('직원이 등록되었습니다.');
      }
      onSaved();
      resetAndClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={resetAndClose}
        title={isEdit ? '직원 정보 수정' : '직원 등록'}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={resetAndClose}>
              취소
            </Button>
            <Button fullWidth onClick={handleSave} disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>
        }
      >
        <Input label="이름" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" />
        <Input
          label="전화번호"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
        />
        <Input
          label="직책"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="예: 홀, 주방, 매니저"
        />
        <Select label="권한" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="employee">직원</option>
          <option value="manager">매니저</option>
          <option value="admin">관리자</option>
        </Select>
        <Select
          label="근무 구분"
          value={wageType}
          onChange={(e) => setWageType(e.target.value as WageType)}
        >
          <option value="hourly">시급제</option>
          <option value="monthly">월급제</option>
        </Select>
        {wageType === 'hourly' ? (
          <Input
            label="시급 (원)"
            type="number"
            value={hourlyWage}
            onChange={(e) => setHourlyWage(e.target.value)}
            placeholder="예: 10030"
          />
        ) : (
          <Input
            label="월급 (원)"
            type="number"
            value={monthlySalary}
            onChange={(e) => setMonthlySalary(e.target.value)}
            placeholder="예: 2800000"
          />
        )}
        <Input
          label="입사일"
          type="date"
          value={hireDate}
          onChange={(e) => setHireDate(e.target.value)}
        />
        <Input
          label="급여일"
          value={payday}
          onChange={(e) => setPayday(e.target.value)}
          placeholder="예: 매월 10일, 매월 말일"
        />
        {isEdit && (
          <Select
            label="재직 상태"
            value={status}
            onChange={(e) => {
              const next = e.target.value as EmployeeStatus;
              if (next === 'resigned') {
                setConfirmResign(true);
                return;
              }
              setStatus(next);
            }}
          >
            <option value="active">재직</option>
            <option value="inactive">비활성</option>
            <option value="resigned">퇴사</option>
          </Select>
        )}
        {error && <p className="text-xs text-status-rejected -mt-2 mb-3">{error}</p>}
        {isEdit && employee && (
          <button
            type="button"
            onClick={() => setConfirmResetPw(true)}
            className="text-xs font-medium text-ink-faint hover:text-brand-red mb-4"
          >
            초기 비밀번호로 재설정 (등록된 개인번호)
          </button>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmResign}
        title="퇴사 처리"
        description="퇴사 처리하면 해당 직원은 더 이상 로그인할 수 없습니다. 데이터는 유지됩니다. 계속할까요?"
        confirmLabel="퇴사 처리"
        danger
        onConfirm={() => setStatus('resigned')}
        onClose={() => setConfirmResign(false)}
      />
      <ConfirmDialog
        open={confirmResetPw}
        title="비밀번호 초기화"
        description="비밀번호를 등록된 개인번호로 초기화하고, 다음 로그인 시 변경을 요구합니다."
        confirmLabel="초기화"
        onConfirm={async () => {
          if (employee) {
            try {
              await employeeService.resetPassword(employee.id);
              showToast('비밀번호가 초기화되었습니다.');
            } catch (error) {
              showToast(
                error instanceof Error ? error.message : '비밀번호 초기화에 실패했습니다.',
                'error',
              );
            }
          }
        }}
        onClose={() => setConfirmResetPw(false)}
      />
    </>
  );
}
