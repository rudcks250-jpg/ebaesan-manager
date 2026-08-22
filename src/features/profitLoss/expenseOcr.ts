import type { Employee } from '@/data/types';

export type ExpenseCategory = '원가' | '인건비' | '고정비' | '광고비' | '공과금' | '기타비용' | '손익 제외' | '분류 확인 필요';
export type PayRule = 'actual' | 'withholding_3_3' | 'review';

export interface ExpenseRule {
  keyword: string;
  category: ExpenseCategory;
  payRule?: PayRule;
}

export interface ParsedExpense {
  id: string;
  date: string;
  counterparty: string;
  actualAmount: number;
  category: ExpenseCategory;
  payRule: PayRule;
  appliedAmount: number;
  withholdingAmount: number;
  confidence: number;
  needsReview: boolean;
  duplicate: boolean;
  selected: boolean;
  rawText: string;
  memo: string;
  fingerprint: string;
}

const RULES_KEY = 'ebaesan_expense_rules_v1';
const HISTORY_KEY = 'ebaesan_expense_import_history_v1';

const compact = (value: string) => value.replace(/\s+/g, '').toLowerCase();
const fingerprint = (date: string, amount: number, name: string) => `${date}|${amount}|${compact(name)}`;

export function loadExpenseRules(): ExpenseRule[] {
  try { return JSON.parse(localStorage.getItem(RULES_KEY) ?? '[]') as ExpenseRule[]; } catch { return []; }
}

export function saveExpenseRules(rules: ExpenseRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

export function loadAppliedFingerprints(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[]; } catch { return []; }
}

export function rememberAppliedFingerprints(values: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([...new Set([...loadAppliedFingerprints(), ...values])].slice(-3000)));
}

