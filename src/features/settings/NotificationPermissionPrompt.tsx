import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/services/notificationService';

const DISMISSED_KEY = 'ebaesan:notification-prompt-dismissed:v1';

export function NotificationPermissionPrompt() {
  const { session, requirePasswordChange } = useAuth();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!session || requirePasswordChange) return;
    if (!notificationService.isConfigured().ready) return;
    if (notificationService.permission() !== 'default') return;
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
    setOpen(true);
  }, [requirePasswordChange, session]);

  if (!session) return null;

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setOpen(false);
  };

  const enable = async () => {
    setEnabling(true);
    try {
      const message = await notificationService.enable(session.employeeId);
      showToast(message);
      setOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '알림을 연결하지 못했습니다.', 'error');
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="알림을 받아보시겠어요?"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={close}>나중에</Button>
          <Button onClick={() => void enable()} disabled={enabling}>
            {enabling ? '연결 중...' : '알림 허용'}
          </Button>
        </div>
      }
    >
      <div className="py-3 pb-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-brand-red-light text-brand-red">
          <BellRing size={30} />
        </div>
        <p className="text-sm leading-6 text-ink-soft">
          스케줄, 휴무 승인, 근무시간 입력 등 중요한 소식을 앱을 열지 않아도 받을 수 있습니다.
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          알림 종류는 설정 화면에서 언제든 변경할 수 있습니다.
        </p>
      </div>
    </Modal>
  );
}
