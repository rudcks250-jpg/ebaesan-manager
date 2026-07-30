import { supabase } from '@/lib/supabaseClient';
import { employeeRepository } from '@/repositories/employeeRepository';
import type { AuthSession } from '@/data/types';

// =========================================================
// 인증 서비스 (Supabase Auth 연동판)
// -----------------------------------------------------------
// 화면에는 "이름 + 비밀번호"로 보이지만, 내부적으로는 직원 등록 시
// 자동 생성된 login_email(예: emp-xxxx@ebaesan.local)로 Supabase Auth에
// 로그인합니다. 이름 -> 이메일 조회는 RLS를 우회할 필요가 있어 Postgres
// 함수(lookup_login_email, supabase/schema.sql 참고)를 anon 권한으로 호출합니다.
// =========================================================

export interface LoginResult {
  success: boolean;
  session?: AuthSession;
  requirePasswordChange?: boolean;
  errorMessage?: string;
}

export const authService = {
  async login(name: string, password: string): Promise<LoginResult> {
    const normalizedName = name.trim().replace(/\s+/g, ' ');
    const normalizedPassword = password.trim().replace(/[\s-]/g, '');
    let { data: loginEmail, error: lookupError } = await supabase.rpc('lookup_login_email', {
      p_name: normalizedName,
    });

    if (lookupError || !loginEmail) {
      const repair = await supabase.functions.invoke('sync-employee-account', {
        body: { mode: 'repair-login', name: normalizedName, password: normalizedPassword },
      });
      if (repair.error) {
        return { success: false, errorMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' };
      }
      const lookupRetry = await supabase.rpc('lookup_login_email', { p_name: normalizedName });
      loginEmail = lookupRetry.data;
      lookupError = lookupRetry.error;
      if (lookupError || !loginEmail) {
        return { success: false, errorMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' };
      }
    }

    let { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: normalizedPassword,
    });

    if (error || !data.user) {
      const { error: repairError } = await supabase.functions.invoke('sync-employee-account', {
        body: { mode: 'repair-login', name: normalizedName, password: normalizedPassword },
      });
      if (!repairError) {
        const lookupRetry = await supabase.rpc('lookup_login_email', { p_name: normalizedName });
        const retry = await supabase.auth.signInWithPassword({
          email: lookupRetry.data || loginEmail,
          password: normalizedPassword,
        });
        data = retry.data;
        error = retry.error;
      }
    }

    if (error || !data.user) {
      return { success: false, errorMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    const foundEmployee = await employeeRepository.findByAuthUserId(data.user.id);
    const employee = foundEmployee ? await employeeRepository.normalizeAdministratorProfile(foundEmployee) : undefined;
    if (!employee) {
      await supabase.auth.signOut();
      return { success: false, errorMessage: '직원 정보를 찾을 수 없습니다. 관리자에게 문의하세요.' };
    }
    if (employee.status === 'inactive') {
      await supabase.auth.signOut();
      return { success: false, errorMessage: '비활성화된 계정입니다. 관리자에게 문의하세요.' };
    }
    if (employee.status === 'resigned') {
      await supabase.auth.signOut();
      return { success: false, errorMessage: '아이디 또는 비밀번호가 올바르지 않습니다.' };
    }

    await employeeRepository.update(employee.id, { lastLoginAt: new Date().toISOString() });

    const session: AuthSession = { employeeId: employee.id, name: employee.name, role: employee.role };
    return {
      success: true,
      session,
      requirePasswordChange: employee.role !== 'admin' && employee.isFirstLogin,
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  // 현재 Supabase Auth 세션을 기준으로 앱 세션(AuthSession)을 구성합니다.
  // 새로고침 시 App 최상단(AuthContext)에서 호출됩니다.
  async getSession(): Promise<AuthSession | null> {
    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) return null;
    const foundEmployee = await employeeRepository.findByAuthUserId(authUser.id);
    const employee = foundEmployee ? await employeeRepository.normalizeAdministratorProfile(foundEmployee) : undefined;
    if (!employee) return null;
    return { employeeId: employee.id, name: employee.name, role: employee.role };
  },

  // 첫 로그인 후 비밀번호 변경 (본인 세션 기준)
  async changePassword(employeeId: string, newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    const { error: flagError } = await supabase.rpc('complete_first_login', {
      p_employee_id: employeeId,
    });
    if (flagError) throw flagError;
  },

  // 비밀번호 초기화는 다른 사용자의 인증정보를 바꾸는 작업이라 service role 권한이
  // 필요합니다 -> employeeService.resetPassword()에서 Edge Function으로 처리합니다.
};
