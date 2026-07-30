import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Plus, Search, UserRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/components/common/Toast';
import { prepaidService } from '@/services/prepaidService';
import { formatMonthDay, todayStr } from '@/utils/date';
import type { PrepaidCustomer, PrepaidTransaction, PrepaidTransactionType } from '@/data/types';

function currency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function numberValue(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

function phone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || '전화번호 없음';
}

function message(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return fallback;
}

export function PrepaidManagementPage() {
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<PrepaidCustomer[]>([]);
  const [selected, setSelected] = useState<PrepaidCustomer>();
  const [transactions, setTransactions] = useState<PrepaidTransaction[]>([]);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [customerView, setCustomerView] = useState(false);
  const [editing, setEditing] = useState<PrepaidTransaction>();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [memo, setMemo] = useState('');
  const [transactionType, setTransactionType] = useState<PrepaidTransactionType>('usage');

  const loadCustomers = useCallback(async () => {
    try {
      const next = await prepaidService.listCustomers();
      setCustomers(next);
      setSelected((current) => current ? next.find((item) => item.id === current.id) : undefined);
      return next;
    } catch {
      showToast('고객 목록을 불러오지 못했습니다.', 'error');
      return [];
    }
  }, [showToast]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase().replace(/\D/g, '');
    if (!query.trim()) return customers;
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(query.trim().toLowerCase())
      || customer.phone.replace(/\D/g, '').includes(keyword),
    );
  }, [customers, query]);

  const loadTransactions = async (customerId: string) => {
    setTransactions(await prepaidService.listTransactions(customerId));
  };

  const openCustomer = async (customer: PrepaidCustomer) => {
    setSelected(customer);
    try {
      await loadTransactions(customer.id);
    } catch {
      showToast('거래내역을 불러오지 못했습니다.', 'error');
    }
  };

  const openCreate = () => {
    setCustomerName('');
    setCustomerPhone('');
    setAmount('');
    setDate(todayStr());
    setMemo('');
    setCreateOpen(true);
  };

  const createPrepayment = async () => {
    if (!customerName.trim() || numberValue(amount) <= 0 || saving) return;
    setSaving(true);
    try {
      const customerId = await prepaidService.createOrAddDeposit({
        name: customerName,
        phone: customerPhone,
        amount: numberValue(amount),
        transactionDate: date,
        memo,
      });
      const next = await loadCustomers();
      const customer = next.find((item) => item.id === customerId);
      if (customer) {
        setSelected(customer);
        await loadTransactions(customer.id);
      }
      setCreateOpen(false);
      showToast('선결제를 등록했습니다.');
    } catch (error) {
      showToast(message(error, '선결제 등록에 실패했습니다.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNewTransaction = (type: 'deposit' | 'usage') => {
    setEditing(undefined);
    setTransactionType(type);
    setAmount('');
    setDate(todayStr());
    setMemo('');
    setTransactionOpen(true);
  };

  const openEdit = (transaction: PrepaidTransaction) => {
    setEditing(transaction);
    setTransactionType(transaction.type === 'usage' ? 'usage' : 'deposit');
    setAmount(String(transaction.amount));
    setDate(transaction.transactionDate);
    setMemo(transaction.memo ?? '');
    setTransactionOpen(true);
  };

  const saveTransaction = async () => {
    if (!selected || numberValue(amount) <= 0 || !date || saving) return;
    setSaving(true);
    try {
      await prepaidService.saveTransaction({
        customerId: selected.id,
        type: transactionType,
        amount: numberValue(amount),
        transactionDate: date,
        memo,
        transactionId: editing?.id,
      });
      await Promise.all([loadCustomers(), loadTransactions(selected.id)]);
      setTransactionOpen(false);
      setEditing(undefined);
      showToast(editing ? '거래내역을 수정했습니다.' : transactionType === 'usage' ? '사용 금액을 등록했습니다.' : '추가 선결제를 등록했습니다.');
    } catch (error) {
      showToast(message(error, '거래 저장에 실패했습니다.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteTransaction = async () => {
    if (!selected || !editing) return;
    try {
      await prepaidService.deleteTransaction(editing.id);
      await Promise.all([loadCustomers(), loadTransactions(selected.id)]);
      setDeleteOpen(false);
      setTransactionOpen(false);
      setEditing(undefined);
      showToast('거래내역을 삭제했습니다.');
    } catch (error) {
      showToast(message(error, '거래 삭제에 실패했습니다.'), 'error');
    }
  };

  return (
    <Layout title="선결제 관리">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-h-14 flex-1 items-center gap-3 rounded-2xl bg-white px-5 shadow-sm ring-1 ring-black/[0.06]">
            <Search size={20} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="고객 이름 또는 전화번호 검색"
              className="w-full bg-transparent text-base font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
            />
          </label>
          <Button size="lg" onClick={openCreate}><span className="flex items-center gap-1.5"><Plus size={18} /> 신규 선결제</span></Button>
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon="💳" title={query ? '검색 결과가 없습니다' : '등록된 선결제가 없습니다'} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((customer) => (
              <button key={customer.id} onClick={() => void openCustomer(customer)} className="text-left">
                <Card hover className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-bold text-ink">{customer.name}</p>
                      <p className="mt-1 text-sm text-ink-soft">{phone(customer.phone)}</p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red-light text-brand-red"><UserRound size={19} /></span>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-ink-faint">현재 잔액</p>
                    <p className={`mt-1 text-3xl font-bold tracking-[-0.04em] ${customer.balance > 0 ? 'text-emerald-600' : 'text-ink-faint'}`}>{currency(customer.balance)}</p>
                  </div>
                  <div className="mt-5">
                    <p className="text-[11px] text-ink-faint">최근 사용</p>
                    <p className="text-sm font-semibold text-ink-soft">{customer.lastUsedAt ? formatMonthDay(customer.lastUsedAt) : '사용 내역 없음'}</p>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="신규 선결제"
        footer={<Button fullWidth onClick={() => void createPrepayment()} disabled={saving || !customerName.trim() || numberValue(amount) <= 0}>{saving ? '저장 중...' : '저장'}</Button>}
      >
        <div className="pb-5">
          <Input label="고객 이름 (필수)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <Input label="전화번호" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          <Input label="선결제 금액 (필수)" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          {numberValue(amount) > 0 && <p className="-mt-2 mb-4 text-sm font-bold text-emerald-600">{currency(numberValue(amount))}</p>}
          <Input label="선결제 날짜" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      {selected && !transactionOpen && !customerView && (
        <Modal open onClose={() => setSelected(undefined)} title={selected.name}>
          <div className="space-y-5 pb-5">
            <div className="rounded-[24px] bg-gradient-to-br from-brand-red to-[#52A8FF] p-6 text-white">
              <p className="text-lg font-bold">{selected.name}</p>
              <p className="mt-1 text-sm text-white/70">{phone(selected.phone)}</p>
              <p className="mt-6 text-sm font-semibold text-white/70">현재 잔액</p>
              <p className="mt-1 text-4xl font-bold tracking-[-0.05em]">{currency(selected.balance)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button fullWidth onClick={() => openNewTransaction('usage')} disabled={selected.balance <= 0}>사용하기</Button>
              <Button fullWidth variant="secondary" onClick={() => openNewTransaction('deposit')}>추가 선결제</Button>
            </div>
            <Button fullWidth variant="ghost" onClick={() => setCustomerView(true)}>손님에게 보여주기</Button>

            <section>
              <p className="mb-3 font-bold text-ink">거래내역</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-ink-faint">거래내역이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const deposit = transaction.effectAmount > 0;
                    return (
                      <button key={transaction.id} onClick={() => openEdit(transaction)} className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/[0.05] press-scale">
                        <div className="flex items-start justify-between">
                          <div className="flex gap-2.5">
                            {deposit ? <ArrowUpCircle className="text-emerald-600" size={21} /> : <ArrowDownCircle className="text-red-500" size={21} />}
                            <div>
                              <p className={`text-lg font-bold ${deposit ? 'text-emerald-600' : 'text-red-500'}`}>{deposit ? '+' : '-'}{currency(transaction.amount)}</p>
                              <p className="text-sm font-semibold text-ink">{deposit ? (transactions.at(-1)?.id === transaction.id ? '선결제' : '추가 선결제') : '사용'}</p>
                            </div>
                          </div>
                          <p className="text-xs text-ink-faint">{formatMonthDay(transaction.transactionDate)}</p>
                        </div>
                        <div className="mt-3 flex items-end justify-between border-t border-black/[0.05] pt-3">
                          <div>
                            {transaction.memo && <p className="text-sm text-ink-soft">{transaction.memo}</p>}
                            <p className="mt-1 text-[11px] text-ink-faint">처리 {transaction.createdByName}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-ink-faint">잔액</p>
                            <p className="font-bold text-ink">{currency(transaction.balanceAfter)}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </Modal>
      )}

      <Modal
        open={transactionOpen}
        onClose={() => { setTransactionOpen(false); setEditing(undefined); }}
        title={editing ? '거래 수정' : transactionType === 'usage' ? '사용하기' : '추가 선결제'}
        footer={
          <div className="flex gap-2">
            {editing && <Button variant="danger" onClick={() => setDeleteOpen(true)}>삭제</Button>}
            <Button fullWidth onClick={() => void saveTransaction()} disabled={saving || numberValue(amount) <= 0 || !date}>{saving ? '저장 중...' : '저장'}</Button>
          </div>
        }
      >
        <div className="pb-5">
          {editing && (
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button onClick={() => setTransactionType('deposit')} className={`min-h-11 rounded-xl text-sm font-bold ${transactionType === 'deposit' ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400' : 'bg-brand-beige-light text-ink-soft'}`}>선결제 (+)</button>
              <button onClick={() => setTransactionType('usage')} className={`min-h-11 rounded-xl text-sm font-bold ${transactionType === 'usage' ? 'bg-red-50 text-red-600 ring-2 ring-red-400' : 'bg-brand-beige-light text-ink-soft'}`}>사용 (-)</button>
            </div>
          )}
          <Input label={transactionType === 'usage' ? '사용 금액' : '선결제 금액'} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          {numberValue(amount) > 0 && <p className={`-mt-2 mb-4 text-sm font-bold ${transactionType === 'usage' ? 'text-red-500' : 'text-emerald-600'}`}>{currency(numberValue(amount))}</p>}
          <Input label={transactionType === 'usage' ? '사용 날짜' : '선결제 날짜'} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      {selected && customerView && (
        <Modal open onClose={() => setCustomerView(false)} title="선결제 잔액">
          <div className="space-y-5 pb-5">
            <div className="rounded-[26px] bg-ink p-7 text-center text-white">
              <p className="text-2xl font-bold">{selected.name} 고객님</p>
              <p className="mt-7 text-base text-white/60">현재 남은 선결제</p>
              <p className="mt-2 text-5xl font-bold tracking-[-0.05em]">{currency(selected.balance)}</p>
            </div>
            <div>
              <p className="mb-3 text-lg font-bold text-ink">최근 거래내역</p>
              <div className="space-y-2">
                {transactions.slice(0, 5).map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between rounded-2xl bg-brand-beige-light p-4">
                    <div>
                      <p className="font-semibold text-ink">{formatMonthDay(transaction.transactionDate)}</p>
                      <p className="text-sm text-ink-soft">{transaction.effectAmount > 0 ? '선결제' : '사용'}</p>
                    </div>
                    <p className={`text-xl font-bold ${transaction.effectAmount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{transaction.effectAmount > 0 ? '+' : '-'}{currency(transaction.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="거래내역을 삭제하시겠습니까?"
        description="거래는 감사로그에 보존되며 잔액이 자동으로 다시 계산됩니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => void deleteTransaction()}
        onClose={() => setDeleteOpen(false)}
      />
    </Layout>
  );
}
