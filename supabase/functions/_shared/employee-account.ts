// @ts-nocheck - Supabase Edge Functions의 Deno 런타임에서 사용합니다.

export function normalizeEmployeeName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function normalizePhone(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

export function validateEmployeeCredentials(name: string, phone: string): string | undefined {
  if (!name) return '직원 이름이 올바르지 않습니다.';
  if (!/^0\d{9,10}$/.test(phone)) return '전화번호가 올바르지 않습니다.';
  return undefined;
}

export async function employeeLoginEmail(normalizedName: string): Promise<string> {
  const bytes = new TextEncoder().encode(normalizedName.toLocaleLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
  return `employee-${hash}@ebaesan.local`;
}

export async function createEmployeeAuthAccount(
  adminClient: any,
  name: string,
  phone: string,
): Promise<
  | { success: true; userId: string; loginEmail: string }
  | { success: false; alreadyExists: boolean; error: string }
> {
  const validationError = validateEmployeeCredentials(name, phone);
  if (validationError) {
    return { success: false, alreadyExists: false, error: validationError };
  }

  const loginEmail = await employeeLoginEmail(name);
  const { data, error } = await adminClient.auth.admin.createUser({
    email: loginEmail,
    password: phone,
    email_confirm: true,
    user_metadata: { login_id: name, role: 'employee' },
    app_metadata: { role: 'employee' },
  });

  if (error || !data.user) {
    const alreadyExists = !!error?.message?.toLowerCase().includes('already');
    return {
      success: false,
      alreadyExists,
      error: alreadyExists ? '이미 존재하는 계정입니다.' : '계정 생성 실패',
    };
  }

  return { success: true, userId: data.user.id, loginEmail };
}
