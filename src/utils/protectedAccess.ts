const ACCESS_PASSWORD = '250011';
const STORAGE_PREFIX = 'ebaesan:protected-access:';

function storageKey(employeeId: string): string {
  return `${STORAGE_PREFIX}${employeeId}`;
}

export function isProtectedAccessUnlocked(employeeId: string): boolean {
  try {
    return window.sessionStorage.getItem(storageKey(employeeId)) === 'true';
  } catch {
    return false;
  }
}

export function unlockProtectedAccess(employeeId: string, password: string): boolean {
  if (password !== ACCESS_PASSWORD) return false;

  try {
    window.sessionStorage.setItem(storageKey(employeeId), 'true');
  } catch {
    // sessionStorage를 사용할 수 없는 환경에서도 현재 화면 인증은 허용합니다.
  }
  return true;
}

export function clearProtectedAccess(employeeId?: string): void {
  try {
    if (employeeId) {
      window.sessionStorage.removeItem(storageKey(employeeId));
      return;
    }

    const keys: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // 저장소가 차단된 환경에서는 제거할 상태가 없습니다.
  }
}
