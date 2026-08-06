import { supabase } from '@/lib/supabaseClient';
import { rowToLeave } from '@/lib/mappers';
import type { LeaveRequest } from '@/data/types';

export const leaveRepository = {
  async findAll(): Promise<LeaveRequest[]> {
    const { data, error } = await supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToLeave);
  },

  async findByEmployee(employeeId: string): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToLeave);
  },

  async findById(id: string): Promise<LeaveRequest | undefined> {
    const { data, error } = await supabase.from('leave_requests').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToLeave(data) : undefined;
  },

  async insert(request: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<LeaveRequest> {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: request.employeeId,
        request_group_id: request.requestGroupId,
        requested_date: request.requestedDate,
        reason: request.reason,
        ...(request.leaveType === 'monthly' ? { leave_type: request.leaveType } : {}),
        status: request.status,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToLeave(data);
  },

  async insertMany(requests: Omit<LeaveRequest, 'id' | 'createdAt'>[]): Promise<LeaveRequest[]> {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert(requests.map((request) => ({
        employee_id: request.employeeId,
        request_group_id: request.requestGroupId,
        requested_date: request.requestedDate,
        reason: request.reason,
        leave_type: request.leaveType,
        status: request.status,
      })))
      .select();
    if (error) throw error;
    return (data ?? []).map(rowToLeave);
  },

  async update(id: string, patch: Partial<LeaveRequest>): Promise<LeaveRequest | undefined> {
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.rejectReason !== undefined) row.reject_reason = patch.rejectReason;
    if (patch.processedAt !== undefined) row.processed_at = patch.processedAt;
    if (patch.processedBy !== undefined) row.processed_by = patch.processedBy;

    const { data, error } = await supabase.from('leave_requests').update(row).eq('id', id).select().maybeSingle();
    if (error) throw error;
    return data ? rowToLeave(data) : undefined;
  },
};
