import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Percent, Receipt, RotateCcw, Settings2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { employeeDiscountService } from '@/services/employeeDiscountService';
import type { Employee, EmployeeDiscountRequest, EmployeeDiscountSetting } from '@/data/types';

const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}`;
const shiftMonth = (key:string,amount:number) => { const [y,m]=key.split('-').map(Number); return monthKey(new Date(y,m-1+amount,1)); };
const won = (value=0) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const dateTime = (iso:string) => new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));

function UsageCard({ request, isAdmin, onEdit, onCancel }: { request:EmployeeDiscountRequest; isAdmin:boolean; onEdit?:(r:EmployeeDiscountRequest)=>void; onCancel?:(r:EmployeeDiscountRequest)=>void }) {
  return <div className={`rounded-2xl p-4 ${request.status==='completed'?'bg-white shadow-sm':'bg-brand-beige-light opacity-65'}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-ink">{request.employeeName}</p><p className="mt-1 text-xs text-ink-faint">{dateTime(request.requestedAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status==='completed'?'bg-emerald-50 text-emerald-600':'bg-gray-100 text-gray-500'}`}>{request.status==='completed'?'사용 완료':'취소됨'}</span></div>
    {request.originalAmount!=null && <div className="mt-3 grid grid-cols-3 gap-2 text-center"><div><p className="text-[10px] text-ink-faint">결제 전</p><b className="text-sm">{won(request.originalAmount)}</b></div><div><p className="text-[10px] text-ink-faint">할인</p><b className="text-sm text-brand-red">-{won(request.discountAmount)}</b></div><div><p className="text-[10px] text-ink-faint">최종 결제</p><b className="text-sm">{won(request.finalAmount)}</b></div></div>}
    {request.memo && <p className="mt-3 rounded-xl bg-brand-beige-light px-3 py-2 text-xs text-ink-soft">{request.memo}</p>}
    {request.processedByName && <p className="mt-2 text-right text-[11px] text-ink-faint">사용자 {request.processedByName}</p>}
    {isAdmin && request.status==='completed' && <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" size="sm" onClick={()=>onEdit?.(request)}>내역 수정</Button><Button variant="secondary" size="sm" onClick={()=>onCancel?.(request)}><span className="flex items-center justify-center gap-1"><RotateCcw size={14}/>취소·복구</span></Button></div>}
  </div>;
}

