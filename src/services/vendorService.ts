import { vendorRepository } from '@/repositories/vendorRepository';
import { DIRECT_VENDOR_ORDER_MESSAGES } from '@/data/directVendorOrders';
import type { Vendor, VendorType } from '@/data/types';

export type ItemSelectionMap = Record<string, { checked: boolean; qty: number }>;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const vendorService = {
  getDirectOrderMessage(vendor: Vendor): string | undefined {
    return vendor.type === 'fixed' ? DIRECT_VENDOR_ORDER_MESSAGES[vendor.id] : undefined;
  },

  list(): Vendor[] {
    return vendorRepository.findAll();
  },

  listByType(type: VendorType): Vendor[] {
    return vendorRepository.findAll().filter((v) => v.type === type);
  },

  update(id: string, patch: Partial<Vendor>): Vendor | undefined {
    return vendorRepository.update(id, patch);
  },

  updateContact(id: string, name: string, contactName: string, phone: string): Vendor | undefined {
    return vendorRepository.update(id, {
      name,
      contactName,
      phone: phone.replace(/\D/g, ''),
    });
  },

  markOrdered(id: string, orderedByName?: string): Vendor | undefined {
    return vendorRepository.update(id, {
      lastOrderAt: new Date().toISOString(),
      lastOrderedByName: orderedByName,
    });
  },

  cancelTodayOrder(id: string): Vendor | undefined {
    return vendorRepository.update(id, {
      lastOrderAt: undefined,
      lastOrderedByName: undefined,
    });
  },

  // 오늘 발주를 완료했는지 여부 (자정이 지나면 자동으로 false로 초기화됨)
  isOrderedToday(vendor: Vendor): boolean {
    if (!vendor.lastOrderAt) return false;
    const last = new Date(vendor.lastOrderAt);
    const now = new Date();
    return (
      last.getFullYear() === now.getFullYear() &&
      last.getMonth() === now.getMonth() &&
      last.getDate() === now.getDate()
    );
  },

  // '기본 발주 불러오기' - 모든 품목을 기본 수량으로 체크
  getDefaultSelections(vendor: Vendor): ItemSelectionMap {
    const map: ItemSelectionMap = {};
    (vendor.items ?? []).forEach((item) => {
      map[item.id] = { checked: true, qty: item.defaultQty ?? 1 };
    });
    return map;
  },

  // 수량 입력형 거래처 - 체크된 품목만 문자 내용에 포함
  buildQuantityMessage(vendor: Vendor, selections: ItemSelectionMap): string {
    const lines = (vendor.items ?? [])
      .filter((item) => selections[item.id]?.checked)
      .map((item) => `${item.name} ${selections[item.id].qty}${item.unit}`);
    if (lines.length === 0) return '';
    return `안녕하세요.\n${lines.join('\n')}\n부탁드립니다.\n감사합니다.`;
  },

  // 고정 발주형 거래처 - 항상 같은 품목/수량
  buildFixedMessage(vendor: Vendor): string {
    if (!vendor.fixedOrder) return '';
    const { itemName, quantity, unit } = vendor.fixedOrder;
    return `안녕하세요.\n${itemName} ${quantity}${unit} 부탁드립니다.\n감사합니다.`;
  },

  formatPhoneDisplay(phone: string): string {
    const d = phone.replace(/\D/g, '');
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return phone;
  },

  formatLastOrder(iso?: string): string | null {
    if (!iso) return null;
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    let h = d.getHours();
    const ampm = h < 12 ? '오전' : '오후';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const min = pad2(d.getMinutes());
    return `${y}.${m}.${day} ${ampm} ${h12}:${min}`;
  },
};
