import { noticeRepository } from '@/repositories/noticeRepository';
import { generateId } from '@/utils/id';
import { nowIso } from '@/utils/date';

export const noticeService = {
  list() {
    return noticeRepository.findAll();
  },
  create(title: string, content: string, createdBy: string) {
    noticeRepository.insert({
      id: generateId('notice'),
      title,
      content,
      createdAt: nowIso(),
      createdBy,
    });
  },
};
