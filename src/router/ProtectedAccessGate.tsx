import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/common/Button';
import { verifyProtectedAccess } from '@/utils/protectedAccess';

export function ProtectedAccessGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const employeeId = session?.employeeId ?? '';
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUnlocked(false);
    setPassword('');
    setError('');
  }, [employeeId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!employeeId || !verifyProtectedAccess(password)) {
      setError('비밀번호가 올바르지 않습니다.');
      setPassword('');
      return;
    }
    setError('');
    setUnlocked(true);
  };

  if (unlocked) return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-beige-light px-5 py-10">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-premium sm:p-8"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red-light text-brand-red">
          <LockKeyhole size={26} />
        </div>
        <h1 className="mt-5 text-center text-2xl font-bold text-ink">비밀번호 확인</h1>
        <p className="mt-2 text-center text-sm leading-6 text-ink-soft">
          보호된 메뉴입니다.<br />비밀번호를 입력해주세요.
        </p>

        <label className="mt-6 block text-sm font-semibold text-ink-soft" htmlFor="protected-access-password">
          비밀번호
        </label>
        <input
          id="protected-access-password"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => {
            setPassword(event.target.value.replace(/\D/g, ''));
            setError('');
          }}
          placeholder="비밀번호 6자리"
          maxLength={6}
          aria-invalid={!!error}
          aria-describedby={error ? 'protected-access-error' : undefined}
          className={`mt-2 h-14 w-full rounded-2xl border bg-brand-beige-light px-4 text-center text-xl font-bold tracking-[0.25em] text-ink outline-none transition-colors focus:border-brand-red ${
            error ? 'border-status-rejected' : 'border-transparent'
          }`}
        />
        {error && (
          <p id="protected-access-error" className="mt-2 text-center text-sm font-semibold text-status-rejected">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" className="mt-5" disabled={password.length !== 6}>
          확인
        </Button>
      </form>
    </main>
  );
}
