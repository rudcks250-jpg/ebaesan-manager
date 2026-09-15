import { storage } from '@/data/storage';
import type { Vendor } from '@/data/types';
import type { ItemSelectionMap } from '@/services/vendorService';

const STORAGE_KEY = 'orderDraftSelections';

type OrderDrafts = Record<string, ItemSelectionMap>;

function emptySelections(vendor: Vendor): ItemSelectionMap {
  return Object.fromEntries(
    (vendor.items ?? []).map((item) => [item.id, { checked: false, qty: 1 }]),
  );
}

export const orderDraftRepository = {
  get(vendor: Vendor): ItemSelectionMap {
    const saved = storage.get<OrderDrafts>(STORAGE_KEY)?.[vendor.id] ?? {};

    // 현재 거래처의 품목만 복원해 삭제된 품목이 임시 발주에 남지 않게 합니다.
    return Object.fromEntries(
      (vendor.items ?? []).map((item) => {
        const selection = saved[item.id];
        return [
          item.id,
          {
            checked: selection?.checked ?? false,
            qty: Math.max(1, selection?.qty ?? 1),
          },
        ];
      }),
    );
  },

  save(vendorId: string, selections: ItemSelectionMap): void {
    const drafts = storage.get<OrderDrafts>(STORAGE_KEY) ?? {};
    storage.set(STORAGE_KEY, { ...drafts, [vendorId]: selections });
  },

  clear(vendor: Vendor): ItemSelectionMap {
    const drafts = storage.get<OrderDrafts>(STORAGE_KEY) ?? {};
    delete drafts[vendor.id];
    storage.set(STORAGE_KEY, drafts);
    return emptySelections(vendor);
  },
};
