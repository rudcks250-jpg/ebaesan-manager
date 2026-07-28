import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { CalendarDays, Phone } from 'lucide-react';
import type { Employee } from '@/data/types';
import { getEmployeePaydayInfo } from '@/features/employee/employeePayday';
import { getEmployeeAccent } from '@/utils/employeeAccent';

const STATUS_LABEL: Record<Employee['status'], string> = {
  active: '재직',
  inactive: '비활성',
  resigned: '퇴사',
};

function statusTone(status: Employee['status']) {
  if (status === 'active') return 'working' as const;
  if (status === 'inactive') return 'pending' as const;
  return 'off' as const;
}

function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return phone.trim();
}

export function EmployeeCard({
  employee,
  onOpenDetail,
  onEdit,
  onDelete,
}: {
  employee: Employee;
  onOpenDetail: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const wageLabel = employee.wageType === 'hourly' ? '시급' : '월급';
  const wageValue = employee.wageType === 'hourly' ? employee.hourlyWage : employee.monthlySalary;
  const hasWage = typeof wageValue === 'number' && Number.isFinite(wageValue);
  const phoneNumber = formatPhoneNumber(employee.phone);
  const paydayInfo = getEmployeePaydayInfo(employee.payday);
  const accent = getEmployeeAccent(employee.name);
  const paydayTone = {
    today: 'bg-status-working-bg text-status-working',
    soon: 'bg-status-pending-bg text-status-pending',
    week: 'bg-brand-red-light text-brand-red',
    later: 'bg-brand-beige-light text-ink-soft',
  }[paydayInfo.tone];

  return (
    <Card hover onClick={onOpenDetail} className="text-left cursor-pointer bg-gradient-to-br from-white via-white to-[#F6FAFF]">
      {/* 프로필 */}
      <div className="flex items-start justify-between mb-5">
        <div className={`w-14 h-14 rounded-[18px] flex items-center justify-center ${accent.soft}`}>
          <span className={`text-xl font-bold ${accent.text}`}>{employee.name.slice(0, 1)}</span>
        </div>
        <Badge tone={statusTone(employee.status)}>{STATUS_LABEL[employee.status]}</Badge>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="font-bold text-ink text-xl tracking-tight">{employee.name}</p>
        {employee.isFirstLogin ? (
          <Badge tone="pending">로그인 대기</Badge>
        ) : (
          <Badge tone="approved">로그인 완료</Badge>
        )}
      </div>

      {/* 고용 형태 */}
      <p className="mt-2 text-sm font-semibold text-ink-soft">{employee.position}</p>

      {/* 연락처 */}
      <div className={`mt-1.5 flex items-center gap-1.5 text-sm ${phoneNumber ? 'text-ink-soft' : 'text-ink-faint'}`}>
        <Phone size={14} strokeWidth={2} aria-hidden="true" />
        <span className="tabular-num">{phoneNumber || '미등록'}</span>
      </div>

      {/* 시급/월급 */}
      <div className="mt-5 border-t border-black/[0.055] pt-4">
        <p className="text-xs font-medium text-ink-faint">{wageLabel}</p>
        <p className={`mt-1 text-[17px] font-bold ${hasWage ? 'tabular-num text-ink' : 'text-ink-soft'}`}>
          {hasWage ? `${wageValue.toLocaleString('ko-KR')}원` : '미설정'}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-black/[0.045] bg-white/75 p-3.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-ink-soft">
            <CalendarDays size={14} className="text-brand-red" aria-hidden="true" />
            급여일
          </span>
          <span className="text-sm font-bold text-ink">{employee.payday || '미설정'}</span>
        </div>
        <div className="mt-3 flex justify-end">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${paydayTone}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
            {paydayInfo.label}
          </span>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2 mt-5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="flex-1 text-sm font-semibold text-brand-red py-2.5 rounded-xl bg-brand-red-light press-scale"
        >
          정보 수정
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="flex-1 text-sm font-semibold text-status-rejected py-2.5 rounded-xl bg-surface border border-status-rejected/15 hover:bg-status-rejected hover:text-white press-scale"
        >
          삭제
        </button>
      </div>
    </Card>
  );
}
