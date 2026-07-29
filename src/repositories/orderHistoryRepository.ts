import { supabase } from '@/lib/supabaseClient';

export interface OrderCompletion {
  id: string;
  vendorId: string;
  vendorName: string;
  completedBy: string;
  completedByName: string;
  completedAt: string;
}

function mapCompletion(row: Record<string, string>): OrderCompletion {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    vendorName: row.vendor_name,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name,
    completedAt: row.completed_at,
  };
}

export const orderHistoryRepository = {
  async findLatest(vendorId: string): Promise<OrderCompletion | undefined> {
    const { data, error } = await supabase
      .from('order_completions')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapCompletion(data) : undefined;
  },

  async record(input: {
    vendorId: string;
    vendorName: string;
    completedBy: string;
    completedByName: string;
  }): Promise<OrderCompletion> {
    const { data, error } = await supabase
      .from('order_completions')
      .insert({
        vendor_id: input.vendorId,
        vendor_name: input.vendorName,
        completed_by: input.completedBy,
        completed_by_name: input.completedByName,
      })
      .select()
      .single();
    if (error) throw error;
    return mapCompletion(data);
  },
};
