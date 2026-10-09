import { supabase } from '@/lib/supabaseClient';
import type { Employee, ShiftEntry, ShiftStatus } from '@/data/types';

interface SubstituteRow {
  id: string;
  week_start_date: string;
  name: string;
  memo: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SubstituteShiftRow {
  id: string;
  substitute_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  status: ShiftStatus;
  memo: string | null;
  updated_by: string;
  updated_at: string;
}

const missingTable = (error: { code?: string; message?: string } | null) =>
  error?.code === '42P01' || error?.code === 'PGRST205' || error?.message?.includes('schedule_substitutes');

const missingCreateFunction = (error: { code?: string; message?: string } | null) =>
  error?.code === '42883' ||
  error?.code === 'PGRST202' ||
  error?.message?.includes('create_schedule_substitutes');

export interface SubstituteDraftInput {
  name: string;
  memo?: string;
  shifts: Array<{
    date: string;
    status: 'working' | 'off';
    startTime: string | null;
    endTime: string | null;
  }>;
}

export const scheduleSubstituteRepository = {
  async getWeekBoard(startDate: string, endDate: string): Promise<{ employees: Employee[]; shifts: ShiftEntry[] }> {
    const substituteResult = await supabase
      .from('schedule_substitutes')
      .select('*')
      .eq('week_start_date', startDate)
      .order('created_at');
    if (substituteResult.error) {
      if (missingTable(substituteResult.error)) return { employees: [], shifts: [] };
      throw substituteResult.error;
    }
    const substitutes = (substituteResult.data ?? []) as SubstituteRow[];
    if (substitutes.length === 0) return { employees: [], shifts: [] };

    const shiftResult = await supabase
      .from('schedule_substitute_shifts')
      .select('*')
      .in('substitute_id', substitutes.map((item) => item.id))
      .gte('date', startDate)
      .lte('date', endDate);
    if (shiftResult.error) throw shiftResult.error;

    return {
      employees: substitutes.map((item) => ({
        id: item.id,
        name: item.name,
        phone: '',
        role: 'employee',
        position: '일회성 대타',
        wageType: 'hourly',
        status: 'active',
        hireDate: '',
        isFirstLogin: false,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        isSubstitute: true,
        substituteMemo: item.memo ?? undefined,
      })),
      shifts: ((shiftResult.data ?? []) as SubstituteShiftRow[]).map((item) => ({
        id: item.id,
        employeeId: item.substitute_id,
        date: item.date,
        startTime: item.start_time,
        endTime: item.end_time,
        status: item.status,
        source: 'substitute',
        memo: item.memo ?? undefined,
        updatedAt: item.updated_at,
        updatedBy: item.updated_by ?? '',
      })),
    };
  },

  async createMany(weekStartDate: string, entries: SubstituteDraftInput[]): Promise<void> {
    const { error } = await supabase.rpc('create_schedule_substitutes', {
      p_week_start: weekStartDate,
      p_entries: entries,
    });
    if (!error) return;
    if (!missingCreateFunction(error)) throw error;

    // 운영 DB에 테이블은 있지만 RPC 함수만 아직 없거나 PostgREST 캐시가 늦게
    // 갱신된 경우에도 이름과 근무시간만으로 등록할 수 있도록 단순 저장합니다.
    const actorResult = await supabase.rpc('current_employee_id');
    if (actorResult.error || !actorResult.data) throw actorResult.error ?? error;
    const actorId = String(actorResult.data);

    for (const entry of entries) {
      const substituteResult = await supabase
        .from('schedule_substitutes')
        .insert({
          week_start_date: weekStartDate,
          name: entry.name.trim(),
          memo: entry.memo?.trim() || null,
          created_by: actorId,
        })
        .select('id')
        .single();
      if (substituteResult.error) throw substituteResult.error;

      const substituteId = substituteResult.data.id as string;
      const shifts = entry.shifts.map((shift) => ({
        substitute_id: substituteId,
        date: shift.date,
        status: shift.status,
        start_time: shift.status === 'working' ? shift.startTime : null,
        end_time: shift.status === 'working' ? shift.endTime : null,
        updated_by: actorId,
      }));
      const shiftResult = await supabase.from('schedule_substitute_shifts').insert(shifts);
      if (shiftResult.error) {
        await supabase.from('schedule_substitutes').delete().eq('id', substituteId);
        throw shiftResult.error;
      }
    }
  },

  async upsertShift(
    substituteId: string,
    date: string,
    input: { status: 'working' | 'off'; startTime: string | null; endTime: string | null; memo?: string },
    updatedBy: string,
  ): Promise<void> {
    const { error } = await supabase.from('schedule_substitute_shifts').upsert({
      substitute_id: substituteId,
      date,
      status: input.status,
      start_time: input.startTime,
      end_time: input.endTime,
      memo: input.memo ?? null,
      updated_by: updatedBy,
    }, { onConflict: 'substitute_id,date' });
    if (error) throw error;
  },

  async removeShift(substituteId: string, date: string): Promise<void> {
    const { error } = await supabase.from('schedule_substitute_shifts').delete().eq('substitute_id', substituteId).eq('date', date);
    if (error) throw error;
  },

  async removeSubstitute(substituteId: string): Promise<void> {
    const { error } = await supabase.from('schedule_substitutes').delete().eq('id', substituteId);
    if (error) throw error;
  },

  async removeWeek(weekStartDate: string): Promise<void> {
    const { error } = await supabase.from('schedule_substitutes').delete().eq('week_start_date', weekStartDate);
    if (error && !missingTable(error)) throw error;
  },
};
