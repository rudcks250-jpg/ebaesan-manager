import { supabase } from '@/lib/supabaseClient';
import { rowToEmployee, employeeToRow } from '@/lib/mappers';
import type { Employee } from '@/data/types';
import type { ManagedEmployeeRecord } from '@/data/employeeRoster';

export const employeeRepository = {
  async normalizeAdministratorProfile(employee: Employee): Promise<Employee> {
    if (employee.role !== 'admin') return employee;

    const { data: duplicates, error: duplicateError } = await supabase
      .from('employees')
      .select('id')
      .eq('name', '박경찬')
      .neq('id', employee.id);
    if (duplicateError) throw duplicateError;

    for (const duplicate of duplicates ?? []) {
      const { data: schedules, error: scheduleReadError } = await supabase
        .from('schedules')
        .select('date,status,start_time,end_time,source,memo')
        .eq('employee_id', duplicate.id);
      if (scheduleReadError) throw scheduleReadError;
      if ((schedules ?? []).length > 0) {
        const { error } = await supabase.from('schedules').upsert(
          schedules!.map((row) => ({
            ...row,
            employee_id: employee.id,
            updated_by: employee.id,
          })),
          { onConflict: 'employee_id,date' },
        );
        if (error) throw error;
      }

      const { data: attendance, error: attendanceReadError } = await supabase
        .from('attendance')
        .select('date,clock_in,clock_out,break_minutes,worked_minutes,memo,is_auto_clock_in')
        .eq('employee_id', duplicate.id);
      if (attendanceReadError) throw attendanceReadError;
      if ((attendance ?? []).length > 0) {
        const { error } = await supabase.from('attendance').upsert(
          attendance!.map((row) => ({
            ...row,
            employee_id: employee.id,
            edited_by: employee.id,
          })),
          { onConflict: 'employee_id,date' },
        );
        if (error) throw error;
      }

      const { data: payrolls, error: payrollReadError } = await supabase
        .from('payrolls')
        .select('year_month,settled,settled_at')
        .eq('employee_id', duplicate.id);
      if (payrollReadError) throw payrollReadError;
      if ((payrolls ?? []).length > 0) {
        const { error } = await supabase.from('payrolls').upsert(
          payrolls!.map((row) => ({ ...row, employee_id: employee.id })),
          { onConflict: 'employee_id,year_month' },
        );
        if (error) throw error;
      }

      const referenceUpdates = await Promise.all([
        supabase.from('leave_requests').update({ employee_id: employee.id }).eq('employee_id', duplicate.id),
        supabase.from('leave_requests').update({ processed_by: employee.id }).eq('processed_by', duplicate.id),
        supabase.from('schedules').update({ updated_by: employee.id }).eq('updated_by', duplicate.id),
        supabase.from('attendance').update({ edited_by: employee.id }).eq('edited_by', duplicate.id),
      ]);
      const referenceError = referenceUpdates.find((result) => result.error)?.error;
      if (referenceError) throw referenceError;

      const { error: deleteError } = await supabase.from('employees').delete().eq('id', duplicate.id);
      if (deleteError) throw deleteError;
    }

    const { data: normalized, error: updateError } = await supabase
      .from('employees')
      .update({
        name: '박경찬',
        position: '대표',
        status: 'active',
      })
      .eq('id', employee.id)
      .select()
      .single();
    if (updateError) throw updateError;
    return rowToEmployee(normalized);
  },

  async syncManagedRoster(roster: readonly ManagedEmployeeRecord[]): Promise<void> {
    const names = roster.map((employee) => employee.name);
    const { data: existingRows, error: selectError } = await supabase
      .from('employees')
      .select('id,name')
      .in('name', names);

    if (selectError) throw selectError;

    const existingIdByName = new Map<string, string>();
    for (const row of existingRows ?? []) {
      if (!existingIdByName.has(row.name)) existingIdByName.set(row.name, row.id);
    }

    for (const employee of roster) {
      const commonValues = {
        name: employee.name,
        phone: employee.phone,
        role: 'staff',
        position: employee.position,
        wage_type: employee.wageType,
        payday: employee.payday,
        hourly_wage: employee.wageType === 'hourly' ? employee.hourlyWage ?? null : null,
        monthly_salary: employee.wageType === 'monthly' ? employee.monthlySalary ?? null : null,
        status: 'active',
      };
      const existingId = existingIdByName.get(employee.name);

      const { error } = existingId
        ? await supabase.from('employees').update(commonValues).eq('id', existingId)
        : await supabase.from('employees').insert({
            ...commonValues,
            auth_user_id: null,
            login_email: `pending.${employee.key}@ebaesan.invalid`,
            hire_date: new Date().toISOString().slice(0, 10),
            is_first_login: true,
          });

      if (error) throw error;
    }
  },

  async findAll(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('name');

    if (error) throw error;

    return (data ?? []).map(rowToEmployee);
  },

  async findById(id: string): Promise<Employee | undefined> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return data ? rowToEmployee(data) : undefined;
  },

  async findByAuthUserId(authUserId: string): Promise<Employee | undefined> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) throw error;

    return data ? rowToEmployee(data) : undefined;
  },

  async update(
    id: string,
    patch: Partial<Employee>,
  ): Promise<Employee | undefined> {
    const { data, error } = await supabase
      .from('employees')
      .update(employeeToRow(patch))
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return data ? rowToEmployee(data) : undefined;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
