// 근무시간 계산 유틸 (자정을 넘기는 야간 근무 포함)

// "HH:mm" -> 하루 중 분(minute) 값
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * 실제 근무시간(분) = 퇴근 - 출근 - 휴게시간
 * 퇴근시간이 출근시간보다 이르면 익일로 넘어간 것으로 간주(+24시간)
 */
export function calcWorkedMinutes(
  clockIn: string,
  clockOut: string,
  breakMinutes: number
): number {
  let start = toMinutes(clockIn);
  let end = toMinutes(clockOut);
  if (end <= start) {
    end += 24 * 60; // 자정 넘김
  }
  const worked = end - start - breakMinutes;
  return Math.max(0, worked);
}

export function minutesToHourText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

export function minutesToCompactHourText(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '미입력';
  const hours = Number((minutes / 60).toFixed(2));
  return `${hours}시간`;
}

export function minutesToDecimalHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

// 출퇴근 시간 유효성 검증
export function validateClockTimes(
  clockIn: string,
  clockOut: string,
  breakMinutes: number
): string | null {
  if (!/^\d{2}:\d{2}$/.test(clockIn) || !/^\d{2}:\d{2}$/.test(clockOut)) {
    return '시간 형식이 올바르지 않습니다. (예: 09:00)';
  }
  if (breakMinutes < 0) {
    return '휴게시간은 0 이상이어야 합니다.';
  }
  const worked = calcWorkedMinutes(clockIn, clockOut, breakMinutes);
  if (worked <= 0) {
    return '휴게시간이 근무시간보다 깁니다. 시간을 다시 확인해주세요.';
  }
  if (worked > 20 * 60) {
    return '근무시간이 20시간을 초과합니다. 시간을 다시 확인해주세요.';
  }
  return null;
}

export function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
