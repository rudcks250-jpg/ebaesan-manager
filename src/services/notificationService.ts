import { supabase } from '@/lib/supabaseClient';

export interface NotificationPreferences {
  scheduleEnabled: boolean;
  noticeEnabled: boolean;
  worktimeEnabled: boolean;
  leaveReminderEnabled: boolean;
  leaveResultEnabled: boolean;
  payrollEnabled: boolean;
  orderEnabled: boolean;
  leaveRequestAdminEnabled: boolean;
}

export interface NotificationHistoryItem {
  id: string;
  kind: string;
  recipientEmployeeId?: string;
  title: string;
  body: string;
  link: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  scheduledFor: string;
  createdAt: string;
  attemptCount: number;
  lastError?: string;
  sentCount: number;
  failedCount: number;
  readCount: number;
}

const defaults: NotificationPreferences = {
  scheduleEnabled: true,
  noticeEnabled: true,
  worktimeEnabled: true,
  leaveReminderEnabled: true,
  leaveResultEnabled: true,
  payrollEnabled: true,
  orderEnabled: true,
  leaveRequestAdminEnabled: true,
};

const DEVICE_ID_KEY = 'ebaesan:push-device-id:v1';
const pushEnvironment = import.meta.env.VITE_PUSH_ENVIRONMENT
  ?? (import.meta.env.DEV ? 'development' : 'production');

function deviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function base64UrlToBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function rowToPreferences(row: Record<string, boolean> | null): NotificationPreferences {
  if (!row) return defaults;
  return {
    scheduleEnabled: row.schedule_enabled,
    noticeEnabled: row.notice_enabled,
    worktimeEnabled: row.worktime_enabled,
    leaveReminderEnabled: row.leave_reminder_enabled,
    leaveResultEnabled: row.leave_result_enabled,
    payrollEnabled: row.payroll_enabled,
    orderEnabled: row.order_enabled,
    leaveRequestAdminEnabled: row.leave_request_admin_enabled,
  };
}

function preferencesToRow(value: NotificationPreferences) {
  return {
    schedule_enabled: value.scheduleEnabled,
    notice_enabled: value.noticeEnabled,
    worktime_enabled: value.worktimeEnabled,
    leave_reminder_enabled: value.leaveReminderEnabled,
    leave_result_enabled: value.leaveResultEnabled,
    payroll_enabled: value.payrollEnabled,
    order_enabled: value.orderEnabled,
    leave_request_admin_enabled: value.leaveRequestAdminEnabled,
  };
}

async function currentIdentity(employeeId: string) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('로그인이 필요합니다.');
  return { authUserId: user.id, employeeId };
}

async function saveSubscription(input: {
  employeeId: string;
  channel: 'fcm' | 'web_push';
  subscriptionKey: string;
  token?: string;
  endpoint?: string;
  p256dh?: string;
  authKey?: string;
}) {
  const identity = await currentIdentity(input.employeeId);
  const currentDeviceId = deviceId();
  await supabase
    .from('push_subscriptions')
    .update({ active: false })
    .eq('auth_user_id', identity.authUserId)
    .eq('device_id', currentDeviceId)
    .eq('channel', input.channel)
    .eq('environment', pushEnvironment)
    .neq('subscription_key', input.subscriptionKey);
  const { error } = await supabase.from('push_subscriptions').upsert({
    auth_user_id: identity.authUserId,
    employee_id: identity.employeeId,
    device_id: currentDeviceId,
    environment: pushEnvironment,
    channel: input.channel,
    subscription_key: input.subscriptionKey,
    token: input.token ?? null,
    endpoint: input.endpoint ?? null,
    p256dh: input.p256dh ?? null,
    auth_key: input.authKey ?? null,
    platform: isIos() ? 'ios-pwa' : 'web',
    user_agent: navigator.userAgent,
    active: true,
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'auth_user_id,device_id,channel,environment' });
  if (error) throw error;
}

