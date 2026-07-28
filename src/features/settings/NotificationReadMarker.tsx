import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';

export function NotificationReadMarker() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    const url = new URL(window.location.href);
    const jobId = url.searchParams.get('notificationJob');
    if (!jobId) return;
    void (async () => {
      try {
        await supabase.rpc('mark_notification_read', { p_job_id: jobId });
      } finally {
        url.searchParams.delete('notificationJob');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    })();
  }, [session]);

  return null;
}
