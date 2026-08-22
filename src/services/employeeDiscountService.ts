import { employeeDiscountRepository } from '@/repositories/employeeDiscountRepository';
import { employeeService } from '@/services/employeeService';
import type { EmployeeDiscountRequest } from '@/data/types';

function localMonthRange(key: string) {
  const [year, month] = key.split('-').map(Number);
  const from = new Date(year, month - 1, 1).toISOString();
  const to = new Date(year, month, 1).toISOString();
  return { from, to };
}

function todayRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  return { from, to };
}

function expiry(request: EmployeeDiscountRequest): EmployeeDiscountRequest {
  return request.status === 'pending' && new Date(request.expiresAt).getTime() <= Date.now() ? { ...request, status: 'expired' } : request;
}

async function withNames(requests: EmployeeDiscountRequest[]) {
  const employees = await employeeService.listActive();
  const nameById = new Map(employees.map((employee) => [employee.id, employee.name]));
  return requests.map((request) => expiry({ ...request, employeeName: nameById.get(request.employeeId), processedByName: request.processedBy ? nameById.get(request.processedBy) : undefined }));
}

export const employeeDiscountService = {
  async getMine(employeeId: string, month: string) {
    const range = localMonthRange(month);
    const [requests, setting] = await Promise.all([employeeDiscountRepository.listMyRequests(employeeId, range.from, range.to), employeeDiscountRepository.getMySetting(employeeId)]);
    return { requests: requests.map(expiry), setting };
  },
  async getToday() {
    const range = todayRange();
    return withNames(await employeeDiscountRepository.listRequests(range.from, range.to));
  },
  async getAdminMonth(month: string) {
    const range = localMonthRange(month);
    const [requests, settings, employees] = await Promise.all([withNames(await employeeDiscountRepository.listRequests(range.from, range.to)), employeeDiscountRepository.listSettings(), employeeService.listActive()]);
    return { requests, settings, employees };
  },
  create: employeeDiscountRepository.create,
  complete: employeeDiscountRepository.complete,
  cancel: employeeDiscountRepository.cancel,
  saveSetting: employeeDiscountRepository.saveSetting,
  adminSave: employeeDiscountRepository.adminSave,
};
