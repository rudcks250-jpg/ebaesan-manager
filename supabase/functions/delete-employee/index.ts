// supabase/functions/delete-employee/index.ts
//
// 배포: supabase functions deploy delete-employee
//
// Supabase Auth 사용자 삭제에는 service role 권한이 필요하므로 서버에서만 실행합니다.
// 호출자의 JWT를 검증하고 employees.role이 admin인 경우에만 허용합니다.

// @ts-nocheck - Deno 런타임 전용 파일이라 브라우저용 tsconfig 검사 대상에서 제외합니다.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST 요청만 허용됩니다.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: '서버 환경변수가 올바르게 설정되지 않았습니다.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();

    if (callerError || !caller) {
      return jsonResponse({ error: '인증이 필요합니다.' }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerEmployee, error: callerEmployeeError } = await adminClient
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', caller.id)
      .maybeSingle();

    if (callerEmployeeError) {
      return jsonResponse({ error: '관리자 권한을 확인하지 못했습니다.' }, 500);
    }
    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return jsonResponse({ error: '관리자만 직원을 삭제할 수 있습니다.' }, 403);
    }

    let body: { employeeId?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: '요청 본문이 올바른 JSON 형식이 아닙니다.' }, 400);
    }

    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    if (!employeeId) {
      return jsonResponse({ error: '삭제할 직원 ID가 필요합니다.' }, 400);
    }
    if (employeeId === callerEmployee.id) {
      return jsonResponse({ error: '현재 로그인한 관리자 계정은 삭제할 수 없습니다.' }, 400);
    }

    const { data: employee, error: employeeError } = await adminClient
      .from('employees')
      .select('id, auth_user_id, name')
      .eq('id', employeeId)
      .maybeSingle();

    if (employeeError) {
      return jsonResponse({ error: '직원 정보를 조회하지 못했습니다.' }, 500);
    }
    if (!employee) {
      return jsonResponse({ error: '삭제할 직원을 찾을 수 없습니다.' }, 404);
    }

    if (employee.auth_user_id) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(employee.auth_user_id);
      if (authDeleteError) {
        return jsonResponse(
          { error: `직원 로그인 계정을 삭제하지 못했습니다: ${authDeleteError.message}` },
          500,
        );
      }
    }

    const { error: employeeDeleteError } = await adminClient
      .from('employees')
      .delete()
      .eq('id', employee.id);

    if (employeeDeleteError) {
      // Auth 사용자는 삭제 후 원래 비밀번호와 동일하게 안전하게 복구할 수 없습니다.
      // 데이터 행은 남아 있으므로 부분 실패를 명확히 알려 관리자가 재시도할 수 있게 합니다.
      return jsonResponse(
        {
          error:
            '로그인 계정은 삭제되었지만 직원 데이터 삭제에 실패했습니다. ' +
            `다시 삭제를 시도해주세요: ${employeeDeleteError.message}`,
          partialFailure: true,
        },
        500,
      );
    }

    return jsonResponse({ success: true, employeeId: employee.id }, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : '직원 삭제 중 알 수 없는 오류가 발생했습니다.' },
      500,
    );
  }
});
