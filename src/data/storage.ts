// =========================================================
// localStorage 접근 계층 (프로토타입 전용 임시 저장소)
// -----------------------------------------------------------
// 이 파일만 window.localStorage 를 직접 다룹니다.
// UI 컴포넌트는 절대 이 파일을 직접 import 하지 않고,
// repositories/* 를 통해서만 접근합니다.
// 추후 Firebase/Supabase/REST API로 교체할 때는
// repositories 내부 구현만 바꾸면 됩니다.
// =========================================================

const NAMESPACE = 'ebaesan';

function buildKey(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(buildKey(key));
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[storage] get 실패: ${key}`, err);
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    try {
      window.localStorage.setItem(buildKey(key), JSON.stringify(value));
    } catch (err) {
      console.error(`[storage] set 실패: ${key}`, err);
    }
  },

  remove(key: string): void {
    try {
      window.localStorage.removeItem(buildKey(key));
    } catch (err) {
      console.error(`[storage] remove 실패: ${key}`, err);
    }
  },

  // 개발 모드 데이터가 초기화되었는지 여부를 표시하는 플래그 전용 헬퍼
  isSeeded(): boolean {
    return window.localStorage.getItem(buildKey('__seeded__')) === 'true';
  },

  markSeeded(): void {
    window.localStorage.setItem(buildKey('__seeded__'), 'true');
  },

  clearAll(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(`${NAMESPACE}:`)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  },
};

export const STORAGE_KEYS = {
  employees: 'employees',
  credentials: 'credentials',
  schedules: 'schedules',
  leaveRequests: 'leaveRequests',
  workTimeRecords: 'workTimeRecords',
  orderItems: 'orderItems',
  vendors: 'vendors',
  payrollSettlements: 'payrollSettlements',
  notices: 'notices',
  session: 'session',
} as const;
