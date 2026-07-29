import { supabase } from '@/lib/supabaseClient';
import type { OpeningPreparation, OpeningPreparationItem } from '@/data/types';

function mapPreparation(row: Record<string, unknown>): OpeningPreparation {
  return {
    id: String(row.id),
    targetDate: String(row.target_date),
    items: (row.items ?? []) as OpeningPreparationItem[],
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : undefined,
    confirmedBy: row.confirmed_by ? String(row.confirmed_by) : undefined,
    confirmedByName: row.confirmed_by_name ? String(row.confirmed_by_name) : undefined,
    updatedAt: String(row.updated_at),
    updatedBy: row.updated_by ? String(row.updated_by) : undefined,
  };
}

export const openingPreparationRepository = {
  async findByDates(dates: string[]): Promise<OpeningPreparation[]> {
    const { data, error } = await supabase
      .from('opening_preparations')
      .select('*')
      .in('target_date', dates)
      .order('target_date');
    if (error) throw error;
    return (data ?? []).map(mapPreparation);
  },

  async save(input: {
    targetDate: string;
    items: OpeningPreparationItem[];
    updatedBy: string;
  }): Promise<OpeningPreparation> {
    const { data, error } = await supabase
      .from('opening_preparations')
      .upsert(
        {
          target_date: input.targetDate,
          items: input.items,
          updated_by: input.updatedBy,
        },
        { onConflict: 'target_date' },
      )
      .select()
      .single();
    if (error) throw error;
    return mapPreparation(data);
  },

  async confirm(input: {
    targetDate: string;
    items: OpeningPreparationItem[];
    employeeId: string;
    employeeName: string;
  }): Promise<OpeningPreparation> {
    const { data, error } = await supabase
      .from('opening_preparations')
      .upsert(
        {
          target_date: input.targetDate,
          items: input.items,
          confirmed_at: new Date().toISOString(),
          confirmed_by: input.employeeId,
          confirmed_by_name: input.employeeName,
          updated_by: input.employeeId,
        },
        { onConflict: 'target_date' },
      )
      .select()
      .single();
    if (error) throw error;
    return mapPreparation(data);
  },
};
