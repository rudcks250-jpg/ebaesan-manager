import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { WorkTimeCalendarPage } from '@/features/worktime/WorkTimeCalendarPage';
import { WorkTimeAdminPage } from '@/features/worktime/WorkTimeAdminPage';

export function WorkTimePage() {
  const { effectiveRole, effectiveEmployeeId } = useAuth();
  const isAdmin = effectiveRole === 'admin';

  return (
    <Layout title="근로시간">
      {isAdmin ? <WorkTimeAdminPage /> : <WorkTimeCalendarPage employeeId={effectiveEmployeeId!} />}
    </Layout>
  );
}
