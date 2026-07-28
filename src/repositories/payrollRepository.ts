import { supabase } from '@/lib/supabaseClient';
import { rowToPayrollSettlement } from '@/lib/mappers';
import type { PayrollSettlement } from '@/data/types';

export const payrollRepository = {
  async findAll(): Promise<PayrollSettlement[]> {
    const { data, error } = await supabase.from('payrolls').select('*');
    if (error) throw error;
    return (data ?? []).map(rowToPayrollSettlement);
  },

  async findByEmployeeAndMonth(employeeId: string, yearMonth: string): Promise<PayrollSettlement | undefined> {
    const { data, error } = await supabase
      .from('payrolls')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('year_month', yearMonth)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPayrollSettlement(data) : undefined;
  },

  async upsert(employeeId: string, yearMonth: string, settled: boolean): Promise<PayrollSettlement> {
    const { data, error } = await supabase
      .from('payrolls')
      .upsert(
        {
          employee_id: employeeId,
          year_month: yearMonth,
          settled,
          settled_at: settled ? new Date().toISOString() : null,
        },
        { onConflict: 'employee_id,year_month' }
      )
      .select()
      .single();
    if (error) throw error;
    return rowToPayrollSettlement(data);
  },
};
