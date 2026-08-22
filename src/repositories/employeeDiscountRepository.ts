import { supabase } from '@/lib/supabaseClient';
import type { EmployeeDiscountRequest, EmployeeDiscountSetting } from '@/data/types';

function mapRequest(row: Record<string, unknown>): EmployeeDiscountRequest {
  return {
    id: String(row.id), employeeId: String(row.employee_id), requestedAt: String(row.requested_at),
    expiresAt: String(row.expires_at), status: row.status as EmployeeDiscountRequest['status'],
    originalAmount: row.original_amount == null ? undefined : Number(row.original_amount),
    discountRate: Number(row.discount_rate), discountAmount: row.discount_amount == null ? undefined : Number(row.discount_amount),
    finalAmount: row.final_amount == null ? undefined : Number(row.final_amount),
    processedAt: row.processed_at ? String(row.processed_at) : undefined,
    processedBy: row.processed_by ? String(row.processed_by) : undefined,
    restoredAt: row.restored_at ? String(row.restored_at) : undefined,
  };
}

function mapSetting(row: Record<string, unknown>): EmployeeDiscountSetting {
  return { employeeId: String(row.employee_id), monthlyLimit: Number(row.monthly_limit), discountRate: Number(row.discount_rate) };
}

export const employeeDiscountRepository = {
  async listRequests(from: string, to: string) {
    const { data, error } = await supabase.from('employee_discount_requests').select('*').gte('requested_at', from).lt('requested_at', to).order('requested_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRequest);
  },
  async listMyRequests(employeeId: string, from: string, to: string) {
    const { data, error } = await supabase.from('employee_discount_requests').select('*').eq('employee_id', employeeId).gte('requested_at', from).lt('requested_at', to).order('requested_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapRequest);
  },
  async listSettings() {
    const { data, error } = await supabase.from('employee_discount_settings').select('*');
    if (error) throw error;
    return (data ?? []).map(mapSetting);
  },
  async getMySetting(employeeId: string) {
    const { data, error } = await supabase.from('employee_discount_settings').select('*').eq('employee_id', employeeId).maybeSingle();
    if (error) throw error;
    return data ? mapSetting(data) : { employeeId, monthlyLimit: 2, discountRate: 0.2 };
  },
  async create() {
    const { data, error } = await supabase.rpc('create_employee_discount_request');
    if (error) throw error;
    return mapRequest(data as Record<string, unknown>);
  },
  async complete(id: string, originalAmount: number) {
    const { data, error } = await supabase.rpc('complete_employee_discount_request', { p_request_id: id, p_original_amount: originalAmount });
    if (error) throw error;
    return mapRequest(data as Record<string, unknown>);
  },
  async cancel(id: string) {
    const { data, error } = await supabase.rpc('cancel_employee_discount_request', { p_request_id: id });
    if (error) throw error;
    return mapRequest(data as Record<string, unknown>);
  },
  async saveSetting(setting: EmployeeDiscountSetting, updatedBy: string) {
    const { data, error } = await supabase.from('employee_discount_settings').upsert({ employee_id: setting.employeeId, monthly_limit: setting.monthlyLimit, discount_rate: setting.discountRate, updated_by: updatedBy }).select().single();
    if (error) throw error;
    return mapSetting(data);
  },
  async adminSave(input: { id?: string; employeeId: string; requestedAt: string; originalAmount: number }) {
    const { data, error } = await supabase.rpc('admin_save_employee_discount', { p_request_id: input.id ?? null, p_employee_id: input.employeeId, p_requested_at: input.requestedAt, p_original_amount: input.originalAmount });
    if (error) throw error;
    return mapRequest(data as Record<string, unknown>);
  },
};
