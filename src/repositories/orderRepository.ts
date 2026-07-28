import { storage, STORAGE_KEYS } from '@/data/storage';
import type { OrderItem } from '@/data/types';

function readAll(): OrderItem[] {
  return storage.get<OrderItem[]>(STORAGE_KEYS.orderItems) ?? [];
}

function writeAll(list: OrderItem[]): void {
  storage.set(STORAGE_KEYS.orderItems, list);
}

export const orderRepository = {
  findAll(): OrderItem[] {
    return readAll();
  },

  findByCategory(category: OrderItem['category']): OrderItem[] {
    return readAll().filter((i) => i.category === category);
  },

  insert(item: OrderItem): void {
    const all = readAll();
    all.push(item);
    writeAll(all);
  },

  seedIfEmpty(seed: OrderItem[]): void {
    if (readAll().length === 0) writeAll(seed);
  },
};
