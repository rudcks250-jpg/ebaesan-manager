import { useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, FileImage, Settings2, Upload, X } from 'lucide-react';
import { Button } from '@/components/common/Button';
import type { Employee } from '@/data/types';
import {
  loadExpenseRules,
  recognizeExpenseImages,
  recalculateExpense,
  refreshFingerprint,
  saveExpenseRules,
  type ExpenseCategory,
  type ExpenseRule,
  type ParsedExpense,
  type PayRule,
} from './expenseOcr';

const CATEGORIES: ExpenseCategory[] = ['원가', '인건비', '고정비', '광고비', '공과금', '기타비용', '손익 제외', '분류 확인 필요'];

export function ExpenseImportModal({ open, employees, onClose, onApply }: {
  open: boolean;
  employees: Employee[];
  onClose: () => void;
  onApply: (items: ParsedExpense[]) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ParsedExpense[]>([]);
  const [rules, setRules] = useState<ExpenseRule[]>(loadExpenseRules);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressName, setProgressName] = useState('');
  const [filter, setFilter] = useState<'all' | 'review' | 'pending'>('all');
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState<ExpenseCategory>('원가');
  const visible = useMemo(() => items.filter((item) => filter === 'all' || (filter === 'review' ? item.needsReview || item.duplicate : !item.needsReview && !item.duplicate)), [items, filter]);
  const selected = items.filter((item) => item.selected && !item.needsReview && item.category !== '분류 확인 필요');
  if (!open) return null;

  const updateItem = (id: string, patch: Partial<ParsedExpense>) => {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      let next = refreshFingerprint(recalculateExpense({ ...item, ...patch }));
      next = { ...next, needsReview: !next.date || !next.counterparty || !next.actualAmount || next.category === '분류 확인 필요' };
      if (next.needsReview) next.selected = false;
      return next;
    }));
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    setBusy(true); setProgress(0);
    try {
      const parsed = await recognizeExpenseImages([...files], employees, rules, (value, name) => { setProgress(value); setProgressName(name); });
      setItems((current) => [...current, ...parsed]);
    } catch (error) {
      console.error('[ExpenseOCR] recognition failed', error);
      alert('이미지 인식에 실패했습니다. 선명한 캡처로 다시 시도해주세요.');
    } finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const addRule = () => {
    const keyword = newKeyword.trim();
    if (!keyword) return;
    const next = [...rules.filter((rule) => rule.keyword !== keyword), { keyword, category: newCategory }];
    setRules(next); saveExpenseRules(next); setNewKeyword('');
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <section className="flex max-h-[94dvh] w-full max-w-5xl flex-col rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl">
        <header className="flex items-center justify-between border-b border-black/5 px-4 py-4 sm:px-6">
          <div><h2 className="text-lg font-bold text-ink">지출내역 캡처 가져오기</h2><p className="text-xs text-ink-faint">이미지는 이 브라우저에서만 처리됩니다.</p></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-beige-light"><X size={19} /></button>
        </header>
        <div className="grow overflow-y-auto p-4 sm:p-6">
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-red/25 bg-brand-red/[0.04] font-bold text-brand-red">
            {busy ? <><FileImage size={22} /> {progressName} · {Math.round(progress * 100)}%</> : <><Upload size={22} /> 캡처 여러 장 선택</>}
          </button>
          {busy && <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-beige-light"><div className="h-full bg-brand-red transition-all" style={{ width: `${progress * 100}%` }} /></div>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {([['all','전체'],['review','확인 필요'],['pending','반영 대기']] as const).map(([key,label]) => <button key={key} onClick={() => setFilter(key)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === key ? 'bg-ink text-white' : 'bg-brand-beige-light text-ink-soft'}`}>{label}{key === 'review' ? ` ${items.filter((i) => i.needsReview || i.duplicate).length}` : ''}</button>)}
            <button onClick={() => setRulesOpen((value) => !value)} className="ml-auto flex items-center gap-1 rounded-full bg-brand-beige-light px-3 py-2 text-xs font-bold text-ink-soft"><Settings2 size={14} /> 분류 규칙</button>
          </div>
          {rulesOpen && <div className="mt-3 rounded-2xl bg-brand-beige-light p-3">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2"><input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="거래처/이름" className="min-w-0 rounded-xl bg-white px-3 text-sm" /><select value={newCategory} onChange={(e) => setNewCategory(e.target.value as ExpenseCategory)} className="rounded-xl bg-white px-2 text-xs">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select><Button size="sm" onClick={addRule}>추가</Button></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{rules.map((rule) => <button key={rule.keyword} onClick={() => { const next = rules.filter((item) => item.keyword !== rule.keyword); setRules(next); saveExpenseRules(next); }} className="rounded-full bg-white px-2.5 py-1.5 text-[11px] font-semibold">{rule.keyword} → {rule.category} ×</button>)}</div>
          </div>}
          <div className="mt-4 space-y-3">
            {!busy && !items.length && <p className="py-12 text-center text-sm text-ink-faint">캡처를 선택하면 출금 내역을 읽어 검토 목록에 표시합니다.</p>}
            {visible.map((item) => <article key={item.id} className={`rounded-2xl border p-3 ${item.needsReview || item.duplicate ? 'border-amber-300 bg-amber-50' : 'border-black/5 bg-white shadow-sm'}`}>
              <div className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-5 w-5 accent-brand-red" checked={item.selected} disabled={item.needsReview} onChange={(e) => updateItem(item.id, { selected: e.target.checked })} /><div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">{item.needsReview && <span className="flex items-center gap-1 rounded-full bg-amber-200 px-2 py-1 text-amber-900"><AlertTriangle size={12}/> 확인 필요</span>}{item.duplicate && <span className="rounded-full bg-red-100 px-2 py-1 text-red-600">중복 가능성</span>}<span className="text-ink-faint">OCR {Math.round(item.confidence)}%</span></div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[145px_1fr_150px_150px]">
                  <input type="date" value={item.date} onChange={(e) => updateItem(item.id,{date:e.target.value})} className="min-h-11 rounded-xl bg-brand-beige-light px-3 text-sm" />
                  <input value={item.counterparty} onChange={(e) => updateItem(item.id,{counterparty:e.target.value})} placeholder="거래처 또는 이름" className="min-h-11 min-w-0 rounded-xl bg-brand-beige-light px-3 text-sm" />
                  <input inputMode="numeric" value={item.actualAmount || ''} onChange={(e) => updateItem(item.id,{actualAmount:Number(e.target.value.replace(/\D/g,''))})} placeholder="실제 출금액" className="min-h-11 rounded-xl bg-brand-beige-light px-3 text-right text-sm font-bold" />
                  <select value={item.category} onChange={(e) => updateItem(item.id,{category:e.target.value as ExpenseCategory})} className="min-h-11 rounded-xl bg-brand-beige-light px-3 text-sm font-bold">{CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select>
                </div>
                {item.category === '인건비' && <div className="mt-2 flex flex-wrap items-center gap-2"><select value={item.payRule} onChange={(e) => updateItem(item.id,{payRule:e.target.value as PayRule})} className="rounded-lg bg-brand-beige-light px-2 py-2 text-xs"><option value="actual">실제 이체액 그대로</option><option value="withholding_3_3">3.3% 세전 역산</option><option value="review">지급유형 확인</option></select><span className="text-xs font-semibold text-ink-soft">손익 {item.appliedAmount.toLocaleString()}원{item.withholdingAmount ? ` · 원천세 예수금 ${item.withholdingAmount.toLocaleString()}원` : ''}</span></div>}
                <input value={item.memo} onChange={(e) => updateItem(item.id,{memo:e.target.value})} placeholder="메모 (선택)" className="mt-2 min-h-10 w-full rounded-xl bg-brand-beige-light px-3 text-sm" />
                <p className="mt-2 truncate text-[11px] text-ink-faint">원문: {item.rawText}</p>
              </div></div>
            </article>)}
          </div>
        </div>
        <footer className="border-t border-black/5 bg-white p-4 sm:rounded-b-3xl"><Button fullWidth disabled={!selected.length || busy} onClick={() => void onApply(selected)}><span className="flex items-center justify-center gap-2"><Check size={18}/> 선택 {selected.length}건 손익에 반영</span></Button><p className="mt-2 text-center text-[11px] text-ink-faint">선택하지 않은 거래와 확인 필요 거래는 저장되지 않습니다.</p></footer>
      </section>
    </div>
  );
}
