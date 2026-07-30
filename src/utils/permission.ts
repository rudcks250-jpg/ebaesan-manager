import type { UserRole } from '@/data/types';

export type FeatureKey =
  | 'dashboard'
  | 'employee'
  | 'payroll'
  | 'schedule'
  | 'leave'
  | 'worktime'
  | 'order'
  | 'tomorrowPrep'
  | 'notices'
  | 'settings'
  | 'notifications';

// 기능별 접근 가능 역할. 이 테이블 하나로 라우트 가드 + 네비게이션 노출을 함께 제어합니다.
const FEATURE_ACCESS: Record<FeatureKey, UserRole[]> = {
  dashboard: ['admin', 'manager', 'employee'],
  employee: ['admin'],
  payroll: ['admin'],
  schedule: ['admin', 'manager', 'employee'],
  leave: ['admin', 'manager', 'employee'],
  worktime: ['admin', 'manager', 'employee'],
  order: ['admin', 'manager'],
  tomorrowPrep: ['admin', 'manager', 'employee'],
  notices: ['admin', 'manager', 'employee'],
  settings: ['admin', 'manager', 'employee'],
  notifications: ['admin'],
};

export function canAccess(role: UserRole | undefined, feature: FeatureKey): boolean {
  if (!role) return false;
  return FEATURE_ACCESS[feature].includes(role);
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin';
}

const TOMORROW_PREP_USERS = new Set(['박경찬', '김경재', '김하은']);

export function canAccessTomorrowPrep(name: string | undefined): boolean {
  return !!name && TOMORROW_PREP_USERS.has(name.trim());
}

const NOTICE_MANAGERS = new Set(['박경찬', '김경재', '김하은']);

export function canManageNotices(name: string | undefined): boolean {
  return !!name && NOTICE_MANAGERS.has(name.trim());
}
