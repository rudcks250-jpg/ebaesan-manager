import { supabase } from '@/lib/supabaseClient';
import { employeeRepository } from '@/repositories/employeeRepository';
import type { Employee, EmployeeStatus, UserRole, WageType } from '@/data/types';
import { MANAGED_EMPLOYEE_ROSTER } from '@/data/employeeRoster';

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

let rosterSyncPromise: Promise<void> | undefined;

function syncManagedRoster(): Promise<void> {
  rosterSyncPromise ??= employeeRepository.syncManagedRoster(MANAGED_EMPLOYEE_ROSTER);
  return rosterSyncPromise;
}

export const employeeService = {
  async list(filter?: EmployeeFilter): Promise<Employee[]> {
    await syncManagedRoster();
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
    await syncManagedRoster();
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
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return (await employeeRepository.findById(data.employee.id))!;
  },

  async update(id: string, patch: Partial<Employee>): Promise<Employee | undefined> {
    return employeeRepository.update(id, patch);
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
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  },

  // Auth 계정과 직원 행을 함께 삭제해야 하므로 service role을 사용하는 Edge Function에서 처리합니다.
  async deleteEmployee(id: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('delete-employee', {
      body: { employeeId: id },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.success) throw new Error('직원 삭제 결과를 확인할 수 없습니다.');
  },

  async listPositions(): Promise<string[]> {
    const all = await employeeRepository.findAll();
    return Array.from(new Set(all.map((e) => e.position)));
  },
};
