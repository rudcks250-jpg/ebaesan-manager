// 날짜 관련 유틸 (주차 계산, 포맷팅)

export const WEEKDAY_LABELS_KO = ['월', '화', '수', '목', '금', '토', '일'];

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): string {
  return formatDate(new Date());
}

// 해당 날짜가 속한 주의 월요일을 반환
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0(일) ~ 6(토)
  const diff = day === 0 ? -6 : 1 - day; // 월요일까지 이동
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getMondayOfWeekStr(dateStr: string): string {
  return formatDate(getMondayOfWeek(parseDate(dateStr)));
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

// 월요일 기준 해당 주의 7일 날짜 문자열 배열 반환
export function getWeekDates(mondayStr: string): string[] {
  const monday = parseDate(mondayStr);
  return Array.from({ length: 7 }, (_, i) => formatDate(addDays(monday, i)));
}

export function getWeekdayLabel(dateStr: string): string {
  const day = parseDate(dateStr).getDay();
  return WEEKDAY_LABELS_KO[day === 0 ? 6 : day - 1];
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayStr();
}

// 이 프로젝트는 장기간 사용되므로 날짜 표시에는 항상 연도를 포함합니다.
// formatMonthDay는 여러 화면(대시보드/스케줄/휴무신청/근로시간)에서 공통으로
// 사용하는 표준 날짜 표기이며, 이 함수 하나만 바꾸면 전체 화면에 일괄 반영됩니다.
export function formatMonthDay(dateStr: string): string {
  const d = parseDate(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

// 스케줄 탭 상단처럼 한글로 길게 표기할 때 사용 ('2026년 7월 20일')
export function formatFullKoreanDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// 폭이 좁은 캘린더 헤더 등에서 '월.일'과 '연도'를 두 줄로 나눠 표시할 때 사용
export function splitMonthDayYear(dateStr: string): { monthDay: string; year: string } {
  const d = parseDate(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return { monthDay: `${m}.${day}`, year: String(d.getFullYear()) };
}

export function formatYearMonth(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function getMonthDates(year: number, month: number): string[] {
  // month: 1~12
  const lastDay = new Date(year, month, 0).getDate();
  return Array.from({ length: lastDay }, (_, i) =>
    formatDate(new Date(year, month - 1, i + 1))
  );
}

export function isSameWeek(dateStrA: string, dateStrB: string): boolean {
  return getMondayOfWeekStr(dateStrA) === getMondayOfWeekStr(dateStrB);
}

// 다음주 여부 판단 (휴무신청은 차주만 가능)
export function isNextWeek(dateStr: string): boolean {
  const thisMonday = getMondayOfWeek(new Date());
  const nextMonday = addWeeks(thisMonday, 1);
  const nextSunday = addDays(nextMonday, 6);
  const target = parseDate(dateStr);
  return target >= nextMonday && target <= nextSunday;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDateTimeKo(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${day} ${hh}:${mm}`;
}
