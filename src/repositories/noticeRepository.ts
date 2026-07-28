import { storage, STORAGE_KEYS } from '@/data/storage';
import type { Notice } from '@/data/types';

function readAll(): Notice[] {
  return storage.get<Notice[]>(STORAGE_KEYS.notices) ?? [];
}

function writeAll(list: Notice[]): void {
  storage.set(STORAGE_KEYS.notices, list);
}

export const noticeRepository = {
  findAll(): Notice[] {
    return readAll().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },

  insert(notice: Notice): void {
    const all = readAll();
    all.push(notice);
    writeAll(all);
  },

  seedIfEmpty(seed: Notice[]): void {
    if (readAll().length === 0) writeAll(seed);
  },
};