export function EmployeeDiscountPage() {
  const { session,effectiveRole,effectiveEmployeeId }=useAuth();
  const { showToast }=useToast();
  const isAdmin=effectiveRole==='admin';
  const employeeId=effectiveEmployeeId??session?.employeeId;
  const [tab,setTab]=useState<'mine'|'admin'>('mine');
  const [month,setMonth]=useState(monthKey());
  const [mine,setMine]=useState<EmployeeDiscountRequest[]>([]);
  const [setting,setSetting]=useState<EmployeeDiscountSetting|null>(null);
  const [adminEmployees,setAdminEmployees]=useState<Employee[]>([]);
  const [adminSettings,setAdminSettings]=useState<EmployeeDiscountSetting[]>([]);
  const [adminRequests,setAdminRequests]=useState<EmployeeDiscountRequest[]>([]);
  const [loading,setLoading]=useState(true);
  const [useOpen,setUseOpen]=useState(false);
  const [amount,setAmount]=useState(0);
  const [memo,setMemo]=useState('');
  const [saving,setSaving]=useState(false);
  const [adminEdit,setAdminEdit]=useState<{id?:string;employeeId:string;requestedAt:string;originalAmount:number;memo:string}|null>(null);

  const load=useCallback(async()=>{ if(!employeeId)return; setLoading(true); try{const my=await employeeDiscountService.getMine(employeeId,month);setMine(my.requests);setSetting(my.setting);if(isAdmin){const admin=await employeeDiscountService.getAdminMonth(month);setAdminEmployees(admin.employees);setAdminSettings(admin.settings);setAdminRequests(admin.requests.filter(r=>r.status!=='pending'));}}catch(error){console.error('[EmployeeDiscount] load failed',error);showToast('직원할인 정보를 불러오지 못했습니다.','error');}finally{setLoading(false);}},[employeeId,isAdmin,month,showToast]);
  useEffect(()=>{void load();},[load]);
  const completed=mine.filter(r=>r.status==='completed');
  const limit=setting?.monthlyLimit??2;
  const remaining=Math.max(0,limit-completed.length);
  const rate=setting?.discountRate??.2;
  const applyDiscount=async()=>{if(amount<=0||saving)return;if(!confirm('직원 본인이 동반한 테이블 1개에만 사용 가능하며, 할인은 양도·이월할 수 없습니다.\n\n20% 할인을 사용 완료할까요?'))return;setSaving(true);try{await employeeDiscountService.use(amount,memo);showToast('직원 할인 사용이 완료되었습니다.');setUseOpen(false);setAmount(0);setMemo('');await load();}catch(error){console.error('[EmployeeDiscount] self use failed',error);showToast(error instanceof Error?error.message:'할인 사용에 실패했습니다.','error');}finally{setSaving(false);}};
  const cancel=async(request:EmployeeDiscountRequest)=>{if(!confirm('이 사용 내역을 취소하고 할인 횟수를 복구할까요?'))return;try{await employeeDiscountService.cancel(request.id);showToast('사용 횟수와 할인금액을 복구했습니다.');await load();}catch{showToast('취소 처리에 실패했습니다.','error');}};
  const saveSetting=async(employee:Employee,monthlyLimit:number,discountRate:number)=>{if(!session)return;try{await employeeDiscountService.saveSetting({employeeId:employee.id,monthlyLimit,discountRate},session.employeeId);showToast('할인 설정을 저장했습니다.');await load();}catch{showToast('설정 저장에 실패했습니다.','error');}};
  const saveAdmin=async()=>{if(!adminEdit?.employeeId||adminEdit.originalAmount<=0)return;try{await employeeDiscountService.adminSave({...adminEdit,requestedAt:new Date(adminEdit.requestedAt).toISOString()});showToast(adminEdit.id?'사용 내역을 수정했습니다.':'사용 내역을 추가했습니다.');setAdminEdit(null);await load();}catch{showToast('사용 내역 저장에 실패했습니다.','error');}};
  const [year,monthNumber]=month.split('-').map(Number);
  const summary=useMemo(()=>{const rows=adminRequests.filter(r=>r.status==='completed');return{count:rows.length,discount:rows.reduce((sum,r)=>sum+(r.discountAmount??0),0)};},[adminRequests]);

  return <Layout title="직원할인"><div className="space-y-4 pb-24">
    {isAdmin&&<div className="grid grid-cols-2 rounded-2xl bg-brand-beige-light p-1"><button onClick={()=>setTab('mine')} className={`min-h-11 rounded-xl text-sm font-bold ${tab==='mine'?'bg-white text-brand-red shadow-sm':'text-ink-faint'}`}>내 할인</button><button onClick={()=>setTab('admin')} className={`min-h-11 rounded-xl text-sm font-bold ${tab==='admin'?'bg-white text-brand-red shadow-sm':'text-ink-faint'}`}>관리</button></div>}
    {loading?<div className="flex min-h-64 items-center justify-center"><Spinner/></div>:tab==='mine'?<>
      <Card className="bg-gradient-to-br from-brand-red to-[#3192ff] text-white"><p className="text-sm font-semibold text-white/75">{session?.name}님의 {monthNumber}월 직원 할인</p><p className="mt-3 text-3xl font-bold">이번 달 {limit}회 중 {completed.length}회 사용</p><p className="mt-2 text-lg font-bold text-white/90">{remaining}회 남음 · {Math.round(rate*100)}% 할인</p></Card>
      <Button fullWidth size="lg" disabled={remaining===0} onClick={()=>setUseOpen(true)}>{remaining===0?'이번 달 할인을 모두 사용했습니다':'직원 할인 사용하기'}</Button>
      <Card><h2 className="text-base font-bold">이번 달 사용 내역</h2><div className="mt-3 space-y-3">{mine.length?mine.map(r=><UsageCard key={r.id} request={{...r,employeeName:session?.name,processedByName:session?.name}} isAdmin={false}/>):<p className="py-8 text-center text-sm text-ink-faint">사용 내역이 없습니다.</p>}</div></Card>
    </>:<>
      <Card padded={false} className="p-3"><div className="flex items-center justify-between"><button onClick={()=>setMonth(shiftMonth(month,-1))} className="h-10 w-10 rounded-xl bg-brand-beige-light"><ChevronLeft className="mx-auto" size={18}/></button><b>{year}년 {monthNumber}월</b><button onClick={()=>setMonth(shiftMonth(month,1))} className="h-10 w-10 rounded-xl bg-brand-beige-light"><ChevronRight className="mx-auto" size={18}/></button></div></Card>
      <div className="grid grid-cols-2 gap-3"><Card><Receipt size={20} className="text-brand-red"/><p className="mt-2 text-xs text-ink-faint">전체 사용</p><p className="text-2xl font-bold">{summary.count}회</p></Card><Card><Percent size={20} className="text-emerald-600"/><p className="mt-2 text-xs text-ink-faint">총 할인금액</p><p className="text-2xl font-bold">{won(summary.discount)}</p></Card></div>
      <Card><h2 className="flex items-center gap-2 font-bold"><Settings2 size={18}/>직원별 사용 현황·설정</h2><div className="mt-3 space-y-3">{adminEmployees.map(e=>{const s=adminSettings.find(v=>v.employeeId===e.id)??{employeeId:e.id,monthlyLimit:2,discountRate:.2};const rows=adminRequests.filter(r=>r.employeeId===e.id&&r.status==='completed');return <div key={e.id} className="rounded-2xl bg-brand-beige-light p-3"><div className="flex justify-between gap-2"><b>{e.name}</b><span className="text-xs font-semibold text-ink-soft">{rows.length}회 사용 · {Math.max(0,s.monthlyLimit-rows.length)}회 남음 · {won(rows.reduce((a,r)=>a+(r.discountAmount??0),0))}</span></div><div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"><input aria-label="월 횟수" type="number" defaultValue={s.monthlyLimit} id={`limit-${e.id}`} className="min-h-10 rounded-xl bg-white px-2 text-center text-sm font-bold"/><input aria-label="할인율" type="number" defaultValue={Math.round(s.discountRate*100)} id={`rate-${e.id}`} className="min-h-10 rounded-xl bg-white px-2 text-center text-sm font-bold"/><Button size="sm" onClick={()=>{const l=document.getElementById(`limit-${e.id}`) as HTMLInputElement;const r=document.getElementById(`rate-${e.id}`) as HTMLInputElement;void saveSetting(e,Number(l.value),Number(r.value)/100);}}>저장</Button></div></div>})}</div></Card>
      <Button fullWidth variant="secondary" onClick={()=>setAdminEdit({employeeId:adminEmployees[0]?.id??'',requestedAt:new Date().toISOString().slice(0,16),originalAmount:0,memo:''})}>관리자 수동 내역 추가</Button>
      <Card><h2 className="font-bold">월별 사용 내역</h2><div className="mt-3 space-y-3">{adminRequests.length?adminRequests.map(r=><UsageCard key={r.id} request={r} isAdmin onCancel={cancel} onEdit={v=>setAdminEdit({id:v.id,employeeId:v.employeeId,requestedAt:new Date(v.requestedAt).toISOString().slice(0,16),originalAmount:v.originalAmount??0,memo:v.memo??''})}/>):<p className="py-8 text-center text-sm text-ink-faint">사용 내역이 없습니다.</p>}</div></Card>
    </>}
  </div>
  <Modal open={useOpen} onClose={()=>setUseOpen(false)} title="직원 할인 사용" footer={<Button fullWidth disabled={amount<=0||saving} onClick={()=>void applyDiscount()}>{saving?'처리 중…':`${Math.round(rate*100)}% 할인 사용 완료`}</Button>}><div className="space-y-4 pb-5"><label className="block text-sm font-semibold text-ink-soft">결제 전 금액<input autoFocus inputMode="numeric" value={amount?amount.toLocaleString():''} onChange={e=>setAmount(Number(e.target.value.replace(/\D/g,'')))} placeholder="0" className="mt-2 min-h-14 w-full rounded-2xl bg-brand-beige-light px-4 text-right text-xl font-bold"/></label><label className="block text-sm font-semibold text-ink-soft">메모 (선택)<input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="예: 가족 식사" className="mt-2 min-h-12 w-full rounded-xl bg-brand-beige-light px-4 text-ink"/></label><div className="space-y-2 rounded-2xl bg-brand-beige-light p-4"><div className="flex justify-between text-sm"><span>할인율</span><b>{Math.round(rate*100)}%</b></div><div className="flex justify-between text-sm text-brand-red"><span>할인 금액</span><b>-{won(amount*rate)}</b></div><div className="h-px bg-black/5"/><div className="flex justify-between text-lg"><b>최종 결제금액</b><b>{won(amount-amount*rate)}</b></div></div><p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-800">직원 본인이 동반한 테이블 1개에만 사용 가능하며, 다른 사람에게 양도하거나 다음 달로 이월할 수 없습니다.</p></div></Modal>
  <Modal open={!!adminEdit} onClose={()=>setAdminEdit(null)} title={adminEdit?.id?'사용 내역 수정':'수동 내역 추가'} footer={<Button fullWidth disabled={!adminEdit?.employeeId||!adminEdit.originalAmount} onClick={()=>void saveAdmin()}>저장</Button>}>{adminEdit&&<div className="space-y-4 pb-5"><select value={adminEdit.employeeId} onChange={e=>setAdminEdit({...adminEdit,employeeId:e.target.value})} className="min-h-12 w-full rounded-xl bg-brand-beige-light px-3">{adminEmployees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select><input type="datetime-local" value={adminEdit.requestedAt} onChange={e=>setAdminEdit({...adminEdit,requestedAt:e.target.value})} className="min-h-12 w-full rounded-xl bg-brand-beige-light px-3"/><input inputMode="numeric" value={adminEdit.originalAmount||''} onChange={e=>setAdminEdit({...adminEdit,originalAmount:Number(e.target.value.replace(/\D/g,''))})} placeholder="결제 전 금액" className="min-h-12 w-full rounded-xl bg-brand-beige-light px-3 text-right font-bold"/><input value={adminEdit.memo} onChange={e=>setAdminEdit({...adminEdit,memo:e.target.value})} placeholder="메모" className="min-h-12 w-full rounded-xl bg-brand-beige-light px-3"/></div>}</Modal>
  </Layout>;
}
