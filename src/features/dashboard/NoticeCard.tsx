import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { noticeService } from '@/services/noticeService';
import { formatDateTimeKo } from '@/utils/date';

export function NoticeCard() {
  const notices = noticeService.list();

  return (
    <Card>
      <p className="font-bold text-ink mb-3">공지사항</p>
      {notices.length === 0 ? (
        <EmptyState icon="📢" title="등록된 공지사항이 없습니다" />
      ) : (
        <div className="space-y-3">
          {notices.slice(0, 3).map((n) => (
            <div key={n.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
              <p className="font-semibold text-ink text-sm">{n.title}</p>
              <p className="text-sm text-ink-soft mt-0.5">{n.content}</p>
              <p className="text-[11px] text-ink-faint mt-1">{formatDateTimeKo(n.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
