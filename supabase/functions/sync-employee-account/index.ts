// 직원 이름/전화번호와 Supabase Auth 계정을 동기화합니다.
// 관리자 수정 모드와 기존 직원 로그인 복구 모드를 함께 지원합니다.

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEmployeeAuthAccount,
  employeeLoginEmail,
  normalizeEmployeeName,
  normalizePhone,
  validateEmployeeCredentials,
} from '../_shared/employee-account.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();

    if (body.mode === 'repair-login') {
      const name = normalizeEmployeeName(body.name);
      const phone = normalizePhone(body.password);
      const credentialError = validateEmployeeCredentials(name, phone);
      if (credentialError) return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 400);

      const { data: employees, error: findError } = await adminClient
        .from('employees')
        .select('id,name,phone,auth_user_id,status')
        .ilike('name', name);
      if (findError) return json({ error: '계정 확인에 실패했습니다.' }, 500);
      const employee = (employees ?? []).find((item) => normalizeEmployeeName(item.name) === name);
      if (!employee || employee.status !== 'active' || normalizePhone(employee.phone) !== phone) {
        return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, 401);
      }

      const loginEmail = await employeeLoginEmail(name);
      let authUserId = employee.auth_user_id;
      if (authUserId) {
        const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
          email: loginEmail,
          password: phone,
          email_confirm: true,
          user_metadata: { login_id: name, role: 'employee' },
        });
        if (error) return json({ error: '계정 동기화에 실패했습니다.' }, 500);
      } else {
        const account = await createEmployeeAuthAccount(adminClient, name, phone);
        if (!account.success) return json({ error: account.error }, 500);
        authUserId = account.userId;
      }

      const { error: updateError } = await adminClient.from('employees').update({
        auth_user_id: authUserId,
        login_email: loginEmail,
        phone,
      }).eq('id', employee.id);
      if (updateError) return json({ error: '직원 계정 연결에 실패했습니다.' }, 500);
      return json({ success: true });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: '인증이 필요합니다.' }, 401);

    const { data: callerEmployee } = await adminClient
      .from('employees')
      .select('role')
      .eq('auth_user_id', caller.id)
      .single();
    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return json({ error: '관리자만 직원 계정을 수정할 수 있습니다.' }, 403);
    }

    const name = normalizeEmployeeName(body.name);
    const phone = normalizePhone(body.phone);
    const credentialError = validateEmployeeCredentials(name, phone);
    if (credentialError) return json({ error: credentialError }, 400);

    const { data: employee, error: targetError } = await adminClient
      .from('employees')
      .select('id,auth_user_id')
      .eq('id', body.employeeId)
      .single();
    if (targetError || !employee) return json({ error: '대상 직원을 찾을 수 없습니다.' }, 404);

    const loginEmail = await employeeLoginEmail(name);
    let authUserId = employee.auth_user_id;
    if (authUserId) {
      const { error } = await adminClient.auth.admin.updateUserById(authUserId, {
        email: loginEmail,
        password: phone,
        email_confirm: true,
        user_metadata: { login_id: name },
      });
      if (error) return json({ error: '로그인 계정 수정에 실패했습니다.' }, 500);
    } else {
      const account = await createEmployeeAuthAccount(adminClient, name, phone);
      if (!account.success) return json({ error: account.error }, 500);
      authUserId = account.userId;
    }

    const { data: updated, error: updateError } = await adminClient
      .from('employees')
      .update({
        name,
        phone,
        auth_user_id: authUserId,
        login_email: loginEmail,
        is_first_login: true,
      })
      .eq('id', employee.id)
      .select()
      .single();
    if (updateError) return json({ error: '직원 정보 동기화에 실패했습니다.' }, 500);
    return json({ success: true, employee: updated });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
