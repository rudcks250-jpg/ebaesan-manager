import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { RequireAuth } from '@/router/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { EmployeeListPage } from '@/features/employee/EmployeeListPage';
import { PayrollListPage } from '@/features/payroll/PayrollListPage';
import { PayrollDetailPage } from '@/features/payroll/PayrollDetailPage';
import { SchedulePage } from '@/features/schedule/SchedulePage';
import { LeavePage } from '@/features/leave/LeavePage';
import { WorkTimePage } from '@/features/worktime/WorkTimePage';
import { OrderPage } from '@/features/order/OrderPage';
import { TomorrowPrepPage } from '@/features/tomorrowPrep/TomorrowPrepPage';
import { canAccessTomorrowPrep, canManageNotices } from '@/utils/permission';
import { NoticeManagementPage } from '@/features/notices/NoticeManagementPage';
import { PrepaidManagementPage } from '@/features/prepaid/PrepaidManagementPage';
import { ProfitLossPage } from '@/features/profitLoss/ProfitLossPage';
import { canViewProfitLoss } from '@/utils/permission';

function TomorrowPrepRoute() {
  const { session } = useAuth();
  if (!canAccessTomorrowPrep(session?.name)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <TomorrowPrepPage />;
}

function NoticeManagementRoute() {
  const { session } = useAuth();
  if (!canManageNotices(session?.name)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <NoticeManagementPage />;
}

function ProfitLossRoute() {
  const { session } = useAuth();
  if (!canViewProfitLoss(session?.name)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-beige-light px-5">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-premium">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-5 text-2xl font-bold text-ink">접근 권한이 없습니다.</h1>
          <p className="mt-2 text-sm text-ink-soft">월 손익계산서는 대표 계정만 확인할 수 있습니다.</p>
        </div>
      </div>
    );
  }
  return <ProfitLossPage />;
}

function LoginRoute() {
  const { session, sessionLoading } = useAuth();
  if (sessionLoading) return null;
  if (session) return <Navigate to="/dashboard" replace />;
  return <LoginPage />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth feature="dashboard">
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/employee"
          element={
            <RequireAuth feature="employee">
              <EmployeeListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payroll"
          element={
            <RequireAuth feature="payroll">
              <PayrollListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payroll/:employeeId"
          element={
            <RequireAuth feature="payroll">
              <PayrollDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/schedule"
          element={
            <RequireAuth feature="schedule">
              <SchedulePage />
            </RequireAuth>
          }
        />
        <Route
          path="/leave"
          element={
            <RequireAuth feature="leave">
              <LeavePage />
            </RequireAuth>
          }
        />
        <Route
          path="/worktime"
          element={
            <RequireAuth feature="worktime">
              <WorkTimePage />
            </RequireAuth>
          }
        />
        <Route
          path="/order"
          element={
            <RequireAuth feature="order">
              <OrderPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tomorrow-prep"
          element={
            <RequireAuth feature="tomorrowPrep">
              <TomorrowPrepRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/notices"
          element={
            <RequireAuth feature="notices">
              <NoticeManagementRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/prepayments"
          element={
            <RequireAuth feature="prepayments">
              <PrepaidManagementPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profit-loss"
          element={
            <RequireAuth feature="profitLoss">
              <ProfitLossRoute />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
