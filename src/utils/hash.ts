// =========================================================
// 프로토타입용 간이 해시 함수
// -----------------------------------------------------------
// 주의: localStorage 프로토타입 단계의 임시 구현입니다.
// 실제 서비스 전환 시 authService.ts 내부만 교체하면 되도록
// 이 함수는 authService에서만 호출합니다. (컴포넌트에서 직접 호출 금지)
// =========================================================

export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `h${Math.abs(hash)}_${input.length}`;
}
