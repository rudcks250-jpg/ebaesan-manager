import { supabase } from '@/lib/supabaseClient';
import type { PrepaidAccount, PrepaidUsage } from '@/data/types';

function mapAccount(row: Record<string, unknown>, lastUsedAt?: string): PrepaidAccount {
  return {
    id: String(row.id),
    companyName: String(row.company_name),
    contactPerson: String(row.contact_person),
    phone: row.phone ? String(row.phone) : undefined,
    initialAmount: Number(row.initial_amount),
    balance: Number(row.balance),
    memo: row.memo ? String(row.memo) : undefined,
    createdBy: String(row.created_by),
    createdByName: String(row.created_by_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastUsedAt,
  };
}

function mapUsage(row: Record<string, unknown>): PrepaidUsage {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    amount: Number(row.amount),
    memo: row.memo ? String(row.memo) : undefined,
    usedBy: String(row.used_by),
    usedByName: String(row.used_by_name),
    usedAt: String(row.used_at),
  };
}

export const prepaidRepository = {
  async findAll(): Promise<PrepaidAccount[]> {
    const [accountResult, usageResult] = await Promise.all([
      supabase.from('prepaid_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('prepaid_usages').select('account_id,used_at').order('used_at', { ascending: false }),
    ]);
    if (accountResult.error) throw accountResult.error;
    if (usageResult.error) throw usageResult.error;
    const lastUsedByAccount = new Map<string, string>();
    for (const usage of usageResult.data ?? []) {
      if (!lastUsedByAccount.has(usage.account_id)) {
        lastUsedByAccount.set(usage.account_id, usage.used_at);
      }
    }
    return (accountResult.data ?? []).map((row) =>
      mapAccount(row, lastUsedByAccount.get(row.id)),
    );
  },

  async create(input: {
    companyName: string;
    contactPerson: string;
    phone?: string;
    amount: number;
    memo?: string;
    employeeId: string;
    employeeName: string;
  }): Promise<PrepaidAccount> {
    const { data, error } = await supabase
      .from('prepaid_accounts')
      .insert({
        company_name: input.companyName,
        contact_person: input.contactPerson,
        phone: input.phone?.replace(/\D/g, '') || null,
        initial_amount: input.amount,
        balance: input.amount,
        memo: input.memo?.trim() || null,
        created_by: input.employeeId,
        created_by_name: input.employeeName,
      })
      .select()
      .single();
    if (error) throw error;
    return mapAccount(data);
  },

  async registerUsage(accountId: string, amount: number, memo?: string): Promise<PrepaidUsage> {
    const { data, error } = await supabase.rpc('register_prepaid_usage', {
      p_account_id: accountId,
      p_amount: amount,
      p_memo: memo?.trim() || null,
    });
    if (error) throw error;
    return mapUsage(data);
  },

  async update(accountId: string, initialAmount: number, memo?: string): Promise<PrepaidAccount> {
    const { data, error } = await supabase.rpc('update_prepaid_account', {
      p_account_id: accountId,
      p_initial_amount: initialAmount,
      p_memo: memo?.trim() || null,
    });
    if (error) throw error;
    return mapAccount(data);
  },

  async delete(accountId: string): Promise<void> {
    const { error } = await supabase.from('prepaid_accounts').delete().eq('id', accountId);
    if (error) throw error;
  },

  async findUsages(accountId: string): Promise<PrepaidUsage[]> {
    const { data, error } = await supabase
      .from('prepaid_usages')
      .select('*')
      .eq('account_id', accountId)
      .order('used_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapUsage);
  },
};
