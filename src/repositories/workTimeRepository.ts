import { supabase } from '@/lib/supabaseClient';
import { rowToWorkTime } from '@/lib/mappers';
import type { WorkTimeRecord } from '@/data/types';

export const workTimeRepository = {
  async findAll(): Promise<WorkTimeRecord[]> {
    const { data, error } = await supabase.from('attendance').select('*');
    if (error) throw error;
    return (data ?? []).map(rowToWorkTime);
  },

  async findByEmployee(employeeId: string): Promise<WorkTimeRecord[]> {
    const { data, error } = await supabase.from('attendance').select('*').eq('employee_id', employeeId);
    if (error) throw error;
    return (data ?? []).map(rowToWorkTime);
  },

  async findByEmployeeAndDate(employeeId: string, date: string): Promise<WorkTimeRecord | undefined> {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToWorkTime(data) : undefined;
  },

  async upsert(
    employeeId: string,
    date: string,
    patch: {
      clockIn?: string | null;
      clockOut?: string | null;
      breakMinutes?: number;
      workedMinutes?: number | null;
      memo?: string;
      isAutoClockIn?: boolean;
      editedBy?: string;
    }
  ): Promise<WorkTimeRecord> {
    const row: Record<string, unknown> = { employee_id: employeeId, date };
    if (patch.clockIn !== undefined) row.clock_in = patch.clockIn;
    if (patch.clockOut !== undefined) row.clock_out = patch.clockOut;
    if (patch.breakMinutes !== undefined) row.break_minutes = patch.breakMinutes;
    if (patch.workedMinutes !== undefined) row.worked_minutes = patch.workedMinutes;
    if (patch.memo !== undefined) row.memo = patch.memo;
    if (patch.isAutoClockIn !== undefined) row.is_auto_clock_in = patch.isAutoClockIn;
    if (patch.editedBy !== undefined) row.edited_by = patch.editedBy;

    const { data, error } = await supabase
      .from('attendance')
      .upsert(row, { onConflict: 'employee_id,date' })
      .select()
      .single();
    if (error) throw error;
    return rowToWorkTime(data);
  },
};
