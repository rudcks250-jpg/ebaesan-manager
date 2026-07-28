import { storage, STORAGE_KEYS } from '@/data/storage';
import type { Vendor } from '@/data/types';

// 거래처 저장소. orderRepository(품목 카테고리 구조)는 하위 호환을 위해
// 그대로 유지하고, 실제 발주관리 화면은 이 저장소를 사용합니다.

function readAll(): Vendor[] {
  return storage.get<Vendor[]>(STORAGE_KEYS.vendors) ?? [];
}

function writeAll(vendors: Vendor[]): void {
  storage.set(STORAGE_KEYS.vendors, vendors);
}

export const vendorRepository = {
  findAll(): Vendor[] {
    return readAll();
  },

  findById(id: string): Vendor | undefined {
    return readAll().find((v) => v.id === id);
  },

  update(id: string, patch: Partial<Vendor>): Vendor | undefined {
    const all = readAll();
    const idx = all.findIndex((v) => v.id === id);
    if (idx === -1) return undefined;
    all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[idx];
  },

  seedIfEmpty(seed: Vendor[]): void {
    if (readAll().length === 0) writeAll(seed);
  },
};
