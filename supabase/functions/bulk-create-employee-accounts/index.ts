// @ts-nocheck - Supabase Edge Functions의 Deno 런타임에서 실행됩니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEmployeeAuthAccount,
  normalizeEmployeeName,
  normalizePhone,
} from '../_shared/employee-account.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST 요청만 허용됩니다.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return json({ error: '서버 설정 오류로 계정을 생성할 수 없습니다.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return json({ error: '인증이 필요합니다.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerEmployee, error: roleError } = await adminClient
      .from('employees')
      .select('role')
      .eq('auth_user_id', caller.id)
      .maybeSingle();
    if (roleError) return json({ error: '관리자 권한을 확인하지 못했습니다.' }, 500);
    if (callerEmployee?.role !== 'admin') {
      return json({ error: '관리자만 기존 직원 계정을 생성할 수 있습니다.' }, 403);
    }

    const { data: employees, error: employeeError } = await adminClient
      .from('employees')
      .select('id, name, phone, auth_user_id, role')
      .order('name');
    if (employeeError) return json({ error: '직원 목록을 불러오지 못했습니다.' }, 500);

    let created = 0;
    let existing = 0;
    let failed = 0;
    const failures: Array<{ employeeId: string; name: string; reason: string }> = [];

    for (const employee of employees ?? []) {
      if (employee.auth_user_id) {
        existing += 1;
        continue;
      }

      const name = normalizeEmployeeName(employee.name);
      const phone = normalizePhone(employee.phone);
      const account = await createEmployeeAuthAccount(adminClient, name, phone);
      if (!account.success) {
        if (account.alreadyExists) existing += 1;
        else {
          failed += 1;
          failures.push({ employeeId: employee.id, name: name || '(이름 없음)', reason: account.error });
        }
        continue;
      }

      const { data: updated, error: updateError } = await adminClient
        .from('employees')
        .update({
          auth_user_id: account.userId,
          login_email: account.loginEmail,
          phone,
          is_first_login: employee.role !== 'admin',
        })
        .eq('id', employee.id)
        .is('auth_user_id', null)
        .select('id')
        .maybeSingle();

      if (updateError || !updated) {
        await adminClient.auth.admin.deleteUser(account.userId);
        failed += 1;
        failures.push({
          employeeId: employee.id,
          name,
          reason: updateError ? '직원 계정 연결 실패' : '다른 요청에서 이미 처리된 직원입니다.',
        });
        continue;
      }
      created += 1;
    }

    return json({
      success: true,
      total: employees?.length ?? 0,
      created,
      existing,
      failed,
      failures,
    }, 200);
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : '기존 직원 계정 생성 중 오류가 발생했습니다.' },
      500,
    );
  }
});
