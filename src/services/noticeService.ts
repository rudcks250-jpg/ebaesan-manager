import { noticeRepository } from '@/repositories/noticeRepository';
import { notificationService } from '@/services/notificationService';

export const noticeService = {
  async list() {
    return noticeRepository.findAll();
  },
  async create(title: string, content: string) {
    const notice = await noticeRepository.create(title, content);
    await notificationService.dispatch();
    return notice;
  },
  async migrateLocal(createdBy: string) {
    return noticeRepository.migrateLocal(createdBy);
  },
};
