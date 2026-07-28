import { supabase } from '@/lib/supabaseClient';
import { rowToShift } from '@/lib/mappers';
import { getWeekDates } from '@/utils/date';
import type { ShiftEntry, ShiftStatus } from '@/data/types';

// 스케줄 저장소 (Supabase 연동판).
// DB의 schedules 테이블은 "주(week)" 개념 없이 직원×날짜 단위의 평평한(flat) 행으로 저장되고,
// "이번 주 스케줄" 같은 주 단위 뷰는 scheduleService에서 날짜 범위로 조회해 구성합니다.

export const scheduleRepository = {
  async findByDateRange(startDate: string, endDate: string): Promise<ShiftEntry[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;
    return (data ?? []).map(rowToShift);
  },

  async findOne(employeeId: string, date: string): Promise<ShiftEntry | undefined> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToShift(data) : undefined;
  },

  async upsertShift(
    employeeId: string,
    date: string,
    input: { status: ShiftStatus; startTime: string | null; endTime: string | null; source: 'manual' | 'leaveApproved'; memo?: string },
    updatedBy: string
  ): Promise<ShiftEntry> {
    const { data, error } = await supabase
      .from('schedules')
      .upsert(
        {
          employee_id: employeeId,
          date,
          status: input.status,
          start_time: input.startTime,
          end_time: input.endTime,
          source: input.source,
          memo: input.memo ?? null,
          updated_by: updatedBy,
        },
        { onConflict: 'employee_id,date' }
      )
      .select()
      .single();
    if (error) throw error;
    return rowToShift(data);
  },

  async insertShiftIfMissing(
    employeeId: string,
    date: string,
    input: { startTime: string; endTime: string },
    updatedBy: string
  ): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .upsert(
        {
          employee_id: employeeId,
          date,
          status: 'working',
          start_time: input.startTime,
          end_time: input.endTime,
          source: 'manual',
          memo: null,
          updated_by: updatedBy,
        },
        { onConflict: 'employee_id,date', ignoreDuplicates: true }
      );
    if (error) throw error;
  },

  async removeShift(employeeId: string, date: string): Promise<void> {
    const { error } = await supabase.from('schedules').delete().eq('employee_id', employeeId).eq('date', date);
    if (error) throw error;
  },

  async removeByDateRange(startDate: string, endDate: string): Promise<void> {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .gte('date', startDate)
      .lte('date', endDate);
    if (error) throw error;
  },
};

// 화면과 저장소가 동일한 월~일 날짜 배열을 사용하도록 단일화합니다.
// index 6은 월요일 기준 일요일이며 UTC 직렬화를 거치지 않습니다.
export function weekEndDate(weekStartDate: string): string {
  return getWeekDates(weekStartDate)[6];
}
