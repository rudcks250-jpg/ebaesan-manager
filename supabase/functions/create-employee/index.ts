// supabase/functions/create-employee/index.ts
//
// 배포 방법 (Supabase CLI 설치 후, 이 프로젝트 루트에서):
//   supabase functions deploy create-employee
//
// 이 함수는 SERVICE ROLE KEY를 사용하므로 반드시 Edge Function(서버)에서만 실행되어야 하며,
// 절대로 프론트엔드(.env, VITE_ 변수 등)에 service role key를 넣지 마세요.
//
// 클라이언트에서는 supabase.functions.invoke('create-employee', { body: {...} }) 형태로 호출합니다.
// 호출자의 JWT를 검사해 실제로 관리자(role='admin')인 경우에만 동작합니다.

// @ts-nocheck - Deno 런타임 전용 파일이라 프로젝트의 tsconfig(브라우저용) 검사 대상에서 제외합니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';

    // 1) 호출자 신원 확인 (anon 클라이언트 + 호출자의 JWT로 "나는 누구인가" 확인)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) 관리자만 실행 가능 (service role로 employees 테이블에서 role 확인)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerEmployee } = await adminClient
      .from('employees')
      .select('role')
      .eq('auth_user_id', caller.id)
      .single();

    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return new Response(JSON.stringify({ error: '관리자만 직원을 등록할 수 있습니다.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) 요청 바디 파싱
    const body = await req.json();
    const { name, phone, position, wageType, hourlyWage, monthlySalary, payday, hireDate } = body;

    if (!name || !phone || !position || !wageType) {
      return new Response(JSON.stringify({ error: '필수 항목이 누락되었습니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const digits = String(phone).replace(/\D/g, '');
    const loginEmail = `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@ebaesan.local`;

    // 4) Auth 계정 생성 (초기 비밀번호 = 개인번호 그대로)
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email: loginEmail,
      password: digits,
      email_confirm: true,
    });

    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? '계정 생성에 실패했습니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5) employees 테이블 행 생성
    const { data: employee, error: insertErr } = await adminClient
      .from('employees')
      .insert({
        auth_user_id: created.user.id,
        login_email: loginEmail,
        name,
        phone: digits,
        role: 'staff',
        position,
        wage_type: wageType,
        hourly_wage: wageType === 'hourly' ? hourlyWage : null,
        monthly_salary: wageType === 'monthly' ? monthlySalary : null,
        payday: payday ?? null,
        status: 'active',
        hire_date: hireDate ?? new Date().toISOString().slice(0, 10),
        is_first_login: true,
      })
      .select()
      .single();

    if (insertErr) {
      // 롤백: employees insert 실패 시 방금 만든 auth 계정도 정리
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ employee }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
