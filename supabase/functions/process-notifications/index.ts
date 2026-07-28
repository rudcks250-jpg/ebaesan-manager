// @ts-nocheck - Supabase Edge Functions의 Deno 런타임에서 실행됩니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const preferenceColumn: Record<string, string> = {
  schedule: 'schedule_enabled',
  notice: 'notice_enabled',
  worktime: 'worktime_enabled',
  leave_reminder: 'leave_reminder_enabled',
  leave_result: 'leave_result_enabled',
  payroll: 'payroll_enabled',
  order: 'order_enabled',
  leave_request_admin: 'leave_request_admin_enabled',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function base64Url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToBytes(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

async function firebaseAccessToken(serviceAccount: Record<string, string>) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(`${header}.${claim}`),
  );
  const assertion = `${header}.${claim}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch(serviceAccount.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`Firebase OAuth 실패 (${response.status})`);
  return (await response.json()).access_token as string;
}

async function sendFcm(
  serviceAccount: Record<string, string>,
  accessToken: string,
  token: string,
  job: any,
) {
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token,
          data: {
            title: job.title,
            body: job.body,
            link: job.link,
            kind: job.kind,
            jobId: job.id,
          },
          webpush: {
            headers: { Urgency: 'high' },
            fcm_options: { link: new URL(job.link, 'https://ebaesan-manager.vercel.app').href },
          },
        },
      }),
    },
  );
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result?.error?.message || `FCM 발송 실패 (${response.status})`);
    (error as any).status = response.status;
    throw error;
  }
  return result.name as string;
}

function kstParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    weekday: value('weekday'),
  };
}

function addCalendarDays(date: string, days: number) {
  const parsed = new Date(`${date}T12:00:00+09:00`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(parsed);
}

function isPayday(payday: string | null, date: string) {
  if (!payday) return false;
  const parsed = new Date(`${date}T12:00:00+09:00`);
  const day = Number(date.slice(8, 10));
  if (payday.includes('말일')) {
    const tomorrow = new Date(parsed);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow.getUTCMonth() !== parsed.getUTCMonth();
  }
  if (payday.includes('매주')) {
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return labels.some((label, index) => payday.includes(label) && parsed.getUTCDay() === index);
  }
  const match = payday.match(/(\d+)/);
  return !!match && day === Number(match[1]);
}

async function enqueueScheduled(admin: any) {
  const kst = kstParts();
  if (kst.minute !== 0) return;

  if (kst.hour === 22) {
    const [{ data: schedules }, { data: attendance }] = await Promise.all([
      admin.from('schedules').select('employee_id').eq('date', kst.date).eq('status', 'working'),
      admin.from('attendance').select('employee_id').eq('date', kst.date),
    ]);
    const entered = new Set((attendance ?? []).map((row: any) => row.employee_id));
    for (const shift of schedules ?? []) {
      if (entered.has(shift.employee_id)) continue;
      await admin.rpc('enqueue_notification', {
        p_event_key: `worktime:${kst.date}:${shift.employee_id}`,
        p_kind: 'worktime',
        p_title: '⏰ 오늘 근무시간을 입력해주세요.',
        p_body: '오늘 근무시간이 아직 입력되지 않았습니다.',
        p_link: '/worktime',
        p_employee_id: shift.employee_id,
      });
    }
  }

  if (kst.weekday === 'Tue' && kst.hour === 20) {
    const { data: staff } = await admin.from('employees').select('id').eq('role', 'staff').eq('status', 'active');
    for (const employee of staff ?? []) {
      await admin.rpc('enqueue_notification', {
        p_event_key: `leave_reminder:${kst.date}:${employee.id}`,
        p_kind: 'leave_reminder',
        p_title: '📅 다음 주 휴무 신청 기간입니다.',
        p_body: '원하는 휴무를 신청해주세요.',
        p_link: '/leave',
        p_employee_id: employee.id,
      });
    }
  }

  if (kst.hour === 21) {
    const { data: admins } = await admin.from('employees').select('id').eq('role', 'admin').eq('status', 'active');
    for (const employee of admins ?? []) {
      await admin.rpc('enqueue_notification', {
        p_event_key: `order:${kst.date}:${employee.id}`,
        p_kind: 'order',
        p_title: '📦 오늘 발주를 확인해주세요.',
        p_body: '발주관리 화면에서 오늘 발주를 확인해주세요.',
        p_link: '/order',
        p_employee_id: employee.id,
      });
    }
  }

  if (kst.hour === 10) {
    const tomorrow = addCalendarDays(kst.date, 1);
    const { data: staff } = await admin
      .from('employees')
      .select('id,payday')
      .eq('role', 'staff')
      .eq('status', 'active');
    for (const employee of staff ?? []) {
      const todayPayday = isPayday(employee.payday, kst.date);
      const tomorrowPayday = isPayday(employee.payday, tomorrow);
      if (!todayPayday && !tomorrowPayday) continue;
      await admin.rpc('enqueue_notification', {
        p_event_key: `payroll:${todayPayday ? 'today' : 'd1'}:${kst.date}:${employee.id}`,
        p_kind: 'payroll',
        p_title: todayPayday ? '💰 오늘은 급여일입니다.' : '💰 내일은 급여일입니다.',
        p_body: '급여 정보를 앱에서 확인할 수 있습니다.',
        p_link: '/dashboard',
        p_employee_id: employee.id,
      });
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST 요청만 허용됩니다.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) return json({ error: 'Supabase 서버 설정이 없습니다.' }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const isCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret;
    if (!isCron) {
      const caller = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) return json({ error: '인증이 필요합니다.' }, 401);
    } else {
      await enqueueScheduled(admin);
    }

    const firebaseJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');
    const serviceAccount = firebaseJson ? JSON.parse(firebaseJson) : null;
    const webPushPublic = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY');
    const webPushPrivate = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
    const webPushSubject = Deno.env.get('WEB_PUSH_SUBJECT') || 'mailto:admin@ebaesan.local';
    if (webPushPublic && webPushPrivate) {
      webpush.setVapidDetails(webPushSubject, webPushPublic, webPushPrivate);
    }
    const fcmAccessToken = serviceAccount ? await firebaseAccessToken(serviceAccount) : null;

    const { data: jobs, error: jobsError } = await admin
      .from('notification_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('created_at')
      .limit(100);
    if (jobsError) throw jobsError;

    let sent = 0;
    let failed = 0;
    for (const job of jobs ?? []) {
      await admin.from('notification_jobs').update({ status: 'processing' }).eq('id', job.id).eq('status', 'pending');
      let employeeIds: string[] = [];
      if (job.recipient_employee_id) {
        employeeIds = [job.recipient_employee_id];
      } else if (job.recipient_role) {
        const { data } = await admin.from('employees').select('id').eq('role', job.recipient_role).eq('status', 'active');
        employeeIds = (data ?? []).map((row: any) => row.id);
      }

      const { data: subscriptions } = await admin
        .from('push_subscriptions')
        .select('*')
        .in('employee_id', employeeIds)
        .eq('active', true);
      const authUserIds = [...new Set((subscriptions ?? []).map((row: any) => row.auth_user_id))];
      const { data: preferences } = authUserIds.length
        ? await admin.from('notification_preferences').select('*').in('auth_user_id', authUserIds)
        : { data: [] };
      const preferenceByUser = new Map((preferences ?? []).map((row: any) => [row.auth_user_id, row]));

      for (const subscription of subscriptions ?? []) {
        const preference = preferenceByUser.get(subscription.auth_user_id);
        const column = preferenceColumn[job.kind];
        if (column && preference?.[column] === false) continue;

        const { data: existing } = await admin
          .from('notification_deliveries')
          .select('id')
          .eq('job_id', job.id)
          .eq('subscription_id', subscription.id)
          .maybeSingle();
        if (existing) continue;

        try {
          let providerMessageId: string | undefined;
          if (subscription.channel === 'fcm') {
            if (!serviceAccount || !fcmAccessToken || !subscription.token) throw new Error('FCM 서버 환경변수가 없습니다.');
            providerMessageId = await sendFcm(serviceAccount, fcmAccessToken, subscription.token, job);
          } else {
            if (!webPushPublic || !webPushPrivate || !subscription.endpoint) throw new Error('표준 Web Push VAPID 환경변수가 없습니다.');
            const result = await webpush.sendNotification({
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            }, JSON.stringify({
              title: job.title, body: job.body, link: job.link, kind: job.kind, jobId: job.id,
            }));
            providerMessageId = result?.headers?.location;
          }
          await admin.from('notification_deliveries').insert({
            job_id: job.id, subscription_id: subscription.id, status: 'sent',
            provider_message_id: providerMessageId,
          });
          sent += 1;
        } catch (error) {
          const status = Number((error as any)?.statusCode || (error as any)?.status);
          if (status === 404 || status === 410) {
            await admin.from('push_subscriptions').update({ active: false }).eq('id', subscription.id);
          }
          await admin.from('notification_deliveries').insert({
            job_id: job.id, subscription_id: subscription.id, status: 'failed',
            error_message: error instanceof Error ? error.message : String(error),
          });
          failed += 1;
        }
      }
      await admin.from('notification_jobs').update({
        status: 'sent', processed_at: new Date().toISOString(), last_error: null,
      }).eq('id', job.id);
    }
    return json({ jobs: jobs?.length ?? 0, sent, failed, configured: {
      fcm: !!serviceAccount,
      webPush: !!(webPushPublic && webPushPrivate),
    } });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '알림 처리 실패' }, 500);
  }
});
