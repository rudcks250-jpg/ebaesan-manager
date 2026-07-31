import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownCircle, ArrowRight, ArrowUpCircle, ChevronDown, Plus, Search, UserRound } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { prepaidService } from '@/services/prepaidService';
import { formatMonthDay, todayStr } from '@/utils/date';
import { canManagePrepayments } from '@/utils/permission';
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

const NEW_PREPAYMENT_STEPS: { text: string; sub?: string[] }[] = [
  { text: '고객님의 카드를 받아 선결제를 결제합니다.' },
  { text: '매장 선결제 명함에 아래 내용을 작성합니다.', sub: ['고객 성함', '결제 금액', '날짜'] },
  { text: '명함을 사진으로 촬영합니다.' },
  { text: '사진 촬영 후 전산(선결제 관리)에 신규 선결제를 등록합니다.' },
  { text: '마지막으로 고객님께 명함을 전달합니다.' },
];

const USAGE_CASES = [
  {
    title: '결제 금액이 선결제 금액보다 큰 경우',
    balance: 50000,
    payment: 70000,
    points: ['차액 20,000원만 추가 결제합니다.', '기존 선결제 명함은 폐기합니다.', '전산 잔액은 0원으로 처리합니다.'],
  },
  {
    title: '선결제 금액이 더 많이 남는 경우',
    balance: 100000,
    payment: 40000,
    points: ['기존 명함은 폐기합니다.', '남은 금액 60,000원을 새로운 명함에 작성하여 고객님께 전달합니다.', '전산에도 남은 금액으로 수정합니다.'],
  },
];

const ORDER_STEPS = ['결제', '명함 작성', '명함 사진 촬영', '전산 입력', '고객에게 명함 전달'];

const COMMON_MISTAKES = [
  '명함 작성 전에 고객에게 먼저 전달하는 경우',
  '사진을 찍지 않고 전달하는 경우',
  '전산 입력을 하지 않는 경우',
  '기존 명함을 폐기하지 않는 경우',
  '남은 금액을 새 명함에 작성하지 않는 경우',
];

function UsageManualCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card className="bg-gradient-to-br from-white to-brand-red-light/60 border-brand-red/10">
      <button onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-3 text-lg font-bold text-ink sm:text-xl">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-black/[0.05]">📖</span>
          선결제 사용 방법
        </span>
        <ChevronDown size={24} className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-6 space-y-7">
          <section>
            <p className="mb-3 text-base font-bold text-brand-red sm:text-lg">📌 신규 선결제</p>
            <ol className="space-y-3">
              {NEW_PREPAYMENT_STEPS.map((step, index) => (
                <li key={step.text} className="flex gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-red text-sm font-bold text-white">{index + 1}</span>
                  <div>
                    <p className="text-base font-semibold leading-relaxed text-ink sm:text-lg">{step.text}</p>
                    {step.sub && (
                      <ul className="mt-2 space-y-1">
                        {step.sub.map((item) => (
                          <li key={item} className="text-sm font-semibold text-ink-soft sm:text-base">· {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <p className="mb-3 text-base font-bold text-brand-red sm:text-lg">📌 선결제 사용 시</p>
            <div className="space-y-4">
              {USAGE_CASES.map((useCase, index) => (
                <div key={useCase.title} className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
                  <p className="mb-3 text-base font-bold text-ink sm:text-lg">{index === 0 ? '①' : '②'} {useCase.title}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-brand-beige-light p-3 text-center">
                      <p className="text-xs font-semibold text-ink-faint sm:text-sm">선결제 잔액</p>
                      <p className="mt-1 text-lg font-bold text-ink sm:text-xl">{currency(useCase.balance)}</p>
                    </div>
                    <div className="rounded-xl bg-brand-beige-light p-3 text-center">
                      <p className="text-xs font-semibold text-ink-faint sm:text-sm">결제금액</p>
                      <p className="mt-1 text-lg font-bold text-ink sm:text-xl">{currency(useCase.payment)}</p>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {useCase.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm font-semibold text-ink-soft sm:text-base">
                        <span className="text-brand-red">→</span>{point}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-status-pending-bg p-4">
            <p className="mb-3 flex items-center gap-2 text-base font-bold text-status-pending sm:text-lg">
              <AlertTriangle size={19} /> 반드시 지켜야 하는 순서
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {ORDER_STEPS.map((step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-ink ring-1 ring-black/[0.06] sm:text-base">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-pending text-[11px] font-bold text-white">{index + 1}</span>
                    {step}
                  </span>
                  {index < ORDER_STEPS.length - 1 && <ArrowRight size={16} className="shrink-0 text-status-pending" />}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm font-bold text-status-pending sm:text-base">순서를 반드시 지켜주세요.</p>
          </section>

          <section className="rounded-2xl bg-status-rejected-bg p-4">
            <p className="mb-3 flex items-center gap-2 text-base font-bold text-status-rejected sm:text-lg">
              <AlertTriangle size={19} /> 자주 하는 실수
            </p>
            <ul className="space-y-2">
              {COMMON_MISTAKES.map((mistake) => (
                <li key={mistake} className="flex gap-2 text-sm font-semibold text-status-rejected sm:text-base">
                  <span>•</span>{mistake}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </Card>
  );
}

export function PrepaidManagementPage() {
  const { showToast } = useToast();
  const { session } = useAuth();
  const canEdit = canManagePrepayments(session?.name);
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
          {canEdit && <Button size="lg" onClick={openCreate}><span className="flex items-center gap-1.5"><Plus size={18} /> 신규 선결제</span></Button>}
        </div>

        <UsageManualCard />

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

            {canEdit && (
              <div className="grid grid-cols-2 gap-2">
                <Button fullWidth onClick={() => openNewTransaction('usage')} disabled={selected.balance <= 0}>사용하기</Button>
                <Button fullWidth variant="secondary" onClick={() => openNewTransaction('deposit')}>추가 선결제</Button>
              </div>
            )}
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
                        <button key={transaction.id} onClick={() => canEdit && openEdit(transaction)} className={`w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/[0.05] ${canEdit ? 'press-scale' : 'cursor-default'}`}>
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
