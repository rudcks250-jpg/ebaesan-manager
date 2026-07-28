// supabase/functions/reset-employee-password/index.ts
//
// 배포: supabase functions deploy reset-employee-password
// 관리자가 "비밀번호 초기화" 버튼을 누르면 클라이언트가 이 함수를 호출합니다.

// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerEmployee } = await adminClient
      .from('employees')
      .select('role')
      .eq('auth_user_id', caller.id)
      .single();
    if (!callerEmployee || callerEmployee.role !== 'admin') {
      return new Response(JSON.stringify({ error: '관리자만 초기화할 수 있습니다.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { employeeId } = await req.json();
    const { data: target } = await adminClient
      .from('employees')
      .select('id, auth_user_id, phone')
      .eq('id', employeeId)
      .single();

    if (!target?.auth_user_id) {
      return new Response(JSON.stringify({ error: '대상 직원을 찾을 수 없습니다.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminClient.auth.admin.updateUserById(target.auth_user_id, { password: target.phone });
    await adminClient.from('employees').update({ is_first_login: true }).eq('id', employeeId);

    return new Response(JSON.stringify({ success: true }), {
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
