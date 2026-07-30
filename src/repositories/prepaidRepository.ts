import { supabase } from '@/lib/supabaseClient';
import type { PrepaidAdjustmentDirection, PrepaidCustomer, PrepaidTransaction, PrepaidTransactionType } from '@/data/types';

type Row = Record<string, unknown>;

function signedAmount(row: Row): number {
  return Number(row.effect_amount);
}

function mapTransaction(row: Row, balanceAfter = 0): PrepaidTransaction {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    type: row.transaction_type as PrepaidTransactionType,
    amount: Number(row.amount),
    effectAmount: Number(row.effect_amount),
    adjustmentDirection: row.transaction_type === 'adjustment'
      ? (Number(row.effect_amount) >= 0 ? 'increase' : 'decrease')
      : undefined,
    transactionDate: String(row.transaction_date),
    memo: row.memo ? String(row.memo) : undefined,
    createdBy: String(row.created_by),
    createdByName: String(row.created_by_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    balanceAfter,
    needsReview: Boolean(row.needs_review),
  };
}

function mapCustomer(row: Row, transactions: Row[]): PrepaidCustomer {
  const balance = transactions.reduce((sum, transaction) => sum + signedAmount(transaction), 0);
  const latest = [...transactions].sort((a, b) => {
    const date = String(b.transaction_date).localeCompare(String(a.transaction_date));
    return date || String(b.created_at).localeCompare(String(a.created_at));
  })[0];
  const latestUsage = [...transactions]
    .filter((transaction) => transaction.transaction_type === 'usage')
    .sort((a, b) => {
      const date = String(b.transaction_date).localeCompare(String(a.transaction_date));
      return date || String(b.created_at).localeCompare(String(a.created_at));
    })[0];
  return {
    id: String(row.id),
    name: String(row.name),
    companyName: row.company_name ? String(row.company_name) : undefined,
    contactPerson: row.contact_person ? String(row.contact_person) : undefined,
    phone: String(row.phone ?? ''),
    memo: row.memo ? String(row.memo) : undefined,
    legacyNote: row.legacy_note ? String(row.legacy_note) : undefined,
    needsReview: Boolean(row.needs_review),
    balance,
    lastTransactionAt: latest ? String(latest.transaction_date) : undefined,
    lastUsedAt: latestUsage ? String(latestUsage.transaction_date) : undefined,
    createdBy: String(row.created_by),
    createdByName: String(row.created_by_name),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const prepaidRepository = {
  async findCustomers(): Promise<PrepaidCustomer[]> {
    const [customerResult, transactionResult] = await Promise.all([
      supabase.from('prepaid_customers').select('*').order('created_at', { ascending: false }),
      supabase.from('prepaid_transactions').select('*'),
    ]);
    if (customerResult.error) throw customerResult.error;
    if (transactionResult.error) throw transactionResult.error;
    const rows = (transactionResult.data ?? []) as Row[];
    return ((customerResult.data ?? []) as Row[]).map((customer) =>
      mapCustomer(customer, rows.filter((transaction) => transaction.customer_id === customer.id)),
    );
  },

  async createCustomer(input: {
    name: string;
    companyName?: string;
    contactPerson?: string;
    phone: string;
    memo?: string;
    employeeId: string;
    employeeName: string;
  }): Promise<PrepaidCustomer> {
    const { data, error } = await supabase.from('prepaid_customers').insert({
      name: input.name.trim(),
      company_name: input.companyName?.trim() || null,
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone.replace(/\D/g, ''),
      memo: input.memo?.trim() || null,
      created_by: input.employeeId,
      created_by_name: input.employeeName,
    }).select().single();
    if (error) throw error;
    return mapCustomer(data, []);
  },

  async createOrAddDeposit(input: {
    name: string;
    phone?: string;
    amount: number;
    transactionDate: string;
    memo?: string;
  }): Promise<string> {
    const { data, error } = await supabase.rpc('create_or_add_prepaid_deposit', {
      p_name: input.name.trim(),
      p_phone: input.phone?.replace(/\D/g, '') ?? '',
      p_amount: input.amount,
      p_transaction_date: input.transactionDate,
      p_memo: input.memo?.trim() || null,
    });
    if (error) throw error;
    return String(data);
  },

  async updateCustomer(customerId: string, input: {
    name: string;
    companyName?: string;
    contactPerson?: string;
    phone: string;
    memo?: string;
  }): Promise<void> {
    const { error } = await supabase.from('prepaid_customers').update({
      name: input.name.trim(),
      company_name: input.companyName?.trim() || null,
      contact_person: input.contactPerson?.trim() || null,
      phone: input.phone.replace(/\D/g, ''),
      memo: input.memo?.trim() || null,
    }).eq('id', customerId);
    if (error) throw error;
  },

  async deleteCustomer(customerId: string): Promise<void> {
    const { error } = await supabase.from('prepaid_customers').delete().eq('id', customerId);
    if (error) throw error;
  },

  async findTransactions(customerId: string): Promise<PrepaidTransaction[]> {
    const { data, error } = await supabase
      .from('prepaid_transactions')
      .select('*')
      .eq('customer_id', customerId)
      .order('transaction_date', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    let balance = 0;
    return ((data ?? []) as Row[])
      .map((row) => {
        balance += signedAmount(row);
        return mapTransaction(row, balance);
      })
      .reverse();
  },

  async saveTransaction(input: {
    customerId: string;
    type: PrepaidTransactionType;
    amount: number;
    transactionDate: string;
    memo?: string;
    transactionId?: string;
    adjustmentDirection?: PrepaidAdjustmentDirection;
  }): Promise<void> {
    const { error } = await supabase.rpc('save_prepaid_transaction', {
      p_customer_id: input.customerId,
      p_transaction_type: input.type,
      p_amount: input.amount,
      p_transaction_date: input.transactionDate,
      p_memo: input.memo?.trim() || null,
      p_transaction_id: input.transactionId ?? null,
      p_adjustment_direction: input.adjustmentDirection ?? null,
    });
    if (error) throw error;
  },

  async deleteTransaction(transactionId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_prepaid_transaction', {
      p_transaction_id: transactionId,
    });
    if (error) throw error;
  },
};
