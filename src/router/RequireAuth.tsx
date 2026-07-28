import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canAccess, type FeatureKey } from '@/utils/permission';

export function RequireAuth({
  feature,
  children,
}: {
  feature: FeatureKey;
  children: ReactNode;
}) {
  const { session, sessionLoading } = useAuth();

  if (sessionLoading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (!canAccess(session.role, feature)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
