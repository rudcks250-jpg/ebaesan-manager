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
    const rows = requests.map((request) => ({
      employee_id: request.employeeId,
      request_group_id: request.requestGroupId,
      requested_date: request.requestedDate,
      reason: request.reason,
      // 운영 DB에 월차 마이그레이션이 아직 없는 환경과 호환되도록 일반 휴무는
      // DB 기본값을 사용합니다. 월차일 때만 leave_type 컬럼을 전송합니다.
      ...(request.leaveType === 'monthly' ? { leave_type: request.leaveType } : {}),
      status: request.status,
    }));
    const { data, error } = await supabase
      .from('leave_requests')
      .insert(rows)
      .select();
    if (!error) return (data ?? []).map(rowToLeave);

    console.error('[LeaveRequest] insert failed', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      payload: rows,
    });

    // 다중 신청 UI가 먼저 배포되고 request_group_id 마이그레이션이 아직 적용되지
    // 않은 운영 DB에서도 전체 날짜를 하나의 bulk INSERT로 원자적으로 저장합니다.
    // 첫 INSERT는 스키마 검증 단계에서 실패하므로 일부 row가 저장되는 일은 없습니다.
    const missingGroupColumn =
      error.code === 'PGRST204' && error.message.includes('request_group_id');
    if (!missingGroupColumn) throw error;

    const compatibleRows = rows.map(({ request_group_id: _requestGroupId, ...row }) => row);
    const fallback = await supabase
      .from('leave_requests')
      .insert(compatibleRows)
      .select();
    if (fallback.error) {
      console.error('[LeaveRequest] compatible insert failed', {
        code: fallback.error.code,
        message: fallback.error.message,
        details: fallback.error.details,
        hint: fallback.error.hint,
        payload: compatibleRows,
      });
      throw fallback.error;
    }
    return (fallback.data ?? []).map(rowToLeave);
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
