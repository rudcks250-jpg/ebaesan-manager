import { supabase } from '@/lib/supabaseClient';
import { storage, STORAGE_KEYS } from '@/data/storage';
import type { Notice, NoticeReadStatus } from '@/data/types';

function rowToNotice(row: Record<string, unknown>, readAt?: string): Notice {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    isImportant: Boolean(row.is_important),
    createdAt: String(row.created_at),
    createdBy: String(row.created_by),
    createdByName: String(row.created_by_name),
    updatedAt: String(row.updated_at),
    readAt,
  };
}

export const noticeRepository = {
  async findAll(employeeId: string): Promise<Notice[]> {
    const [noticeResult, readResult] = await Promise.all([
      supabase
        .from('notices')
        .select('*')
        .order('is_important', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('notice_reads')
        .select('notice_id,read_at')
        .eq('employee_id', employeeId),
    ]);
    if (noticeResult.error) throw noticeResult.error;
    if (readResult.error) throw readResult.error;
    const readAtByNoticeId = new Map(
      (readResult.data ?? []).map((row) => [row.notice_id, row.read_at]),
    );
    return (noticeResult.data ?? []).map((row) =>
      rowToNotice(row, readAtByNoticeId.get(row.id)),
    );
  },

  async create(input: {
    title: string;
    content: string;
    isImportant: boolean;
    employeeId: string;
    employeeName: string;
  }): Promise<Notice> {
    const { data, error } = await supabase
      .from('notices')
      .insert({
        title: input.title,
        content: input.content,
        is_important: input.isImportant,
        created_by: input.employeeId,
        created_by_name: input.employeeName,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToNotice(data);
  },

  async update(
    id: string,
    input: { title: string; content: string; isImportant: boolean },
  ): Promise<Notice> {
    const { data, error } = await supabase
      .from('notices')
      .update({
        title: input.title,
        content: input.content,
        is_important: input.isImportant,
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToNotice(data);
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) throw error;
  },

  async markRead(noticeId: string, employeeId: string): Promise<string> {
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('notice_reads')
      .upsert(
        { notice_id: noticeId, employee_id: employeeId, read_at: readAt },
        { onConflict: 'notice_id,employee_id' },
      );
    if (error) throw error;
    return readAt;
  },

  async getReadStatus(noticeId: string): Promise<NoticeReadStatus[]> {
    const { data, error } = await supabase.rpc('get_notice_read_status', {
      p_notice_id: noticeId,
    });
    if (error) throw error;
    return (data ?? []).map((row: Record<string, unknown>) => ({
      employeeId: String(row.employee_id),
      employeeName: String(row.employee_name),
      readAt: row.read_at ? String(row.read_at) : undefined,
    }));
  },

  migrateLocal(): void {
    storage.remove(STORAGE_KEYS.notices);
  },

  seedIfEmpty(): void {
    // 공지사항은 Supabase만 사용합니다.
  },
};
