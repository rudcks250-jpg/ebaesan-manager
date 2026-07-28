// @ts-nocheck - Supabase Edge Functions의 Deno 런타임에서 실행됩니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  createEmployeeAuthAccount,
  normalizeEmployeeName,
  normalizePhone,
  validateEmployeeCredentials,
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

  let createdAuthUserId: string | undefined;
  let rollbackClient: ReturnType<typeof createClient> | undefined;

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
    rollbackClient = adminClient;
    const { data: callerEmployee, error: roleError } = await adminClient
      .from('employees')
      .select('role')
      .eq('auth_user_id', caller.id)
      .maybeSingle();
    if (roleError) return json({ error: '관리자 권한을 확인하지 못했습니다.' }, 500);
    if (callerEmployee?.role !== 'admin') {
      return json({ error: '관리자만 직원을 등록할 수 있습니다.' }, 403);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: '요청 정보가 올바르지 않습니다.' }, 400);
    }

    const name = normalizeEmployeeName(body.name);
    const phone = normalizePhone(body.phone);
    const position = typeof body.position === 'string' ? body.position.trim() : '';
    const wageType = body.wageType === 'hourly' || body.wageType === 'monthly' ? body.wageType : '';
    const hireDate = typeof body.hireDate === 'string' ? body.hireDate : '';
    const payday = typeof body.payday === 'string' && body.payday.trim() ? body.payday.trim() : null;
    const hourlyWage = Number(body.hourlyWage);
    const monthlySalary = Number(body.monthlySalary);

    if (!name || !position || !wageType || !hireDate) {
      return json({ error: '필수 항목이 누락되었습니다.' }, 400);
    }
    const credentialError = validateEmployeeCredentials(name, phone);
    if (credentialError) return json({ error: credentialError }, 400);
    if (
      (wageType === 'hourly' && (!Number.isFinite(hourlyWage) || hourlyWage <= 0)) ||
      (wageType === 'monthly' && (!Number.isFinite(monthlySalary) || monthlySalary <= 0))
    ) {
      return json({ error: '급여 금액이 올바르지 않습니다.' }, 400);
    }

    const { data: duplicate, error: duplicateError } = await adminClient
      .from('employees')
      .select('id')
      .ilike('name', name)
      .limit(1)
      .maybeSingle();
    if (duplicateError) return json({ error: '직원 중복 여부를 확인하지 못했습니다.' }, 500);
    if (duplicate) return json({ error: '이미 존재하는 직원입니다.' }, 409);

    const account = await createEmployeeAuthAccount(adminClient, name, phone);
    if (!account.success) {
      return json({ error: account.error }, account.alreadyExists ? 409 : 500);
    }
    createdAuthUserId = account.userId;

    const { data: employee, error: insertError } = await adminClient
      .from('employees')
      .insert({
        auth_user_id: createdAuthUserId,
        login_email: account.loginEmail,
        name,
        phone,
        role: 'employee',
        position,
        wage_type: wageType,
        hourly_wage: wageType === 'hourly' ? hourlyWage : null,
        monthly_salary: wageType === 'monthly' ? monthlySalary : null,
        payday,
        status: 'active',
        hire_date: hireDate,
        is_first_login: true,
      })
      .select()
      .single();

    if (insertError) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(createdAuthUserId);
      createdAuthUserId = undefined;
      if (rollbackError) {
        return json({ error: '직원 생성에 실패했으며 생성된 계정 정리가 필요합니다.' }, 500);
      }
      const duplicate = insertError.code === '23505';
      return json({ error: duplicate ? '이미 존재하는 직원입니다.' : '직원 정보 생성 실패' }, duplicate ? 409 : 500);
    }

    return json({ employee }, 201);
  } catch (error) {
    if (createdAuthUserId && rollbackClient) {
      await rollbackClient.auth.admin.deleteUser(createdAuthUserId);
    }
    return json(
      { error: error instanceof Error ? error.message : '직원과 계정 생성 중 오류가 발생했습니다.' },
      500,
    );
  }
});
