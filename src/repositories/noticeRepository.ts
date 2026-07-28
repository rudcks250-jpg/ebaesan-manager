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
    const local = localNotices();
    if (local.length === 0) return 0;
    const { data: existing, error: readError } = await supabase
      .from('notices')
      .select('title,content,created_at');
    if (readError) return 0;
    const signatures = new Set((existing ?? []).map((row) => `${row.title}\n${row.content}\n${row.created_at}`));
    const missing = local.filter((notice) => !signatures.has(`${notice.title}\n${notice.content}\n${notice.createdAt}`));
    if (missing.length === 0) return 0;
    const { error } = await supabase.from('notices').insert(missing.map((notice) => ({
      title: notice.title,
      content: notice.content,
      created_by: createdBy,
      created_at: notice.createdAt,
    })));
    if (error) return 0;
    return missing.length;
  },

  seedIfEmpty(seed: Notice[]): void {
    if (localNotices().length === 0) storage.set(STORAGE_KEYS.notices, seed);
  },
};
