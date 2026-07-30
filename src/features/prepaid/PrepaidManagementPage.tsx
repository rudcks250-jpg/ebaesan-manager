import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CreditCard, History, Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
import { formatDateTimeKo, formatMonthDay } from '@/utils/date';
import type { PrepaidAccount, PrepaidUsage } from '@/data/types';

function currency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function amountValue(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

export function PrepaidManagementPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<PrepaidAccount[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PrepaidAccount>();
  const [usages, setUsages] = useState<PrepaidUsage[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const load = useCallback(async () => {
    try {
      const next = await prepaidService.list();
      setAccounts(next);
      setSelected((current) => current
        ? next.find((account) => account.id === current.id)
        : undefined);
    } catch {
      showToast('선결제 목록을 불러오지 못했습니다.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return accounts;
    return accounts.filter((account) =>
      account.companyName.toLowerCase().includes(normalized) ||
      account.contactPerson.toLowerCase().includes(normalized),
    );
  }, [accounts, query]);

  const resetForm = () => {
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setAmount('');
    setMemo('');
  };

  const openCreate = () => {
    resetForm();
    setCreateOpen(true);
  };

  const openDetail = async (account: PrepaidAccount) => {
    setSelected(account);
    try {
      setUsages(await prepaidService.listUsages(account.id));
    } catch {
      showToast('사용 내역을 불러오지 못했습니다.', 'error');
    }
  };

  const create = async () => {
    if (!session || !companyName.trim() || !contactPerson.trim() || amountValue(amount) <= 0) return;
    setSaving(true);
    try {
      await prepaidService.create({
        companyName: companyName.trim(),
        contactPerson: contactPerson.trim(),
        phone,
        amount: amountValue(amount),
        memo,
        employeeId: session.employeeId,
        employeeName: session.name,
      });
      setCreateOpen(false);
      resetForm();
      await load();
      showToast('선결제를 등록했습니다.');
    } catch {
      showToast('선결제 등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openUsage = () => {
    setAmount('');
    setMemo('');
    setUsageOpen(true);
  };

  const registerUsage = async () => {
    if (!selected || amountValue(amount) <= 0 || saving) return;
    setSaving(true);
    try {
      await prepaidService.use(selected.id, amountValue(amount), memo);
      setUsageOpen(false);
      await load();
      setUsages(await prepaidService.listUsages(selected.id));
      showToast('사용 금액을 등록했습니다.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '사용 등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!selected) return;
    setAmount(String(selected.initialAmount));
    setMemo(selected.memo ?? '');
    setEditOpen(true);
  };

  const update = async () => {
    if (!selected || amountValue(amount) <= 0 || saving) return;
    setSaving(true);
    try {
      await prepaidService.update(selected.id, amountValue(amount), memo);
      setEditOpen(false);
      await load();
      showToast('선결제 정보를 수정했습니다.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '수정에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    try {
      await prepaidService.delete(selected.id);
      setDeleting(false);
      setSelected(undefined);
      setUsages([]);
      await load();
      showToast('선결제 회사를 삭제했습니다.');
    } catch {
      showToast('삭제에 실패했습니다.', 'error');
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
              placeholder="회사명 또는 담당자 검색"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
            />
          </label>
          <Button onClick={openCreate}>
            <span className="flex items-center gap-1.5"><Plus size={17} /> 선결제 등록</span>
          </Button>
        </div>

        {filtered.length === 0 ? (
          <Card><EmptyState icon="💳" title={query ? '검색 결과가 없습니다' : '등록된 선결제가 없습니다'} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((account) => (
              <button key={account.id} onClick={() => void openDetail(account)} className="text-left">
                <Card hover className="h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-ink">{account.companyName}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">{account.contactPerson}</p>
                    </div>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red-light text-brand-red">
                      <Building2 size={19} />
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-ink-faint">현재 잔액</p>
                    <p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-ink">{currency(account.balance)}</p>
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-ink-faint">최근 사용</p>
                      <p className="text-sm font-semibold text-ink-soft">
                        {account.lastUsedAt ? formatMonthDay(account.lastUsedAt.slice(0, 10)) : '사용 내역 없음'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      account.balance > 0
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-red-50 text-red-600'
                    }`}>
                      {account.balance > 0 ? '🟢 사용 가능' : '🔴 사용 완료'}
                    </span>
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
        title="선결제 등록"
        footer={<Button fullWidth onClick={() => void create()} disabled={saving || !companyName.trim() || !contactPerson.trim() || amountValue(amount) <= 0}>{saving ? '등록 중...' : '등록'}</Button>}
      >
        <div className="pb-5">
          <Input label="회사명" value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
          <Input label="담당자" value={contactPerson} onChange={(event) => setContactPerson(event.target.value)} />
          <Input label="연락처 (선택)" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <Input label="선결제 금액" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} placeholder="500000" />
          {amountValue(amount) > 0 && <p className="-mt-2 mb-4 text-sm font-bold text-brand-red">{currency(amountValue(amount))}</p>}
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      {selected && !usageOpen && !editOpen && (
        <Modal
          open
          onClose={() => setSelected(undefined)}
          title={selected.companyName}
          footer={
            <Button fullWidth onClick={openUsage} disabled={selected.balance <= 0}>
              <span className="flex items-center justify-center gap-1.5"><CreditCard size={17} /> 사용 등록</span>
            </Button>
          }
        >
          <div className="space-y-5 pb-5">
            <div className="rounded-[22px] bg-gradient-to-br from-brand-red to-[#52A8FF] p-5 text-white">
              <p className="text-xs font-semibold text-white/70">현재 잔액</p>
              <p className="mt-1 text-3xl font-bold">{currency(selected.balance)}</p>
              <p className="mt-3 text-xs text-white/70">최초 선결제 {currency(selected.initialAmount)}</p>
            </div>
            <div className="rounded-2xl bg-brand-beige-light p-4 text-sm">
              <p className="font-bold text-ink">{selected.contactPerson}</p>
              {selected.phone && <p className="mt-1 text-ink-soft">{selected.phone}</p>}
              {selected.memo && <p className="mt-2 text-ink-soft">{selected.memo}</p>}
              <p className="mt-2 text-xs text-ink-faint">등록 {formatDateTimeKo(selected.createdAt)} · {selected.createdByName}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={openEdit}>
                <span className="flex items-center gap-1"><Pencil size={14} /> 수정</span>
              </Button>
              <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
                <span className="flex items-center gap-1"><Trash2 size={14} /> 삭제</span>
              </Button>
            </div>
            <section>
              <p className="mb-3 flex items-center gap-1.5 font-bold text-ink"><History size={17} /> 사용 내역</p>
              {usages.length === 0 ? (
                <p className="text-sm text-ink-faint">아직 사용 내역이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {usages.map((usage) => (
                    <div key={usage.id} className="rounded-2xl border border-black/[0.05] bg-white p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-ink">-{currency(usage.amount)}</p>
                        <p className="text-xs text-ink-faint">{formatDateTimeKo(usage.usedAt)}</p>
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{usage.usedByName}{usage.memo ? ` · ${usage.memo}` : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </Modal>
      )}

      <Modal
        open={usageOpen}
        onClose={() => setUsageOpen(false)}
        title="사용 등록"
        footer={<Button fullWidth onClick={() => void registerUsage()} disabled={saving || amountValue(amount) <= 0 || amountValue(amount) > (selected?.balance ?? 0)}>{saving ? '등록 중...' : '등록'}</Button>}
      >
        <div className="pb-5">
          <p className="mb-4 rounded-2xl bg-brand-red-light p-4 text-sm font-semibold text-brand-red">
            사용 가능 잔액 {currency(selected?.balance ?? 0)}
          </p>
          <Input label="사용 금액" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="선결제 수정"
        footer={<Button fullWidth onClick={() => void update()} disabled={saving || amountValue(amount) <= 0}>{saving ? '수정 중...' : '수정 완료'}</Button>}
      >
        <div className="pb-5">
          <Input label="선결제 금액" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ''))} />
          <Textarea label="메모" value={memo} onChange={(event) => setMemo(event.target.value)} />
        </div>
      </Modal>

      <ConfirmDialog
        open={deleting}
        title="선결제 회사를 삭제하시겠습니까?"
        description="회사 정보와 모든 사용 내역이 함께 삭제되며 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => void remove()}
        onClose={() => setDeleting(false)}
      />
    </Layout>
  );
}
