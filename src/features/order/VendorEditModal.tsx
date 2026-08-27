import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { vendorService } from '@/services/vendorService';
import { useToast } from '@/components/common/Toast';
import type { Vendor, VendorItem } from '@/data/types';
import { useAuth } from '@/contexts/AuthContext';

interface VendorEditModalProps {
  vendor?: Vendor;
  onClose: () => void;
  onSaved: () => void;
}

function getEditableItems(vendor: Vendor): VendorItem[] {
  if (vendor.items) return vendor.items;
  if (!vendor.fixedOrder) return [];

  return [
    {
      id: `item_${vendor.id}_fixed`,
      name: vendor.fixedOrder.itemName,
      unit: vendor.fixedOrder.unit,
      defaultQty: vendor.fixedOrder.quantity,
    },
  ];
}

export function VendorEditModal({ vendor, onClose, onSaved }: VendorEditModalProps) {
  const { showToast } = useToast();
  const { session } = useAuth();
  const [newVendorId] = useState(() => `vendor_${crypto.randomUUID()}`);
  const isNew = !vendor;
  const draftVendor: Vendor = vendor ?? {
    id: newVendorId,
    name: '',
    contactName: '',
    phone: '',
    type: 'quantity',
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const [name, setName] = useState(draftVendor.name);
  const [contactName, setContactName] = useState(draftVendor.contactName);
  const [phone, setPhone] = useState(draftVendor.phone);
  const initialItems = getEditableItems(draftVendor);
  const [items, setItems] = useState<VendorItem[]>(initialItems);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!session || saving) return;
    if (!name.trim()) {
      setError('거래처명을 입력해주세요.');
      return;
    }
    if (items.some((item) => !item.name.trim() || !item.unit.trim() || item.defaultQty < 1)) {
      setError('품목명, 단위, 기본 수량을 올바르게 입력해주세요.');
      return;
    }
    const itemsChanged = JSON.stringify(items) !== JSON.stringify(initialItems);
    const itemPatch: Partial<Vendor> = draftVendor.type === 'quantity'
      ? { items }
      : itemsChanged
        ? { type: 'quantity', items, fixedOrder: undefined }
        : {};

    setSaving(true);
    try {
      const patch = {
          name: name.trim(),
          contactName: contactName.trim(),
          phone: phone.replace(/\D/g, ''),
          ...itemPatch,
        };
      if (isNew) {
        await vendorService.create({ ...draftVendor, ...patch, type: 'quantity', items }, session.employeeId);
      } else {
        await vendorService.update(draftVendor.id, patch, session.employeeId);
      }
      showToast(isNew ? '새 거래처가 모든 기기에 추가되었습니다.' : '거래처 정보가 모든 기기에 적용되었습니다.');
      onSaved();
      onClose();
    } catch (saveError) {
      console.error('[OrderVendor] shared update failed', saveError);
      setError('공용 발주정보 저장에 실패했습니다. DB 설정을 확인해주세요.');
      showToast('거래처 정보를 저장하지 못했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session || !vendor || deleting) return;
    if (!window.confirm(`${vendor.name} 거래처를 삭제하시겠습니까?\n기존 발주 이력은 삭제되지 않습니다.`)) return;
    setDeleting(true);
    try {
      await vendorService.remove(vendor.id, session.employeeId);
      showToast('거래처가 모든 기기에서 삭제되었습니다.');
      onSaved();
      onClose();
    } catch (deleteError) {
      console.error('[OrderVendor] shared delete failed', deleteError);
      setError('거래처 삭제에 실패했습니다. DB 설정을 확인해주세요.');
      showToast('거래처를 삭제하지 못했습니다.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const addItem = () => {
    setItems((current) => [
      ...current,
      {
        id: `item_${draftVendor.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: '',
        unit: '개',
        defaultQty: 1,
      },
    ]);
    setError('');
  };

  const updateItem = (id: string, patch: Partial<VendorItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setError('');
  };

  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? '새 거래처 추가' : '거래처 정보 수정'}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>취소</Button>
          <Button fullWidth disabled={saving} onClick={() => void handleSave()}>{saving ? '저장 중...' : '저장'}</Button>
        </div>
      }
    >
      <Input label="거래처명" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 식자재" />
      <Input label="담당자명" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="예: 홍길동" />
      <Input label="전화번호" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" />

      <section className="mt-5 border-t border-black/[0.06] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-ink">발주 품목</p>
              <p className="mt-0.5 text-xs text-ink-faint">품목명, 단위, 기본 수량을 관리합니다.</p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-red-light px-3 text-sm font-bold text-brand-red press-scale"
            >
              <Plus size={16} /> 품목 추가
            </button>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl bg-brand-beige-light px-4 py-6 text-center text-sm text-ink-faint">
              등록된 품목이 없습니다. 품목 추가를 눌러 시작해주세요.
            </div>
          ) : (
            <div className="max-h-[38vh] space-y-3 overflow-y-auto pr-1">
              {items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-black/[0.07] bg-white p-3">
                  <div className="grid grid-cols-[minmax(0,1fr)_72px_64px_40px] items-end gap-2">
                    <label className="min-w-0 text-[11px] font-semibold text-ink-faint">
                      품목명
                      <input
                        value={item.name}
                        onChange={(event) => updateItem(item.id, { name: event.target.value })}
                        placeholder="예: 생수"
                        className="mt-1 h-10 w-full min-w-0 rounded-xl border border-black/[0.08] px-3 text-sm text-ink outline-none focus:border-brand-red"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-ink-faint">
                      단위
                      <input
                        value={item.unit}
                        onChange={(event) => updateItem(item.id, { unit: event.target.value })}
                        placeholder="개"
                        className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-2 text-center text-sm text-ink outline-none focus:border-brand-red"
                      />
                    </label>
                    <label className="text-[11px] font-semibold text-ink-faint">
                      기본
                      <input
                        type="number"
                        min={1}
                        value={item.defaultQty}
                        onChange={(event) => updateItem(item.id, { defaultQty: Math.max(1, Number(event.target.value) || 1) })}
                        className="mt-1 h-10 w-full rounded-xl border border-black/[0.08] px-2 text-center text-sm tabular-nums text-ink outline-none focus:border-brand-red"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      aria-label={`${item.name || '새 품목'} 삭제`}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-rejected-bg text-status-rejected press-scale"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>

      {error && <p className="mt-3 text-sm font-semibold text-status-rejected">{error}</p>}
      {!isNew && (
        <button type="button" disabled={deleting} onClick={() => void handleDelete()} className="mb-5 mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-status-rejected-bg text-sm font-bold text-status-rejected disabled:opacity-50">
          <Trash2 size={16} /> {deleting ? '삭제 중...' : '이 거래처 삭제'}
        </button>
      )}
    </Modal>
  );
}
