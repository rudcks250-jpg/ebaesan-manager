import { useEffect, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { noticeService } from '@/services/noticeService';
import { formatMonthDay } from '@/utils/date';
import type { Notice } from '@/data/types';

export function NoticeCard() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice>();
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!session) return;
    noticeService.list(session.employeeId)
      .then(setNotices)
      .catch(() => showToast('공지사항을 불러오지 못했습니다.', 'error'));
  }, [session, showToast]);

  const markRead = async (notice: Notice) => {
    if (!session || notice.readAt || marking) return;
    setMarking(true);
    try {
      const readAt = await noticeService.markRead(notice.id, session.employeeId);
      setNotices((current) =>
        current.map((item) => item.id === notice.id ? { ...item, readAt } : item),
      );
      setSelected((current) => current?.id === notice.id ? { ...current, readAt } : current);
      showToast('공지사항을 확인했습니다.');
    } catch {
      showToast('읽음 처리에 실패했습니다.', 'error');
    } finally {
      setMarking(false);
    }
  };

  return (
    <>
      <Card className="border-brand-red/10 bg-gradient-to-br from-white to-brand-red-light/35">
        <div id="notices" className="mb-4 flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red text-white">
            <Bell size={18} />
          </span>
          <p className="text-lg font-bold text-ink">📢 공지사항</p>
        </div>
        {notices.length === 0 ? (
          <EmptyState icon="📢" title="등록된 공지사항이 없습니다" />
        ) : (
          <div className="space-y-3">
            {notices.slice(0, 5).map((notice) => {
              const edited = new Date(notice.updatedAt).getTime() >
                new Date(notice.createdAt).getTime();
              return (
                <div
                  key={notice.id}
                  className="rounded-[20px] border border-black/[0.05] bg-white p-4 shadow-[0_8px_24px_-20px_rgba(15,23,42,.35)]"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!notice.readAt && (
                      <span className="rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white">
                        🔴 NEW
                      </span>
                    )}
                    {notice.isImportant && (
                      <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-orange-700">
                        중요
                      </span>
                    )}
                    {edited && <span className="text-[10px] font-semibold text-ink-faint">수정됨</span>}
                  </div>
                  <p className="mt-2 text-base font-bold text-ink">{notice.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-soft">{notice.content}</p>
                  <p className="mt-2 text-xs text-ink-faint">
                    {formatMonthDay(notice.createdAt.slice(0, 10))} · {notice.createdByName}
                  </p>
                  <button
                    onClick={() => setSelected(notice)}
                    className="mt-3 flex items-center gap-1 text-sm font-bold text-brand-red press-scale"
                  >
                    자세히 보기 <ChevronRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {selected && (
        <Modal
          open
          onClose={() => setSelected(undefined)}
          title={selected.title}
          footer={
            selected.readAt ? (
              <Button fullWidth variant="secondary" onClick={() => setSelected(undefined)}>
                확인 완료
              </Button>
            ) : (
              <Button fullWidth onClick={() => void markRead(selected)} disabled={marking}>
                {marking ? '처리 중...' : '확인했습니다'}
              </Button>
            )
          }
        >
          <div className="space-y-4 pb-5">
            <div className="flex gap-2">
              {selected.isImportant && (
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">중요</span>
              )}
              {!selected.readAt && (
                <span className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">NEW</span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-[15px] leading-7 text-ink">{selected.content}</p>
            <p className="text-xs text-ink-faint">
              {formatMonthDay(selected.createdAt.slice(0, 10))} · {selected.createdByName}
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
