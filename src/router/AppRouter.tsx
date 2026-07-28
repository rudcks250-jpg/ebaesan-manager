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
import { NotificationSettingsPage } from '@/features/settings/NotificationSettingsPage';

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
          path="/settings"
          element={
            <RequireAuth feature="settings">
              <NotificationSettingsPage />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
