import { noticeRepository } from '@/repositories/noticeRepository';

export const noticeService = {
  list(employeeId: string) {
    return noticeRepository.findAll(employeeId);
  },
  create(input: {
    title: string;
    content: string;
    isImportant: boolean;
    employeeId: string;
    employeeName: string;
  }) {
    return noticeRepository.create(input);
  },
  update(id: string, input: { title: string; content: string; isImportant: boolean }) {
    return noticeRepository.update(id, input);
  },
  delete(id: string) {
    return noticeRepository.delete(id);
  },
  markRead(noticeId: string, employeeId: string) {
    return noticeRepository.markRead(noticeId, employeeId);
  },
  getReadStatus(noticeId: string) {
    return noticeRepository.getReadStatus(noticeId);
  },
  async migrateLocal(_createdBy: string) {
    noticeRepository.migrateLocal();
    return 0;
  },
};
