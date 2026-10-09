const ACCESS_PASSWORD = '250011';

export function verifyProtectedAccess(password: string): boolean {
  return password === ACCESS_PASSWORD;
}
