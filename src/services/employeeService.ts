import { supabase } from '@/lib/supabaseClient';
import { employeeRepository } from '@/repositories/employeeRepository';
import type { Employee, EmployeeStatus, UserRole, WageType } from '@/data/types';

export interface CreateEmployeeInput {
  name: string;
  phone: string;
  role: UserRole;
  position: string;
  wageType: WageType;
  hourlyWage?: number;
  monthlySalary?: number;
  hireDate: string;
  payday?: string;
}

export type LoginStatusFilter = 'pending' | 'completed';

export interface EmployeeFilter {
  keyword?: string;
  position?: string;
  status?: EmployeeStatus;
  wageType?: WageType;
  loginStatus?: LoginStatusFilter;
}

export interface BulkAccountCreationResult {
  total: number;
  created: number;
  existing: number;
  failed: number;
  failures: Array<{ employeeId: string; name: string; reason: string }>;
}

async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context) {
    try {
      const payload = await context.clone().json() as { error?: string };
      if (payload.error) return payload.error;
    } catch {
      // 응답 본문을 읽을 수 없으면 사용자용 기본 문구를 사용합니다.
    }
  }
  return fallback;
}

export const employeeService = {
  async list(filter?: EmployeeFilter): Promise<Employee[]> {
    const all = await employeeRepository.findAll();
    let list = all;
    if (filter?.keyword) {
      const kw = filter.keyword.trim();
      if (kw) list = list.filter((e) => e.name.includes(kw) || e.position.includes(kw));
    }
    if (filter?.position) list = list.filter((e) => e.position === filter.position);
    if (filter?.status) list = list.filter((e) => e.status === filter.status);
    if (filter?.wageType) list = list.filter((e) => e.wageType === filter.wageType);
    if (filter?.loginStatus === 'pending') list = list.filter((e) => e.isFirstLogin);
    if (filter?.loginStatus === 'completed') list = list.filter((e) => !e.isFirstLogin);
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  },

  async listActive(): Promise<Employee[]> {
    const all = await employeeRepository.findAll();
    return all.filter((e) => e.status === 'active');
  },

  // 첫 로그인을 아직 완료하지 않은 재직 직원 수 (관리자 대시보드용)
  async countPendingFirstLogin(): Promise<number> {
    const all = await employeeRepository.findAll();
    return all.filter((e) => e.role !== 'admin' && e.status !== 'resigned' && e.isFirstLogin).length;
  },

  async get(id: string): Promise<Employee | undefined> {
    return employeeRepository.findById(id);
  },

  // 신규 직원 + 로그인 계정 생성은 service role 권한이 필요해 Edge Function에서 처리합니다.
  // (supabase/functions/create-employee 참고, 배포 필요)
  async create(input: CreateEmployeeInput): Promise<Employee> {
    const { data, error } = await supabase.functions.invoke('create-employee', {
      body: {
        name: input.name,
        phone: input.phone,
        position: input.position,
        wageType: input.wageType,
        hourlyWage: input.hourlyWage,
        monthlySalary: input.monthlySalary,
        payday: input.payday,
        hireDate: input.hireDate,
      },
    });
    if (error) throw new Error(await functionErrorMessage(error, '계정 생성 실패'));
    if (data?.error) throw new Error(data.error);
    const employee = await employeeRepository.findById(data?.employee?.id);
    if (!employee) throw new Error('생성된 직원 정보를 확인할 수 없습니다.');
    return employee;
  },

  async update(id: string, patch: Partial<Employee>): Promise<Employee | undefined> {
    try {
      return await employeeRepository.update(id, patch);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === '23505' && patch.name !== undefined) {
        throw new Error('이미 존재하는 직원입니다.');
      }
      throw new Error('직원 정보 수정에 실패했습니다.');
    }
  },

  async setStatus(id: string, status: EmployeeStatus, resignDate?: string): Promise<Employee | undefined> {
    const patch: Partial<Employee> = { status };
    if (status === 'resigned') {
      patch.resignDate = resignDate ?? new Date().toISOString().slice(0, 10);
    }
    // 퇴사 처리 시 로그인 계정 비활성화도 함께 필요하지만, Auth 유저 삭제/차단은
    // service role 권한이 필요합니다. 필요 시 create-employee와 같은 방식으로
    // 별도 Edge Function(disable-employee)을 추가해 처리해주세요.
    return employeeRepository.update(id, patch);
  },

  async changeRole(id: string, role: UserRole): Promise<Employee | undefined> {
    return employeeRepository.update(id, { role });
  },

  async changeWage(id: string, wageType: WageType, amount: number): Promise<Employee | undefined> {
    if (wageType === 'hourly') {
      return employeeRepository.update(id, { wageType, hourlyWage: amount, monthlySalary: undefined });
    }
    return employeeRepository.update(id, { wageType, monthlySalary: amount, hourlyWage: undefined });
  },

  // 비밀번호 초기화도 service role 권한이 필요해 Edge Function에서 처리합니다.
  // (supabase/functions/reset-employee-password 참고, 배포 필요)
  async resetPassword(id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('reset-employee-password', {
      body: { employeeId: id },
    });
    if (error) throw new Error(await functionErrorMessage(error, '비밀번호 초기화에 실패했습니다.'));
    if (data?.error) throw new Error(data.error);
  },

  // Auth 계정과 직원 행을 함께 삭제해야 하므로 service role을 사용하는 Edge Function에서 처리합니다.
  async deleteEmployee(id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('delete-employee', {
      body: { employeeId: id },
    });
    if (error) throw new Error(await functionErrorMessage(error, '직원 삭제에 실패했습니다.'));
    if (data?.error) throw new Error(data.error);
    if (!data?.success) throw new Error('직원 삭제 결과를 확인할 수 없습니다.');
  },

  async createAccountsForExistingEmployees(): Promise<BulkAccountCreationResult> {
    const { data, error } = await supabase.functions.invoke('bulk-create-employee-accounts', {
      body: {},
    });
    if (error) {
      throw new Error(await functionErrorMessage(error, '기존 직원 계정 생성에 실패했습니다.'));
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.success) throw new Error('계정 생성 결과를 확인할 수 없습니다.');
    return {
      total: Number(data.total) || 0,
      created: Number(data.created) || 0,
      existing: Number(data.existing) || 0,
      failed: Number(data.failed) || 0,
      failures: Array.isArray(data.failures) ? data.failures : [],
    };
  },

  async listPositions(): Promise<string[]> {
    const all = await employeeRepository.findAll();
    return Array.from(new Set(all.map((e) => e.position)));
  },
};
