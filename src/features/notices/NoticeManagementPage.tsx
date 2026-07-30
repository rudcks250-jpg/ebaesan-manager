import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Circle, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input, Textarea } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { noticeService } from '@/services/noticeService';
import { formatDateTimeKo } from '@/utils/date';
import type { Notice, NoticeReadStatus } from '@/data/types';

export function NoticeManagementPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice>();
  const [deleting, setDeleting] = useState<Notice>();
  const [readStatusNotice, setReadStatusNotice] = useState<Notice>();
  const [readStatuses, setReadStatuses] = useState<NoticeReadStatus[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [important, setImportant] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingReads, setLoadingReads] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setNotices(await noticeService.list(session.employeeId));
    } catch {
      showToast('공지사항을 불러오지 못했습니다.', 'error');
    }
  }, [session, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(undefined);
    setTitle('');
    setContent('');
    setImportant(false);
    setFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditing(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setImportant(notice.isImportant);
    setFormOpen(true);
  };

  const save = async () => {
    if (!session || !title.trim() || !content.trim() || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await noticeService.update(editing.id, {
          title: title.trim(),
          content: content.trim(),
          isImportant: important,
        });
        showToast('공지사항을 수정했습니다.');
      } else {
        await noticeService.create({
          title: title.trim(),
          content: content.trim(),
          isImportant: important,
          employeeId: session.employeeId,
          employeeName: session.name,
        });
        showToast('공지사항을 등록했습니다.');
      }
      setFormOpen(false);
      await load();
    } catch {
      showToast(editing ? '공지사항 수정에 실패했습니다.' : '공지사항 등록에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await noticeService.delete(deleting.id);
      showToast('공지사항을 삭제했습니다.');
      setDeleting(undefined);
      await load();
    } catch {
      showToast('공지사항 삭제에 실패했습니다.', 'error');
    }
  };

  const openReadStatus = async (notice: Notice) => {
    setReadStatusNotice(notice);
    setReadStatuses([]);
    setLoadingReads(true);
    try {
      setReadStatuses(await noticeService.getReadStatus(notice.id));
    } catch {
      showToast('읽음 현황을 불러오지 못했습니다.', 'error');
    } finally {
      setLoadingReads(false);
    }
  };

  const readEmployees = readStatuses.filter((status) => status.readAt);
  const unreadEmployees = readStatuses.filter((status) => !status.readAt);

  return (
    <Layout title="공지사항">
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button onClick={openCreate}>
            <span className="flex items-center gap-1.5"><Plus size={17} /> 공지사항 작성</span>
          </Button>
        </div>

        {notices.length === 0 ? (
          <Card><EmptyState icon="📢" title="등록된 공지사항이 없습니다" /></Card>
        ) : (
          <div className="space-y-3">
            {notices.map((notice) => {
              const edited = new Date(notice.updatedAt).getTime() >
                new Date(notice.createdAt).getTime();
              return (
                <Card key={notice.id} className={notice.isImportant ? 'border-orange-200 bg-orange-50/35' : ''}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {notice.isImportant && (
                          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">중요</span>
                        )}
                        {edited && <span className="text-xs font-semibold text-ink-faint">수정됨</span>}
                      </div>
                      <h2 className="mt-2 text-lg font-bold text-ink">{notice.title}</h2>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{notice.content}</p>
                      <p className="mt-3 text-xs text-ink-faint">
                        {formatDateTimeKo(notice.createdAt)} · {notice.createdByName}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => void openReadStatus(notice)}>
                        <span className="flex items-center gap-1.5"><Users size={15} /> 읽음 현황</span>
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => openEdit(notice)}>
                        <span className="flex items-center gap-1.5"><Pencil size={15} /> 수정</span>
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleting(notice)}>
                        <span className="flex items-center gap-1.5"><Trash2 size={15} /> 삭제</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? '공지사항 수정' : '공지사항 작성'}
        footer={
          <Button
            fullWidth
            onClick={() => void save()}
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving ? '저장 중...' : editing ? '수정 완료' : '등록'}
          </Button>
        }
      >
        <div className="space-y-1 pb-5">
          <Input label="제목" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Textarea label="내용" rows={6} value={content} onChange={(event) => setContent(event.target.value)} />
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-brand-beige-light p-4">
            <input
              type="checkbox"
              checked={important}
              onChange={(event) => setImportant(event.target.checked)}
              className="h-5 w-5 accent-brand-red"
            />
            <span className="text-sm font-bold text-ink">중요 공지</span>
          </label>
        </div>
      </Modal>

      {readStatusNotice && (
        <Modal
          open
          onClose={() => setReadStatusNotice(undefined)}
          title="공지 읽음 현황"
          footer={<Button fullWidth variant="secondary" onClick={() => setReadStatusNotice(undefined)}>닫기</Button>}
        >
          <div className="space-y-5 pb-5">
            <div className="rounded-2xl bg-brand-beige-light p-4">
              <p className="font-bold text-ink">{readStatusNotice.title}</p>
            </div>
            {loadingReads ? (
              <p className="py-8 text-center text-sm text-ink-faint">불러오는 중...</p>
            ) : (
              <>
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                    <CheckCircle2 size={16} /> 읽음 {readEmployees.length}명
                  </p>
                  <div className="space-y-2">
                    {readEmployees.map((status) => (
                      <div key={status.employeeId} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-sm">
                        <span className="font-semibold text-emerald-800">✔ {status.employeeName}</span>
                        <span className="text-xs text-emerald-700">{status.readAt && formatDateTimeKo(status.readAt)}</span>
                      </div>
                    ))}
                    {readEmployees.length === 0 && <p className="text-sm text-ink-faint">아직 읽은 직원이 없습니다.</p>}
                  </div>
                </section>
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
                    <Circle size={16} /> 미확인 {unreadEmployees.length}명
                  </p>
                  <div className="space-y-2">
                    {unreadEmployees.map((status) => (
                      <div key={status.employeeId} className="rounded-xl bg-brand-beige-light px-3 py-2.5 text-sm font-semibold text-ink-soft">
                        ○ {status.employeeName}
                      </div>
                    ))}
                    {unreadEmployees.length === 0 && <p className="text-sm text-ink-faint">모든 직원이 확인했습니다.</p>}
                  </div>
                </section>
              </>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="공지사항을 삭제하시겠습니까?"
        description="삭제한 공지와 읽음 기록은 복구할 수 없습니다."
        confirmLabel="삭제"
        danger
        onConfirm={() => void remove()}
        onClose={() => setDeleting(undefined)}
      />
    </Layout>
  );
}