export const notificationService = {
  isConfigured() {
    const enabled = import.meta.env.VITE_PUSH_ENABLED === 'true';
    const fcmReady = Object.values(firebaseConfig).every(Boolean)
      && !!import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY;
    const webPushReady = !!import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY;
    return {
      enabled,
      fcmReady: enabled && fcmReady,
      webPushReady: enabled && webPushReady,
      ready: enabled && (isIos() ? webPushReady : fcmReady),
    };
  },

  permission() {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  },

  async enable(employeeId: string) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      throw new Error('이 기기에서는 웹 푸시 알림을 지원하지 않습니다.');
    }
    if (isIos() && !isStandalone()) {
      throw new Error('아이폰에서는 Safari 공유 메뉴에서 홈 화면에 추가한 뒤 알림을 허용해주세요.');
    }
    const configured = this.isConfigured();
    if (isIos() && !configured.webPushReady) {
      throw new Error('iPhone Web Push 공개키가 아직 설정되지 않았습니다.');
    }
    if (!isIos() && !configured.fcmReady) {
      throw new Error('Firebase Web Push 설정이 아직 완료되지 않았습니다.');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('알림 권한이 허용되지 않았습니다.');

    const registration = await navigator.serviceWorker.ready;
    if (isIos()) {
      const vapidKey = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY;
      const subscription = await registration.pushManager.getSubscription()
        ?? await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(vapidKey!),
        });
      const serialized = subscription.toJSON();
      await saveSubscription({
        employeeId,
        channel: 'web_push',
        subscriptionKey: subscription.endpoint,
        endpoint: subscription.endpoint,
        p256dh: serialized.keys?.p256dh,
        authKey: serialized.keys?.auth,
      });
      return 'iPhone Web Push 알림이 연결되었습니다.';
    }

    const [{ initializeApp, getApps }, { getMessaging, getToken, isSupported }] = await Promise.all([
      import('firebase/app'),
      import('firebase/messaging'),
    ]);
    if (!(await isSupported())) throw new Error('이 브라우저에서는 Firebase 알림을 지원하지 않습니다.');
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) throw new Error('FCM Push Token을 발급하지 못했습니다.');
    await saveSubscription({
      employeeId,
      channel: 'fcm',
      subscriptionKey: token,
      token,
    });
    return 'FCM 알림이 연결되었습니다.';
  },

  async refreshExisting(employeeId: string) {
    if (this.permission() !== 'granted' || !this.isConfigured().ready) return;
    await this.enable(employeeId);
  },

  async removeCurrentDevice() {
    if (!('serviceWorker' in navigator)) return;
    const currentDeviceId = deviceId();
    try {
      const registration = await navigator.serviceWorker.ready;
      if (isIos()) {
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      } else if (this.isConfigured().fcmReady) {
        const [{ initializeApp, getApps }, { deleteToken, getMessaging, isSupported }] = await Promise.all([
          import('firebase/app'),
          import('firebase/messaging'),
        ]);
        if (await isSupported()) {
          const app = getApps()[0] ?? initializeApp(firebaseConfig);
          await deleteToken(getMessaging(app));
        }
      }
    } finally {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('device_id', currentDeviceId)
        .eq('environment', pushEnvironment);
    }
  },

  async getPreferences(employeeId: string): Promise<NotificationPreferences> {
    const identity = await currentIdentity(employeeId);
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('auth_user_id', identity.authUserId)
      .maybeSingle();
    if (error) throw error;
    if (data) return rowToPreferences(data);
    const { data: created, error: createError } = await supabase
      .from('notification_preferences')
      .insert({
        auth_user_id: identity.authUserId,
        employee_id: identity.employeeId,
        ...preferencesToRow(defaults),
      })
      .select()
      .single();
    if (createError) throw createError;
    return rowToPreferences(created);
  },

  async savePreferences(employeeId: string, value: NotificationPreferences) {
    const identity = await currentIdentity(employeeId);
    const { error } = await supabase.from('notification_preferences').upsert({
      auth_user_id: identity.authUserId,
      employee_id: identity.employeeId,
      ...preferencesToRow(value),
    });
    if (error) throw error;
  },

  async publishSchedule(weekStart: string) {
    const { data, error } = await supabase.rpc('publish_schedule_notifications', {
      p_week_start: weekStart,
    });
    if (error) throw error;
    await this.dispatch();
    return Number(data ?? 0);
  },

  async sendTest() {
    const { error } = await supabase.rpc('enqueue_test_notification');
    if (error) throw error;
    return this.dispatch();
  },

  async dispatch() {
    const { data, error } = await supabase.functions.invoke('process-notifications', {
      body: { source: 'app' },
    });
    if (error) throw error;
    return data as { jobs: number; sent: number; failed: number };
  },

  async adminSend(input: {
    title: string;
    body: string;
    link: string;
    employeeId?: string;
    allStaff: boolean;
    scheduledFor: string;
    kind?: string;
  }) {
    const { data, error } = await supabase.rpc('admin_enqueue_notification', {
      p_title: input.title,
      p_body: input.body,
      p_link: input.link,
      p_employee_id: input.employeeId ?? null,
      p_all_staff: input.allStaff,
      p_scheduled_for: input.scheduledFor,
      p_kind: input.kind ?? 'admin_message',
    });
    if (error) throw error;
    if (new Date(input.scheduledFor).getTime() <= Date.now() + 30_000) await this.dispatch();
    return Number(data ?? 0);
  },

  async adminResend(jobId: string) {
    const { error } = await supabase.rpc('admin_resend_notification', { p_job_id: jobId });
    if (error) throw error;
    return this.dispatch();
  },

  async adminHistory(): Promise<NotificationHistoryItem[]> {
    const { data: jobs, error } = await supabase
      .from('notification_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const ids = (jobs ?? []).map((job) => job.id);
    const { data: deliveries, error: deliveryError } = ids.length
      ? await supabase.from('notification_deliveries').select('job_id,status,read_at').in('job_id', ids)
      : { data: [], error: null };
    if (deliveryError) throw deliveryError;
    return (jobs ?? []).map((job) => {
      const related = (deliveries ?? []).filter((delivery) => delivery.job_id === job.id);
      return {
        id: job.id,
        kind: job.kind,
        recipientEmployeeId: job.recipient_employee_id ?? undefined,
        title: job.title,
        body: job.body,
        link: job.link,
        status: job.status,
        scheduledFor: job.scheduled_for,
        createdAt: job.created_at,
        attemptCount: job.attempt_count ?? 0,
        lastError: job.last_error ?? undefined,
        sentCount: related.filter((delivery) => delivery.status === 'sent').length,
        failedCount: related.filter((delivery) => delivery.status === 'failed').length,
        readCount: related.filter((delivery) => !!delivery.read_at).length,
      };
    });
  },
};