function toLocalDate(raw: string): string {
  const match = raw.match(/(20\d{2})[./-]\s*(\d{1,2})[./-]\s*(\d{1,2})/) ?? raw.match(/(\d{1,2})[./-]\s*(\d{1,2})/);
  if (!match) return '';
  const year = match.length === 4 ? Number(match[1]) : new Date().getFullYear();
  const month = Number(match.length === 4 ? match[2] : match[1]);
  const day = Number(match.length === 4 ? match[3] : match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function amountFrom(line: string): number {
  const withdrawal = line.match(/(?:출금|지급|보낸금액|이체출금)\s*[:：]?\s*-?\s*([\d,]{2,})/);
  const negative = line.match(/-\s*([\d,]{2,})\s*원?/);
  const source = withdrawal?.[1] ?? negative?.[1];
  return source ? Number(source.replace(/,/g, '')) : 0;
}

function counterpartyFrom(line: string): string {
  return line
    .replace(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/g, ' ')
    .replace(/\d{1,2}:\d{2}(?::\d{2})?/g, ' ')
    .replace(/(?:출금|입금|지급|보낸금액|이체출금|잔액|거래후잔액|원)/g, ' ')
    .replace(/-?\s*[\d,]{2,}/g, ' ')
    .replace(/[^가-힣A-Za-z0-9㈜()\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export function recommendExpense(name: string, employees: Employee[], rules: ExpenseRule[]) {
  const normalized = compact(name);
  const learned = rules.find((rule) => normalized.includes(compact(rule.keyword)));
  if (learned) return { category: learned.category, payRule: learned.payRule ?? 'review' };
  if (/박경찬|대표자|가지급|개인지출|개인인출/.test(name)) return { category: '손익 제외' as const, payRule: 'review' as const };
  const employee = employees.find((item) => compact(item.name) === normalized);
  if (employee) {
    if (['김하은', '김경재'].includes(employee.name)) return { category: '인건비' as const, payRule: 'actual' as const };
    return { category: '인건비' as const, payRule: 'withholding_3_3' as const };
  }
  if (/좋은축산|지우푸드|축산|식자재/.test(name)) return { category: '원가' as const, payRule: 'review' as const };
  if (/쿠팡/.test(name)) return { category: '기타비용' as const, payRule: 'review' as const };
  if (/임대료|월세|보안/.test(name)) return { category: '고정비' as const, payRule: 'review' as const };
  if (/전기|가스|수도|인터넷/.test(name)) return { category: '공과금' as const, payRule: 'review' as const };
  if (/네이버|메타|인스타|광고/.test(name)) return { category: '광고비' as const, payRule: 'review' as const };
  return { category: '분류 확인 필요' as const, payRule: 'review' as const };
}

export function recalculateExpense(item: ParsedExpense): ParsedExpense {
  const gross = item.category === '인건비' && item.payRule === 'withholding_3_3'
    ? Math.round(item.actualAmount / 0.967)
    : item.actualAmount;
  return { ...item, appliedAmount: gross, withholdingAmount: Math.max(0, gross - item.actualAmount) };
}

export async function recognizeExpenseImages(
  files: File[],
  employees: Employee[],
  rules: ExpenseRule[],
  onProgress: (progress: number, fileName: string) => void,
): Promise<ParsedExpense[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng'], 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress(message.progress, files[0]?.name ?? '이미지');
    },
  });
  const output: ParsedExpense[] = [];
  const seen = new Set(loadAppliedFingerprints());
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const result = await worker.recognize(file);
      onProgress(1, file.name);
      const lines = result.data.text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
        const line = lines[lineIndex];
        if (/입금/.test(line) && !/출금/.test(line)) continue;
        if (!/(출금|지급|보낸금액|이체출금)|-\s*[\d,]{2,}/.test(line)) continue;
        // 은행 앱마다 날짜/금액/적요가 여러 줄로 나뉘므로 날짜 경계를 넘지 않는 범위만 거래 블록으로 읽습니다.
        const hasDate = Boolean(toLocalDate(line));
        let blockStart = lineIndex;
        if (!hasDate) {
          for (let cursor = lineIndex - 1; cursor >= Math.max(0, lineIndex - 2); cursor -= 1) {
            blockStart = cursor;
            if (toLocalDate(lines[cursor])) break;
          }
        }
        let blockEnd = lineIndex + 1;
        while (blockEnd < Math.min(lines.length, lineIndex + 3) && !toLocalDate(lines[blockEnd])) blockEnd += 1;
        const block = lines.slice(blockStart, blockEnd).join(' ');
        const date = toLocalDate(block);
        const actualAmount = amountFrom(line) || amountFrom(block);
        const counterparty = counterpartyFrom(block);
        if (!actualAmount) continue;
        const recommendation = recommendExpense(counterparty, employees, rules);
        const fp = fingerprint(date, actualAmount, counterparty);
        const normalizedName = compact(counterparty);
        const duplicate = seen.has(fp) || output.some((item) => {
          const previousName = compact(item.counterparty);
          return item.date === date && item.actualAmount === actualAmount
            && (previousName === normalizedName || previousName.includes(normalizedName) || normalizedName.includes(previousName));
        });
        const confidence = Number(result.data.confidence || 0);
        const needsReview = !date || !counterparty || confidence < 70 || recommendation.category === '분류 확인 필요';
        const item = recalculateExpense({
          id: `${Date.now()}-${index}-${lineIndex}`,
          date,
          counterparty,
          actualAmount,
          category: recommendation.category,
          payRule: recommendation.payRule,
          appliedAmount: actualAmount,
          withholdingAmount: 0,
          confidence,
          needsReview,
          duplicate,
          selected: !duplicate && !needsReview,
          rawText: block,
          memo: '',
          fingerprint: fp,
        });
        output.push(item);
        seen.add(fp);
      }
    }
  } finally {
    await worker.terminate();
  }
  return output;
}

export function refreshFingerprint(item: ParsedExpense): ParsedExpense {
  return { ...item, fingerprint: fingerprint(item.date, item.actualAmount, item.counterparty) };
}
