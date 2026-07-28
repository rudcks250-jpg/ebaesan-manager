import type { UserRole } from '@/data/types';

export type FeatureKey =
  | 'dashboard'
  | 'employee'
  | 'payroll'
  | 'schedule'
  | 'leave'
  | 'worktime'
  | 'order'
  | 'settings';

// 기능별 접근 가능 역할. 이 테이블 하나로 라우트 가드 + 네비게이션 노출을 함께 제어합니다.
const FEATURE_ACCESS: Record<FeatureKey, UserRole[]> = {
  dashboard: ['admin', 'staff'],
  employee: ['admin'],
  payroll: ['admin'],
  schedule: ['admin', 'staff'],
  leave: ['admin', 'staff'],
  worktime: ['admin', 'staff'],
  order: ['admin'], // 직원은 접근 비활성 (현재 정책)
  settings: ['admin', 'staff'],
};

export function canAccess(role: UserRole | undefined, feature: FeatureKey): boolean {
  if (!role) return false;
  return FEATURE_ACCESS[feature].includes(role);
}

export function isAdmin(role: UserRole | undefined): boolean {
  return role === 'admin';
}
