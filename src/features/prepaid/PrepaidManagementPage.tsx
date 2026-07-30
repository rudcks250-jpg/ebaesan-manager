import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Pencil, Plus, Search, UserRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { prepaidService } from '@/services/prepaidService';
import { formatDateTimeKo, formatMonthDay, todayStr } from '@/utils/date';
import type { PrepaidCustomer, PrepaidTransaction, PrepaidTransactionType } from '@/data/types';

function currency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function amountValue(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return fallback;
}

export function PrepaidManagementPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<PrepaidCustomer[]>([]);
  const [selected, setSelected] = useState<PrepaidCustomer>();
  const [transactions, setTransactions] = useState<PrepaidTransaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<PrepaidTransaction>();
  const [query, setQuery] = useState('');
  const [customerModal, setCustomerModal] = useState<'create' | 'edit'>();
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [customerView, setCustomerView] = useState(false);
  const [legacyOpen, setLegacyOpen] = useState(false);
  const [duplicateCustomers, setDuplicateCustomers] = useState<PrepaidCustomer[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<'customer' | 'transaction'>();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [memo, setMemo] = useState('');
  const [transactionType, setTransactionType] = useState<PrepaidTransactionType>('deposit');
  const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>('increase');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayStr());

  const load = useCallback(async () => {
    try {
      const next = await prepaidService.listCustomers();
      setCustomers(next);
      setSelected((current) => current ? next.find((item) => item.id === current.id) : undefined);
    } catch {
      showToast('선결제 고객을 불러오지 못했습니다.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase().replace(/-/g, '');
    if (!keyword) return customers;
    return customers.filter((customer) =>
      customer.name.toLowerCase().includes(keyword)
      || customer.companyName?.toLowerCase().includes(keyword)
      || customer.contactPerson?.toLowerCase().includes(keyword)
      || customer.phone.replace(/-/g, '').includes(keyword),
    );
  }, [customers, query]);

  const loadTransactions = async (customerId: string) => {
    setTransactions(await prepaidService.listTransactions(customerId));
  };

  const openDetail = async (customer: PrepaidCustomer) => {
    setSelected(customer);
    try {
      await loadTransactions(customer.id);
    } catch {
      showToast('거래내역을 불러오지 못했습니다.', 'error');
    }
  };

  const resetCustomerForm = () => {
    setName('');
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setMemo('');
  };

  const openCreateCustomer = () => {
    resetCustomerForm();
    setCustomerModal('create');
  };

  const openEditCustomer = () => {
    if (!selected) return;
    setName(selected.name);
    setCompanyName(selected.companyName ?? '');
    setContactPerson(selected.contactPerson ?? '');
    setPhone(selected.phone);
    setMemo(selected.memo ?? '');
    setCustomerModal('edit');
  };

  const saveCustomer = async (allowDuplicate = false) => {
    if (!session || !name.trim() || !phone.replace(/\D/g, '') || saving) return;
    if (customerModal === 'create' && !allowDuplicate) {
      const normalizedPhone = phone.replace(/\D/g, '');
      const duplicates = customers.filter((customer) =>
        customer.name.trim() === name.trim()
        || customer.phone.replace(/\D/g, '') === normalizedPhone
        || (!!companyName.trim() && customer.companyName?.trim() === companyName.trim()),
      );
      if (duplicates.length > 0) {
        setDuplicateCustomers(duplicates);
        return;
      }
    }
    setSaving(true);
    try {
      const input = { name, companyName, contactPerson, phone, memo };
      if (customerModal === 'edit' && selected) {
        await prepaidService.updateCustomer(selected.id, input);
        showToast('고객 정보를 수정했습니다.');
      } else {
        const created = await prepaidService.createCustomer({
          ...input,
          employeeId: session.employeeId,
          employeeName: session.name,
        });
        setSelected(created);
        setTransactions([]);
        showToast('신규 고객을 등록했습니다.');
      }
      setCustomerModal(undefined);
      await load();
    } catch (error) {
      showToast(errorMessage(error, '고객 저장에 실패했습니다.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const openNewTransaction = () => {
    setEditingTransaction(undefined);
    setTransactionType('deposit');
    setAdjustmentDirection('increase');
    setAmount('');
    setTransactionDate(todayStr());
    setMemo('');
    setTransactionOpen(true);
  };

  const openEditTransaction = (transaction: PrepaidTransaction) => {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setAdjustmentDirection(transaction.adjustmentDirection ?? 'increase');
    setAmount(String(transaction.amount));
    setTransactionDate(transaction.transactionDate);
    setMemo(transaction.memo ?? '');
    setTransactionOpen(true);
  };

  const saveTransaction = async () => {
    if (!selected || amountValue(amount) <= 0 || !transactionDate || saving) return;
    setSaving(true);
    try {
      await prepaidService.saveTransaction({
        customerId: selected.id,
        type: transactionType,
        amount: amountValue(amount),
        transactionDate,
        memo,
        transactionId: editingTransaction?.id,
        adjustmentDirection: transactionType === 'adjustment' ? adjustmentDirection : undefined,
      });
      setTransactionOpen(false);
      await Promise.all([load(), loadTransactions(selected.id)]);
      showToast(editingTransaction ? '거래내역을 수정했습니다.' : '거래내역을 추가했습니다.');
    } catch (error) {
      showToast(errorMessage(error, '거래 저장에 실패했습니다.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !deleteTarget) return;
    try {
      if (deleteTarget === 'transaction' && editingTransaction) {
        await prepaidService.deleteTransaction(editingTransaction.id);
        await Promise.all([load(), loadTransactions(selected.id)]);
        setTransactionOpen(false);
        showToast('거래내역을 삭제했습니다.');
      } else {
        await prepaidService.deleteCustomer(selected.id);
        setSelected(undefined);
        setTransactions([]);
        await load();
        showToast('고객을 삭제했습니다.');
      }
      setDeleteTarget(undefined);
      setEditingTransaction(undefined);
    } catch (error) {
      showToast(errorMessage(error, '삭제에 실패했습니다.'), 'error');
    }
  };

  return (
    <Layout title="선결제 관리">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-h-12 flex-1 items-center gap-2 rounded-2xl bg-white px-4 ring-1 ring-black/[0.06] sm:max-w-md">
            <Search size={18} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름, 회사명, 담당자, 전화번호 검색"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <Button onClick={openCreateCustomer}>
            <span className="flex items-center gap-1.5"><Plus size={17} /> 신규 고객</span>
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon="💳" title={query ? '검색 결과가 없습니다' : '등록된 고객이 없습니다'} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((customer) => (
              <button key={customer.id} onClick={() => void openDetail(customer)} className="text-left">
                <Card hover className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-ink">{customer.name}</p>
                      {customer.companyName && <p className="mt-0.5 truncate text-sm text-ink-soft">{customer.companyName}</p>}
                      {customer.contactPerson && <p className="mt-0.5 truncate text-xs text-ink-soft">담당자 {customer.contactPerson}</p>}
                      <p className="mt-1 text-xs text-ink-faint">{customer.phone}</p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-light text-brand-red">
                      <UserRound size={19} />
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-ink-faint">현재 잔액</p>
                      <p className={`mt-1 text-3xl font-bold tracking-[-0.03em] ${customer.balance > 0 ? 'text-emerald-600' : 'text-ink-faint'}`}>{currency(customer.balance)}</p>
                  </div>
                  <div className="mt-5">
                    <p className="text-[11px] text-ink-faint">최근 거래</p>
                    <p className="text-sm font-semibold text-ink-soft">
                      {customer.lastTransactionAt ? formatMonthDay(customer.lastTransactionAt) : '거래내역 없음'}
                    </p>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!customerModal && duplicateCustomers.length === 0}
        onClose={() => setCustomerModal(undefined)}
        title={customerModal === 'edit' ? '고객 정보 수정' : '신규 고객'}
        footer={<Button fullWidth onClick={() => void saveCustomer()} disabled={saving || !name.trim() || !phone.replace(/\D/g, '')}>{saving ? '저장 중...' : '저장'}</Button>}
      >
        <div className="pb-5">
          <Input label="이름" value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="회사명 (선택)" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          <Input label="담당자 (선택)" value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} />
          <Input label="전화번호" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      {selected && !customerModal && !transactionOpen && !customerView && (
        <Modal
          open
          onClose={() => setSelected(undefined)}
          title={selected.name}
          footer={<Button fullWidth onClick={openNewTransaction}><span className="flex items-center justify-center gap-1.5"><Plus size={17} /> 거래내역 추가</span></Button>}
        >
          <div className="space-y-5 pb-5">
            <div className="rounded-[22px] bg-gradient-to-br from-brand-red to-[#52A8FF] p-5 text-white">
              <p className="text-xs font-semibold text-white/70">현재 잔액</p>
              <p className="mt-1 text-4xl font-bold tracking-[-0.04em]">{currency(selected.balance)}</p>
            </div>
            <div className="rounded-2xl bg-brand-beige-light p-4 text-sm">
              {selected.companyName && <p className="font-bold text-ink">{selected.companyName}</p>}
              {selected.contactPerson && <p className="mt-1 text-ink-soft">담당자 {selected.contactPerson}</p>}
              <p className="mt-1 text-ink-soft">{selected.phone}</p>
              {selected.memo && <p className="mt-2 text-ink-soft">{selected.memo}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={openEditCustomer}><span className="flex items-center gap-1"><Pencil size={14} /> 고객 수정</span></Button>
              <Button size="sm" variant="secondary" onClick={() => setCustomerView(true)}>손님에게 잔액 보여주기</Button>
              {selected.legacyNote && <Button size="sm" variant="ghost" onClick={() => setLegacyOpen(true)}>기존 메모 보기</Button>}
            </div>
            <section>
              <p className="mb-3 font-bold text-ink">거래내역</p>
              {transactions.length === 0 ? (
                <p className="text-sm text-ink-faint">아직 거래내역이 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => {
                    const isDeposit = transaction.effectAmount > 0;
                    const typeLabel = transaction.type === 'deposit'
                      ? '선결제'
                      : transaction.type === 'usage'
                        ? '사용'
                        : `잔액 조정 (${isDeposit ? '증가' : '차감'})`;
                    return (
                      <button key={transaction.id} onClick={() => openEditTransaction(transaction)} className="w-full rounded-2xl border border-black/[0.05] bg-white p-4 text-left press-scale">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-2.5">
                            {isDeposit
                              ? <ArrowUpCircle size={21} className="mt-0.5 text-emerald-600" />
                              : <ArrowDownCircle size={21} className="mt-0.5 text-red-500" />}
                            <div>
                              <p className={`text-lg font-bold ${isDeposit ? 'text-emerald-600' : 'text-red-500'}`}>
                                {isDeposit ? '+' : '-'}{currency(transaction.amount)}
                              </p>
                              <p className="text-sm font-semibold text-ink">{typeLabel}</p>
                              {transaction.needsReview && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">검토 필요</span>}
                            </div>
                          </div>
                          <p className="text-xs text-ink-faint">{formatMonthDay(transaction.transactionDate)}</p>
                        </div>
                        <div className="mt-3 flex items-end justify-between border-t border-black/[0.05] pt-3">
                          <div>
                            {transaction.memo && <p className="text-sm text-ink-soft">{transaction.memo}</p>}
                            <p className="mt-1 text-[11px] text-ink-faint">{transaction.createdByName} · {formatDateTimeKo(transaction.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-ink-faint">당시 잔액</p>
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
        onClose={() => { setTransactionOpen(false); setEditingTransaction(undefined); }}
        title={editingTransaction ? '거래내역 수정' : '거래내역 추가'}
        footer={
          <div className="flex gap-2">
            {editingTransaction && <Button variant="danger" onClick={() => setDeleteTarget('transaction')}>삭제</Button>}
            <Button fullWidth onClick={() => void saveTransaction()} disabled={saving || amountValue(amount) <= 0 || !transactionDate}>{saving ? '저장 중...' : '등록'}</Button>
          </div>
        }
      >
        <div className="pb-5">
          <p className="mb-2 text-[13px] font-semibold text-ink-soft">거래 종류</p>
          <div className="mb-5 grid grid-cols-2 gap-2">
            <button onClick={() => setTransactionType('deposit')} className={`min-h-12 rounded-2xl font-bold ${transactionType === 'deposit' ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500' : 'bg-brand-beige-light text-ink-soft'}`}>○ 선결제 (+)</button>
            <button onClick={() => setTransactionType('usage')} className={`min-h-12 rounded-2xl font-bold ${transactionType === 'usage' ? 'bg-red-50 text-red-600 ring-2 ring-red-400' : 'bg-brand-beige-light text-ink-soft'}`}>○ 사용 (-)</button>
            <button onClick={() => setTransactionType('adjustment')} className={`col-span-2 min-h-12 rounded-2xl font-bold ${transactionType === 'adjustment' ? 'bg-amber-50 text-amber-700 ring-2 ring-amber-400' : 'bg-brand-beige-light text-ink-soft'}`}>○ 잔액 조정</button>
          </div>
          {transactionType === 'adjustment' && (
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button onClick={() => setAdjustmentDirection('increase')} className={`min-h-11 rounded-xl text-sm font-bold ${adjustmentDirection === 'increase' ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400' : 'bg-brand-beige-light text-ink-soft'}`}>잔액 증가</button>
              <button onClick={() => setAdjustmentDirection('decrease')} className={`min-h-11 rounded-xl text-sm font-bold ${adjustmentDirection === 'decrease' ? 'bg-red-50 text-red-600 ring-2 ring-red-400' : 'bg-brand-beige-light text-ink-soft'}`}>잔액 차감</button>
            </div>
          )}
          <Input label="금액" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          {amountValue(amount) > 0 && <p className="-mt-2 mb-4 text-sm font-bold text-brand-red">{currency(amountValue(amount))}</p>}
          <Input label="등록일 / 사용일" type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      {selected && customerView && (
        <Modal open onClose={() => setCustomerView(false)} title="고객 잔액 확인">
          <div className="space-y-5 pb-5">
            <div className="rounded-[24px] bg-ink p-6 text-white">
              <p className="text-lg font-bold">이배산 숯불구이</p>
              <p className="mt-5 text-2xl font-bold">{selected.name} 고객님</p>
              <p className="mt-5 text-sm text-white/60">현재 선결제 잔액</p>
              <p className="mt-1 text-4xl font-bold">{currency(selected.balance)}</p>
            </div>
            <div className="space-y-2">
              {transactions.slice(0, 10).map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-2xl bg-brand-beige-light p-4">
                  <div>
                    <p className="text-sm font-semibold text-ink">{formatMonthDay(transaction.transactionDate)}</p>
                    <p className="text-xs text-ink-soft">{transaction.type === 'deposit' ? '선결제' : transaction.type === 'usage' ? '사용' : '잔액 조정'}</p>
                  </div>
                  <p className={`text-lg font-bold ${transaction.effectAmount > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {transaction.effectAmount > 0 ? '+' : '-'}{currency(Math.abs(transaction.effectAmount))}
                  </p>
                </div>
              ))}
            </div>
            <Button fullWidth variant="secondary" onClick={() => {
              const latest = transactions[0];
              const latestText = latest
                ? `${formatMonthDay(latest.transactionDate)}\n${currency(latest.amount)} ${latest.type === 'deposit' ? '선결제' : latest.type === 'usage' ? '사용' : '잔액 조정'}`
                : '거래내역 없음';
              void navigator.clipboard.writeText(`이배산 숯불구이\n\n${selected.name} 고객님\n\n현재 선결제 잔액\n${currency(selected.balance)}\n\n최근 거래\n${latestText}`);
              showToast('잔액 안내가 복사되었습니다.');
            }}>잔액 안내 복사</Button>
          </div>
        </Modal>
      )}

      <Modal open={legacyOpen} onClose={() => setLegacyOpen(false)} title="기존 메모 원문">
        <pre className="mb-5 whitespace-pre-wrap rounded-2xl bg-brand-beige-light p-4 text-sm leading-6 text-ink">{selected?.legacyNote}</pre>
      </Modal>

      <Modal open={duplicateCustomers.length > 0} onClose={() => setDuplicateCustomers([])} title="기존 고객이 있습니다">
        <div className="space-y-3 pb-5">
          {duplicateCustomers.map((customer) => (
            <button key={customer.id} onClick={() => {
              setDuplicateCustomers([]);
              setCustomerModal(undefined);
              void openDetail(customer);
            }} className="w-full rounded-2xl bg-brand-beige-light p-4 text-left">
              <p className="font-bold text-ink">{customer.name}</p>
              <p className="mt-1 text-sm text-ink-soft">{customer.companyName || '회사명 없음'} · {customer.phone}</p>
              <p className="mt-2 text-sm font-bold text-emerald-600">기존 고객 보기</p>
            </button>
          ))}
          <Button fullWidth variant="secondary" onClick={() => {
            setDuplicateCustomers([]);
            void saveCustomer(true);
          }}>그래도 등록</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget === 'customer' ? '고객을 삭제하시겠습니까?' : '거래내역을 삭제하시겠습니까?'}
        description={deleteTarget === 'customer' ? '고객과 모든 거래내역이 함께 삭제되며 복구할 수 없습니다.' : '삭제 후 잔액이 자동으로 다시 계산됩니다.'}
        confirmLabel="삭제"
        danger
        onConfirm={() => void remove()}
        onClose={() => setDeleteTarget(undefined)}
      />
    </Layout>
  );
}
