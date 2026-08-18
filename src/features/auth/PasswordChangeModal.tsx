import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { authService } from '@/services/authService';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';

const MIN_PASSWORD_LENGTH = 6;

// 첫 로그인 시 어느 화면에 있든(라우트 이동과 무관하게) 표시되는
// 전역 비밀번호 변경 모달입니다. App.tsx 최상위에서 렌더링합니다.
export function PasswordChangeModal() {
  const { session, completePasswordChange, logout } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  if (!session) return null;

  const handleSubmit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해주세요. 예: 000000`);
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    try {
      await authService.changePassword(session.employeeId, password);
      showToast('비밀번호가 변경되었습니다.');
      completePasswordChange();
    } catch (changeError) {
      console.error('[PasswordChange] failed', changeError);
      setError('비밀번호 변경에 실패했습니다. 6자 이상으로 다시 입력해주세요.');
    }
  };

  const handleClose = async () => {
    if (closing) return;
    setClosing(true);
    try {
      await logout();
    } catch {
      setError('로그인 화면으로 돌아가지 못했습니다. 다시 시도해주세요.');
      setClosing(false);
    }
  };

  return (
    <Modal open title="비밀번호 변경" onClose={() => void handleClose()}>
      <p className="text-sm text-ink-soft pb-4">
        첫 로그인입니다. 안전한 사용을 위해 비밀번호를 변경해주세요.
      </p>
      <Input
        label="새 비밀번호"
        type="password"
        value={password}
        minLength={MIN_PASSWORD_LENGTH}
        onChange={(e) => {
          setPassword(e.target.value);
          setError('');
        }}
        placeholder="6자 이상 입력 (예: 000000)"
      />
      <Input
        label="새 비밀번호 확인"
        type="password"
        value={confirm}
        minLength={MIN_PASSWORD_LENGTH}
        onChange={(e) => {
          setConfirm(e.target.value);
          setError('');
        }}
        error={error}
        placeholder="다시 한번 입력"
      />
      <div className="pb-5">
        <Button fullWidth onClick={handleSubmit} disabled={closing}>
          변경하고 시작하기
        </Button>
      </div>
    </Modal>
  );
}
