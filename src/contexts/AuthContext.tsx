import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { authService } from '@/services/authService';
import { employeeRepository } from '@/repositories/employeeRepository';
import type { AuthSession } from '@/data/types';

interface AuthContextValue {
  session: AuthSession | null;
  sessionLoading: boolean;
  requirePasswordChange: boolean;
  login: (name: string, password: string) => ReturnType<typeof authService.login>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  completePasswordChange: () => void;
  // 관리자 "직원 모드" - 관리자가 실제 직원 화면을 그대로 미리볼 수 있는 기능.
  // 관리자의 실제 권한(session.role)은 그대로 유지되며, 화면 렌더링 시
  // 참고하는 effectiveRole / effectiveEmployeeId 만 바뀝니다.
  isStaffPreview: boolean;
  enterStaffPreview: () => Promise<void>;
  exitStaffPreview: () => void;
  effectiveRole: 'admin' | 'staff' | undefined;
  effectiveEmployeeId: string | undefined;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// 세션의 실제 소유 직원 레코드에서 isFirstLogin 값을 읽어옵니다.
// 새로고침이나 URL 직접 진입으로 컴포넌트가 다시 마운트되어도
// 항상 실제 데이터(Supabase) 기준으로 강제 여부를 판단합니다.
async function deriveRequirePasswordChange(session: AuthSession | null): Promise<boolean> {
  if (!session) return false;
  const employee = await employeeRepository.findById(session.employeeId);
  return !!employee?.isFirstLogin;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [requirePasswordChange, setRequirePasswordChange] = useState(false);
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const [previewEmployeeId, setPreviewEmployeeId] = useState<string | undefined>(undefined);

  // 최초 마운트 시 Supabase Auth 세션 복원 + 이후 토큰 갱신/만료를 계속 반영
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const restored = await authService.getSession();
      if (cancelled) return;
      setSession(restored);
      setRequirePasswordChange(await deriveRequirePasswordChange(restored));
      setSessionLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, authSession) => {
      if (!authSession) {
        setSession(null);
        setRequirePasswordChange(false);
        return;
      }
      const next = await authService.getSession();
      setSession(next);
      setRequirePasswordChange(await deriveRequirePasswordChange(next));
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (name: string, password: string) => {
    const result = await authService.login(name, password);
    if (result.success && result.session) {
      setSession(result.session);
      setRequirePasswordChange(!!result.requirePasswordChange);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setSession(null);
    setRequirePasswordChange(false);
    setIsStaffPreview(false);
  }, []);

  const refreshSession = useCallback(async () => {
    const next = await authService.getSession();
    setSession(next);
    setRequirePasswordChange(await deriveRequirePasswordChange(next));
  }, []);

  const completePasswordChange = useCallback(() => {
    setRequirePasswordChange(false);
  }, []);

  const enterStaffPreview = useCallback(async () => {
    const all = await employeeRepository.findAll();
    const staffEmployee = all.find((e) => e.role === 'staff' && e.status === 'active');
    setPreviewEmployeeId(staffEmployee?.id);
    setIsStaffPreview(true);
  }, []);

  const exitStaffPreview = useCallback(() => {
    setIsStaffPreview(false);
    setPreviewEmployeeId(undefined);
  }, []);

  const effectiveRole = isStaffPreview ? 'staff' : session?.role;
  const effectiveEmployeeId = isStaffPreview ? previewEmployeeId : session?.employeeId;

  return (
    <AuthContext.Provider
      value={{
        session,
        sessionLoading,
        requirePasswordChange,
        login,
        logout,
        refreshSession,
        completePasswordChange,
        isStaffPreview,
        enterStaffPreview,
        exitStaffPreview,
        effectiveRole,
        effectiveEmployeeId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.');
  return ctx;
}
