import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { LeaveRequestPage } from '@/features/leave/LeaveRequestPage';
import { LeaveApprovalPage } from '@/features/leave/LeaveApprovalPage';

export function LeavePage() {
  const { effectiveRole, effectiveEmployeeId } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  return (
    <Layout title={isAdmin ? '휴무관리' : '휴무신청'}>
      {isAdmin ? <LeaveApprovalPage /> : <LeaveRequestPage employeeId={effectiveEmployeeId!} />}
    </Layout>
  );
}
