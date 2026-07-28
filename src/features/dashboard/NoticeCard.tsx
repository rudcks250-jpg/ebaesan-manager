import { useEffect, useState } from 'react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Input, Textarea } from '@/components/common/Input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { noticeService } from '@/services/noticeService';
import { formatDateTimeKo } from '@/utils/date';
import type { Notice } from '@/data/types';

export function NoticeCard() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => noticeService.list().then(setNotices);

  useEffect(() => {
    if (!session) return;
    const initialize = async () => {
      if (session.role === 'admin') await noticeService.migrateLocal(session.employeeId);
      await load();
    };
    void initialize();
  }, [session]);

  const create = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      await noticeService.create(title.trim(), content.trim());
      setTitle('');
      setContent('');
      setOpen(false);
      await load();
      showToast('공지사항을 등록하고 직원에게 알림을 전송했습니다.');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '공지사항 등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <div id="notices" className="flex items-center justify-between gap-3 mb-3">
          <p className="font-bold text-ink">공지사항</p>
          {session?.role === 'admin' && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>공지 등록</Button>}
        </div>
        {notices.length === 0 ? (
          <EmptyState icon="📢" title="등록된 공지사항이 없습니다" />
        ) : (
          <div className="space-y-3">
            {notices.slice(0, 3).map((notice) => (
              <div key={notice.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <p className="font-semibold text-ink text-sm">{notice.title}</p>
                <p className="text-sm text-ink-soft mt-0.5">{notice.content}</p>
                <p className="text-[11px] text-ink-faint mt-1">{formatDateTimeKo(notice.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="공지사항 등록"
        footer={<Button fullWidth onClick={() => void create()} disabled={saving || !title.trim() || !content.trim()}>{saving ? '등록 중...' : '등록 및 알림 발송'}</Button>}
      >
        <div className="space-y-4 pb-5">
          <Input label="제목" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea label="내용" value={content} onChange={(event) => setContent(event.target.value)} />
        </div>
      </Modal>
    </>
  );
}
