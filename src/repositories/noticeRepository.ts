import { supabase } from '@/lib/supabaseClient';
import { storage, STORAGE_KEYS } from '@/data/storage';
import type { Notice } from '@/data/types';

function localNotices(): Notice[] {
  return storage.get<Notice[]>(STORAGE_KEYS.notices) ?? [];
}

function rowToNotice(row: Record<string, string>): Notice {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

export const noticeRepository = {
  async findAll(): Promise<Notice[]> {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      return localNotices().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return (data ?? []).map(rowToNotice);
  },

  async create(title: string, content: string): Promise<Notice> {
    const { data, error } = await supabase.rpc('create_notice_with_notification', {
      p_title: title,
      p_content: content,
    });
    if (error) throw error;
    return rowToNotice(data);
  },

  async migrateLocal(createdBy: string): Promise<number> {
    void createdBy;
    // 공지사항은 Supabase가 유일한 저장소입니다. 과거 로컬 공지가 삭제 후
    // 다시 업로드되지 않도록 기존 브라우저 데이터도 제거합니다.
    storage.remove(STORAGE_KEYS.notices);
    return 0;
  },

  seedIfEmpty(seed: Notice[]): void {
    if (localNotices().length === 0) storage.set(STORAGE_KEYS.notices, seed);
  },
};
