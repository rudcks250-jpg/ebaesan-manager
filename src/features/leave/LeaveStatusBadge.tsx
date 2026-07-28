import { Badge } from '@/components/common/Badge';
import type { LeaveStatus } from '@/data/types';

const LABEL: Record<LeaveStatus, string> = {
  pending: '대기',
  approved: '승인',
  rejected: '반려',
};

const TONE: Record<LeaveStatus, 'pending' | 'approved' | 'rejected'> = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
