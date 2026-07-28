import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [idFocused, setIdFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const compact = idFocused || passFocused;

  const triggerShake = () => {
    setShake(true);
    window.setTimeout(() => setShake(false), 420);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !password) {
      setError('아이디와 비밀번호를 입력해주세요.');
      triggerShake();
      return;
    }

    const result = await login(name.trim(), password);
    if (!result.success) {
      setError(result.errorMessage ?? '로그인에 실패했습니다.');
      triggerShake();
      return;
    }
    // 첫 로그인 비밀번호 변경 모달은 App 최상위에서 전역으로 표시되므로
    // 여기서는 항상 대시보드로 이동만 하면 됩니다.
    navigate('/dashboard');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center px-6 pt-14 pb-10"
      style={{
        background: 'radial-gradient(100% 60% at 50% 0%, #EAF3FF 0%, #F5F5F7 52%, #F2F2F7 100%)',
      }}
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* 헤더: 로고 + 타이틀 + 서브타이틀 */}
        <div className="flex flex-col items-center text-center transition-all duration-[380ms] ease-[cubic-bezier(.4,0,.2,1)]">
          <div
            className="flex items-center justify-center transition-all duration-[380ms] ease-[cubic-bezier(.4,0,.2,1)]"
            style={{
              width: compact ? 60 : 104,
              height: compact ? 60 : 104,
              borderRadius: compact ? 18 : 30,
              background: 'linear-gradient(160deg,#38A0FF 0%,#007AFF 55%,#0066D6 100%)',
              boxShadow: '0 4px 10px rgba(0,122,255,.22), 0 18px 36px -10px rgba(0,122,255,.48)',
              marginBottom: compact ? 12 : 20,
            }}
          >
            <svg width={compact ? 26 : 42} height={compact ? 26 : 42} viewBox="0 0 24 24" fill="none" style={{ transition: 'all .38s' }}>
              <path
                d="M12 2c1 3-3 4-3 7.5a3 3 0 006 0c0-1.2-.6-2-1-2.8 2 1 3.5 3.3 3.5 5.8a5.5 5.5 0 11-11 0C6.5 8 9 5.4 12 2z"
                fill="#FFF3EC"
              />
            </svg>
          </div>
          <p
            className="font-extrabold transition-all duration-[380ms]"
            style={{ fontSize: compact ? 20 : 30, color: '#111111', letterSpacing: '-0.8px' }}
          >
            이배산 숯불구이
          </p>
          <p
            className="font-semibold overflow-hidden transition-all duration-[380ms]"
            style={{
              fontSize: 15,
              color: '#6E6E73',
              opacity: compact ? 0 : 1,
              maxHeight: compact ? 0 : 24,
              marginTop: compact ? 0 : 6,
            }}
          >
            직원 전용 근태 · 급여 시스템
          </p>
        </div>

        {/* 로그인 카드 */}
        <form
          onSubmit={handleSubmit}
          className={`w-full bg-white mt-7 ${shake ? 'animate-[shakeX_0.4s]' : ''}`}
          style={{
            borderRadius: 28,
            padding: '30px 24px 26px',
            boxShadow: '0 2px 4px rgba(0,0,0,.03), 0 24px 54px -22px rgba(0,0,0,.22)',
            border: '1px solid rgba(0,0,0,.05)',
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <p className="font-extrabold" style={{ fontSize: 19, color: '#2B2320' }}>
              로그인
            </p>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setGuideOpen((v) => !v)}
              aria-label="계정 안내 보기"
              className="flex items-center justify-center press-scale"
              style={{ width: 30, height: 30, borderRadius: '50%', background: '#F5EEE4', color: '#B08E7A' }}
            >
              <span className="text-sm font-bold">?</span>
            </button>
          </div>

          {/* 아이디 */}
          <label className="block mb-4">
            <span
              className="block font-bold mb-2 transition-colors"
              style={{ fontSize: 13, color: idFocused ? '#C7442E' : '#8A7F73' }}
            >
              아이디
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIdFocused(true)}
              onBlur={() => setIdFocused(false)}
              placeholder="이름을 입력해주세요"
              autoComplete="username"
              className="w-full outline-none transition-all"
              style={{
                height: 54,
                borderRadius: 17,
                padding: '0 18px',
                fontSize: 16,
                color: '#2B2320',
                border: idFocused ? '1.5px solid #C7442E' : '1.5px solid #EFE4D6',
                background: idFocused ? '#FFFFFF' : '#FBF8F3',
                boxShadow: idFocused ? '0 0 0 4px rgba(199,68,46,.10)' : 'none',
              }}
            />
          </label>

          {/* 비밀번호 */}
          <label className="block mb-1">
            <span
              className="block font-bold mb-2 transition-colors"
              style={{ fontSize: 13, color: passFocused ? '#C7442E' : '#8A7F73' }}
            >
              비밀번호
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
                placeholder="비밀번호를 입력해주세요"
                autoComplete="current-password"
                className="w-full outline-none transition-all"
                style={{
                  height: 54,
                  borderRadius: 17,
                  padding: '0 48px 0 18px',
                  fontSize: 16,
                  color: '#2B2320',
                  border: passFocused ? '1.5px solid #C7442E' : '1.5px solid #EFE4D6',
                  background: passFocused ? '#FFFFFF' : '#FBF8F3',
                  boxShadow: passFocused ? '0 0 0 4px rgba(199,68,46,.10)' : 'none',
                }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: '#9A8F84' }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 3l18 18M9.9 5.1A10.6 10.6 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.1M6.5 6.6C4 8.3 2 12 2 12s3.6 7 10 7c1.4 0 2.6-.3 3.7-.8M9.9 9.9a3 3 0 004.2 4.2"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="1.6" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="font-bold mt-2 mb-1" style={{ fontSize: 12.5, color: '#C7442E' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full text-white font-bold press-scale mt-4"
            style={{
              height: 58,
              borderRadius: 19,
              fontSize: 17,
              background: '#007AFF',
              boxShadow: '0 4px 10px rgba(0,122,255,.25), 0 18px 30px -10px rgba(0,122,255,.5)',
            }}
          >
            로그인
          </button>

          {/* 계정 안내 - 접이식 바 */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setGuideOpen((v) => !v)}
            className="w-full flex items-center justify-between mt-4 press-scale"
            style={{ background: '#F3ECE0', borderRadius: 20, padding: '12px 16px' }}
          >
            <span className="flex items-center gap-2">
              <span
                className="flex items-center justify-center font-bold text-xs"
                style={{ width: 22, height: 22, borderRadius: '50%', background: '#E6DBC9', color: '#9A8567' }}
              >
                ?
              </span>
              <span className="font-semibold text-sm" style={{ color: '#6B5A47' }}>
                계정 안내
              </span>
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              style={{ transform: `rotate(${guideOpen ? 180 : 0}deg)`, transition: 'transform .25s ease' }}
            >
              <path d="M6 9l6 6 6-6" stroke="#9A8567" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {guideOpen && (
            <div className="mt-2.5 px-4 py-3 text-xs leading-relaxed" style={{ color: '#8A7F73' }}>
              <p className="font-semibold mb-1" style={{ color: '#2B2320' }}>
                직원 로그인
              </p>
              <p>• 아이디 : 본인 이름</p>
              <p>• 초기 비밀번호 : 등록된 개인번호</p>
              <p>• 첫 로그인 시 반드시 비밀번호를 변경해야 합니다.</p>
            </div>
          )}
        </form>

        <p className="mt-6 text-center" style={{ fontSize: 12, color: '#C2B3A3' }}>
          이배산 숯불구이 근로자를 위한 공간
        </p>
      </div>
    </div>
  );
}
