import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/common/Toast';
import { AppRouter } from '@/router/AppRouter';
import { PasswordChangeModal } from '@/features/auth/PasswordChangeModal';

function GlobalGates() {
  const { session, requirePasswordChange } = useAuth();
  // 첫 로그인 시 어느 화면으로 이동하든 비밀번호 변경을 강제합니다.
  if (session && requirePasswordChange) {
    return <PasswordChangeModal />;
  }
  return null;
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRouter />
        <GlobalGates />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
