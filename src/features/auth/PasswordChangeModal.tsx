import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { authService } from '@/services/authService';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';

// 첫 로그인 시 어느 화면에 있든(라우트 이동과 무관하게) 표시되는
// 전역 비밀번호 변경 모달입니다. App.tsx 최상위에서 렌더링합니다.
export function PasswordChangeModal() {
  const { session, completePasswordChange } = useAuth();
  const { showToast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  if (!session) return null;

  const handleSubmit = async () => {
    if (password.length < 4) {
      setError('비밀번호는 4자 이상 입력해주세요.');
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
    } catch {
      setError('비밀번호 변경에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <Modal open title="비밀번호 변경" onClose={() => {}}>
      <p className="text-sm text-ink-soft pb-4">
        첫 로그인입니다. 안전한 사용을 위해 비밀번호를 변경해주세요.
      </p>
      <Input
        label="새 비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="4자 이상 입력"
      />
      <Input
        label="새 비밀번호 확인"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        error={error}
        placeholder="다시 한번 입력"
      />
      <div className="pb-5">
        <Button fullWidth onClick={handleSubmit}>
          변경하고 시작하기
        </Button>
      </div>
    </Modal>
  );
}
