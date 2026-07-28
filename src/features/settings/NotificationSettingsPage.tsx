import { useEffect, useState } from 'react';
import { Bell, BellRing, Send } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  notificationService,
  type NotificationPreferences,
} from '@/services/notificationService';
import type { UserRole } from '@/data/types';

const LABELS: Array<{ key: keyof NotificationPreferences; label: string; roles: UserRole[] }> = [
  { key: 'scheduleEnabled', label: '스케줄 알림', roles: ['manager', 'employee'] },
  { key: 'noticeEnabled', label: '공지사항 알림', roles: ['manager', 'employee'] },
  { key: 'worktimeEnabled', label: '근무시간 입력 알림', roles: ['manager', 'employee'] },
  { key: 'leaveReminderEnabled', label: '다음 주 휴무 신청 알림', roles: ['manager', 'employee'] },
  { key: 'leaveResultEnabled', label: '휴무 승인·반려 알림', roles: ['manager', 'employee'] },
  { key: 'payrollEnabled', label: '급여일 알림', roles: ['manager', 'employee'] },
  { key: 'orderEnabled', label: '발주 확인 알림', roles: ['admin', 'manager'] },
  { key: 'leaveRequestAdminEnabled', label: '직원 휴무 신청 알림', roles: ['admin'] },
];

export function NotificationSettingsPage() {
  const { session } = useAuth();
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = notificationService.isConfigured();

  useEffect(() => {
    if (!session) return;
    notificationService.getPreferences(session.employeeId)
      .then(setPreferences)
      .catch(() => showToast('알림 설정을 불러오지 못했습니다.', 'error'));
  }, [session, showToast]);

  if (!session) return null;
  const visible = LABELS.filter((item) => item.roles.includes(session.role));

  const enable = async () => {
    setBusy(true);
    try {
      showToast(await notificationService.enable(session.employeeId));
    } catch (error) {
      showToast(error instanceof Error ? error.message : '알림 연결에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    try {
      await notificationService.savePreferences(session.employeeId, next);
    } catch {
      setPreferences(preferences);
      showToast('알림 설정을 저장하지 못했습니다.', 'error');
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const result = await notificationService.sendTest();
      showToast(result.sent > 0 ? '테스트 알림을 전송했습니다.' : '활성화된 Push Token이 없습니다.', result.sent > 0 ? 'success' : 'error');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '테스트 알림 전송에 실패했습니다.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="알림 설정" showGreeting={false}>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-ink">푸시 알림 연결</p>
              <p className="mt-1 text-sm leading-6 text-ink-soft">
                현재 권한: {notificationService.permission() === 'granted' ? '허용됨' : notificationService.permission() === 'denied' ? '차단됨' : '미설정'}
              </p>
            </div>
            <div className="icon-well bg-brand-red-light text-brand-red"><BellRing size={19} /></div>
          </div>
          {!configured.ready && (
            <p className="mt-4 rounded-xl bg-status-pending-bg px-3 py-2 text-xs text-status-pending">
              서버 환경변수 등록 후 알림 연결이 활성화됩니다.
            </p>
          )}
          <Button fullWidth className="mt-4" onClick={() => void enable()} disabled={busy || !configured.ready}>
            <span className="inline-flex items-center gap-2"><Bell size={16} /> 알림 허용 및 연결</span>
          </Button>
        </Card>

        <Card>
          <p className="font-bold text-ink">테스트 알림</p>
          <p className="mt-1 text-sm leading-6 text-ink-soft">현재 기기로 실제 테스트 알림을 전송합니다.</p>
          <Button fullWidth variant="secondary" className="mt-4" onClick={() => void sendTest()} disabled={busy || notificationService.permission() !== 'granted'}>
            <span className="inline-flex items-center gap-2"><Send size={16} /> 테스트 알림 보내기</span>
          </Button>
        </Card>

        <Card className="md:col-span-2">
          <p className="font-bold text-ink mb-3">알림 종류</p>
          {!preferences ? (
            <p className="text-sm text-ink-faint">설정을 불러오는 중...</p>
          ) : (
            <div className="grouped-list">
              {visible.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <span className="text-sm font-medium text-ink">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={preferences[item.key]}
                    onChange={() => void toggle(item.key)}
                    className="h-5 w-5 accent-[#007AFF]"
                  />
                </label>
              ))}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
}
