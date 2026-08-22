import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, ChevronLeft, ChevronRight, Clock3, Percent, Receipt, RotateCcw, Settings2, Users } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { useToast } from '@/components/common/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { employeeDiscountService } from '@/services/employeeDiscountService';
import type { Employee, EmployeeDiscountRequest, EmployeeDiscountSetting } from '@/data/types';

const monthKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const shiftMonth = (key: string, amount: number) => { const [y,m] = key.split('-').map(Number); return monthKey(new Date(y,m-1+amount,1)); };
const won = (value = 0) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const dateTime = (iso: string) => new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const statusLabel = { pending:'처리 대기', completed:'사용 완료', cancelled:'취소', expired:'만료' } as const;
const statusClass = { pending:'bg-blue-50 text-blue-600', completed:'bg-emerald-50 text-emerald-600', cancelled:'bg-gray-100 text-gray-500', expired:'bg-amber-50 text-amber-700' } as const;

function RequestCard({ request, canProcess, isAdmin, onComplete, onCancel, onEdit }: {
  request: EmployeeDiscountRequest; canProcess: boolean; isAdmin: boolean;
  onComplete: (request: EmployeeDiscountRequest) => void; onCancel: (request: EmployeeDiscountRequest) => void;
  onEdit?: (request: EmployeeDiscountRequest) => void;
}) {
  const remainingSeconds = Math.max(0, Math.floor((new Date(request.expiresAt).getTime() - Date.now()) / 1000));
  return <Card padded={false} className="p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-ink">{request.employeeName ?? '직원'}</p><p className="mt-1 text-xs text-ink-faint">요청 {dateTime(request.requestedAt)}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass[request.status]}`}>{statusLabel[request.status]}</span></div>
    {request.status === 'pending' && <div className="mt-3 flex items-center gap-1.5 text-sm font-bold text-brand-red"><Clock3 size={16}/>{remainingSeconds > 0 ? `${Math.floor(remainingSeconds/60)}분 ${remainingSeconds%60}초 남음` : '만료됨'}</div>}
    {request.originalAmount != null && <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-brand-beige-light p-3 text-center"><div><p className="text-[10px] text-ink-faint">결제 전</p><p className="text-sm font-bold">{won(request.originalAmount)}</p></div><div><p className="text-[10px] text-ink-faint">할인</p><p className="text-sm font-bold text-brand-red">-{won(request.discountAmount)}</p></div><div><p className="text-[10px] text-ink-faint">최종</p><p className="text-sm font-bold">{won(request.finalAmount)}</p></div></div>}
    {request.processedByName && <p className="mt-2 text-right text-[11px] text-ink-faint">처리자 {request.processedByName}</p>}
    {request.status === 'pending' && canProcess && remainingSeconds > 0 && <div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => onCancel(request)}>취소</Button><Button onClick={() => onComplete(request)}>금액 입력</Button></div>}
    {request.status === 'completed' && isAdmin && <div className="mt-3 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => onEdit?.(request)}>금액 수정</Button><Button variant="secondary" onClick={() => onCancel(request)}><span className="flex items-center justify-center gap-1"><RotateCcw size={15}/> 취소·복구</span></Button></div>}
  </Card>;
}

export function EmployeeDiscountPage() {
  const { session, effectiveRole, effectiveEmployeeId } = useAuth();
  const { showToast } = useToast();
  const isAdmin = effectiveRole === 'admin';
  const employeeId = effectiveEmployeeId ?? session?.employeeId;
  const [tab,setTab] = useState<'mine'|'today'|'admin'>('mine');
  const [month,setMonth] = useState(monthKey());
  const [mine,setMine] = useState<EmployeeDiscountRequest[]>([]);
  const [today,setToday] = useState<EmployeeDiscountRequest[]>([]);
  const [setting,setSetting] = useState<EmployeeDiscountSetting | null>(null);
  const [adminEmployees,setAdminEmployees] = useState<Employee[]>([]);
  const [adminSettings,setAdminSettings] = useState<EmployeeDiscountSetting[]>([]);
  const [adminRequests,setAdminRequests] = useState<EmployeeDiscountRequest[]>([]);
  const [loading,setLoading] = useState(true);
  const [creating,setCreating] = useState(false);
  const [amountRequest,setAmountRequest] = useState<EmployeeDiscountRequest | null>(null);
  const [amount,setAmount] = useState(0);
  const [adminEdit,setAdminEdit] = useState<{ id?: string; employeeId: string; requestedAt: string; originalAmount: number } | null>(null);
  const [,setTick] = useState(0);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const [myData,todayData] = await Promise.all([employeeDiscountService.getMine(employeeId,month),employeeDiscountService.getToday()]);
      setMine(myData.requests); setSetting(myData.setting); setToday(todayData);
      if (isAdmin) { const admin = await employeeDiscountService.getAdminMonth(month); setAdminEmployees(admin.employees); setAdminSettings(admin.settings); setAdminRequests(admin.requests); }
    } catch (error) { console.error('[EmployeeDiscount] load failed',error); showToast('직원할인 정보를 불러오지 못했습니다.','error'); }
    finally { setLoading(false); }
  },[employeeId,isAdmin,month,showToast]);
  useEffect(() => { void load(); },[load]);
  useEffect(() => { const timer=window.setInterval(()=>setTick((v)=>v+1),1000); return ()=>clearInterval(timer); },[]);

  const completed = mine.filter((request)=>request.status==='completed');
  const limit = setting?.monthlyLimit ?? 2;
  const remaining = Math.max(0,limit-completed.length);
  const pending = mine.find((request)=>request.status==='pending' && new Date(request.expiresAt).getTime()>Date.now());
  const rate = setting?.discountRate ?? .2;
  const createRequest = async () => { setCreating(true); try { await employeeDiscountService.create(); showToast('할인 요청을 만들었습니다. 매장 직원에게 화면을 보여주세요.'); await load(); } catch(error) { console.error('[EmployeeDiscount] create failed',error); showToast(error instanceof Error ? error.message : '할인 요청에 실패했습니다.','error'); } finally { setCreating(false); } };
  const completeRequest = async () => { if (!amountRequest || amount<=0) return; try { await employeeDiscountService.complete(amountRequest.id,amount); showToast('직원 할인을 사용 완료했습니다.'); setAmountRequest(null); setAmount(0); await load(); } catch(error) { console.error('[EmployeeDiscount] complete failed',error); showToast('할인 처리에 실패했습니다.','error'); } };
  const cancelRequest = async (request: EmployeeDiscountRequest) => { if (!confirm(request.status==='completed'?'완료 처리를 취소하고 횟수를 복구할까요?':'할인 요청을 취소할까요?')) return; try { await employeeDiscountService.cancel(request.id); showToast(request.status==='completed'?'할인 횟수를 복구했습니다.':'요청을 취소했습니다.'); await load(); } catch(error) { console.error('[EmployeeDiscount] cancel failed',error); showToast('취소 처리에 실패했습니다.','error'); } };
  const saveSetting = async (employee: Employee, monthlyLimit: number, discountRate: number) => { if (!session) return; try { await employeeDiscountService.saveSetting({employeeId:employee.id,monthlyLimit,discountRate},session.employeeId); showToast(`${employee.name} 할인 설정을 저장했습니다.`); await load(); } catch { showToast('설정 저장에 실패했습니다.','error'); } };
  const saveAdminRecord = async () => { if (!adminEdit?.employeeId || adminEdit.originalAmount<=0) return; try { await employeeDiscountService.adminSave({...adminEdit,requestedAt:new Date(adminEdit.requestedAt).toISOString()}); showToast(adminEdit.id?'할인 내역을 수정했습니다.':'할인 내역을 추가했습니다.'); setAdminEdit(null); await load(); } catch(error) { console.error('[EmployeeDiscount] admin save failed',error); showToast('할인 내역 저장에 실패했습니다.','error'); } };
  const [y,m] = month.split('-').map(Number);
  const adminSummary = useMemo(()=>({ count:adminRequests.filter(r=>r.status==='completed').length, amount:adminRequests.filter(r=>r.status==='completed').reduce((s,r)=>s+(r.discountAmount??0),0) }),[adminRequests]);

  return <Layout title="직원할인">
    <div className="space-y-4 pb-24">
      <div className={`grid ${isAdmin?'grid-cols-3':'grid-cols-2'} rounded-2xl bg-brand-beige-light p-1`}>{([['mine','내 할인'],['today','오늘 요청'],...(isAdmin?[['admin','관리']]:[])] as [typeof tab,string][]).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`min-h-11 rounded-xl text-sm font-bold ${tab===key?'bg-white text-brand-red shadow-sm':'text-ink-faint'}`}>{label}</button>)}</div>
      {loading ? <div className="flex min-h-64 items-center justify-center"><Spinner/></div> : tab==='mine' ? <>
        <Card className="overflow-hidden bg-gradient-to-br from-brand-red to-[#3192ff] text-white"><p className="text-sm font-semibold text-white/75">{session?.name}님의 {m}월 직원 할인</p><p className="mt-3 text-3xl font-bold">{remaining}회 남음</p><p className="mt-2 text-sm font-semibold text-white/85">이번 달 {limit}회 중 {completed.length}회 사용 · {Math.round(rate*100)}% 할인</p></Card>
        {pending ? <div className="rounded-3xl border-2 border-brand-red bg-white p-6 text-center shadow-premium"><BadgeCheck size={42} className="mx-auto text-brand-red"/><p className="mt-3 text-2xl font-bold">직원 할인 요청</p><p className="mt-2 text-lg font-bold text-brand-red">{session?.name}</p><p className="mt-1 text-sm text-ink-soft">{dateTime(pending.requestedAt)} 요청 · 10분간 유효</p><p className="mt-5 rounded-2xl bg-brand-beige-light p-4 text-sm font-semibold">직원 본인이 식사한 테이블 1개에만 적용됩니다.</p></div> : <Button fullWidth size="lg" disabled={!remaining||creating} onClick={()=>void createRequest()}>{creating?'요청 생성 중…':'직원 할인 사용하기'}</Button>}
        <Card><h2 className="text-base font-bold">이번 달 사용 내역</h2><div className="mt-3 space-y-3">{mine.length?mine.map(r=><RequestCard key={r.id} request={{...r,employeeName:session?.name}} canProcess={false} isAdmin={false} onComplete={()=>{}} onCancel={cancelRequest}/>):<p className="py-8 text-center text-sm text-ink-faint">사용 내역이 없습니다.</p>}</div></Card>
      </> : tab==='today' ? <><div className="flex items-center gap-2"><Users size={20}/><h2 className="text-lg font-bold">오늘의 직원 할인 요청</h2></div>{today.length?today.map(r=><RequestCard key={r.id} request={r} canProcess isAdmin={isAdmin} onComplete={(req)=>{setAmountRequest(req);setAmount(0);}} onCancel={cancelRequest}/>):<Card><p className="py-12 text-center text-sm text-ink-faint">오늘 요청이 없습니다.</p></Card>}</> : <>
        <Card padded={false} className="p-3"><div className="flex items-center justify-between"><button onClick={()=>setMonth(shiftMonth(month,-1))} className="h-10 w-10 rounded-xl bg-brand-beige-light"><ChevronLeft className="mx-auto" size={18}/></button><p className="font-bold">{y}년 {m}월</p><button onClick={()=>setMonth(shiftMonth(month,1))} className="h-10 w-10 rounded-xl bg-brand-beige-light"><ChevronRight className="mx-auto" size={18}/></button></div></Card>
        <div className="grid grid-cols-2 gap-3"><Card><Receipt size={20} className="text-brand-red"/><p className="mt-2 text-xs text-ink-faint">사용 완료</p><p className="text-2xl font-bold">{adminSummary.count}회</p></Card><Card><Percent size={20} className="text-emerald-600"/><p className="mt-2 text-xs text-ink-faint">총 할인금액</p><p className="text-2xl font-bold">{won(adminSummary.amount)}</p></Card></div>
        <Card><h2 className="flex items-center gap-2 text-base font-bold"><Settings2 size={18}/> 직원별 기본 설정</h2><div className="mt-3 space-y-3">{adminEmployees.map(employee=>{const s=adminSettings.find(v=>v.employeeId===employee.id)??{employeeId:employee.id,monthlyLimit:2,discountRate:.2};const used=adminRequests.filter(r=>r.employeeId===employee.id&&r.status==='completed');return <div key={employee.id} className="rounded-2xl bg-brand-beige-light p-3"><div className="flex justify-between"><span className="font-bold">{employee.name}</span><span className="text-xs font-semibold text-ink-soft">{used.length}회 사용 · {won(used.reduce((a,r)=>a+(r.discountAmount??0),0))}</span></div><div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2"><label className="text-[10px] text-ink-faint">월 횟수<input type="number" defaultValue={s.monthlyLimit} id={`limit-${employee.id}`} className="mt-1 min-h-10 w-full rounded-xl bg-white px-2 text-center text-sm font-bold"/></label><label className="text-[10px] text-ink-faint">할인율 %<input type="number" defaultValue={Math.round(s.discountRate*100)} id={`rate-${employee.id}`} className="mt-1 min-h-10 w-full rounded-xl bg-white px-2 text-center text-sm font-bold"/></label><Button size="sm" className="self-end" onClick={()=>{const limitInput=document.getElementById(`limit-${employee.id}`) as HTMLInputElement;const rateInput=document.getElementById(`rate-${employee.id}`) as HTMLInputElement;void saveSetting(employee,Number(limitInput.value),Number(rateInput.value)/100);}}>저장</Button></div></div>})}</div></Card>
        <Button fullWidth variant="secondary" onClick={()=>setAdminEdit({employeeId:adminEmployees[0]?.id??'',requestedAt:new Date().toISOString().slice(0,16),originalAmount:0})}>관리자 수동 사용 내역 추가</Button>
        <Card><h2 className="text-base font-bold">월별 사용 내역</h2><div className="mt-3 space-y-3">{adminRequests.length?adminRequests.map(r=><RequestCard key={r.id} request={r} canProcess isAdmin onComplete={(req)=>{setAmountRequest(req);setAmount(req.originalAmount??0);}} onCancel={cancelRequest} onEdit={(req)=>setAdminEdit({id:req.id,employeeId:req.employeeId,requestedAt:new Date(req.requestedAt).toISOString().slice(0,16),originalAmount:req.originalAmount??0})}/>):<p className="py-8 text-center text-sm text-ink-faint">내역이 없습니다.</p>}</div></Card>
      </>}
    </div>
    <Modal open={!!amountRequest} onClose={()=>setAmountRequest(null)} title={`${amountRequest?.employeeName ?? '직원'} 할인 결제`} footer={<Button fullWidth disabled={amount<=0} onClick={()=>void completeRequest()}>사용 완료</Button>}>
      <div className="pb-5"><label className="text-sm font-semibold text-ink-soft">결제 전 금액<input autoFocus inputMode="numeric" value={amount?amount.toLocaleString():''} onChange={e=>setAmount(Number(e.target.value.replace(/\D/g,'')))} className="mt-2 min-h-14 w-full rounded-2xl bg-brand-beige-light px-4 text-right text-xl font-bold"/></label><div className="mt-4 space-y-2 rounded-2xl bg-brand-beige-light p-4"><div className="flex justify-between text-sm"><span>할인율</span><b>{Math.round((amountRequest?.discountRate??.2)*100)}%</b></div><div className="flex justify-between text-sm text-brand-red"><span>할인 금액</span><b>-{won(amount*(amountRequest?.discountRate??.2))}</b></div><div className="h-px bg-black/5"/><div className="flex justify-between text-lg"><span className="font-bold">최종 결제금액</span><b>{won(amount-amount*(amountRequest?.discountRate??.2))}</b></div></div></div>
    </Modal>
    <Modal open={!!adminEdit} onClose={()=>setAdminEdit(null)} title={adminEdit?.id?'할인 내역 수정':'수동 할인 추가'} footer={<Button fullWidth disabled={!adminEdit?.employeeId||!adminEdit.originalAmount} onClick={()=>void saveAdminRecord()}>저장</Button>}>
      {adminEdit && <div className="space-y-4 pb-5"><label className="block text-sm font-semibold text-ink-soft">직원<select value={adminEdit.employeeId} onChange={e=>setAdminEdit({...adminEdit,employeeId:e.target.value})} className="mt-2 min-h-12 w-full rounded-xl bg-brand-beige-light px-3 text-ink">{adminEmployees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="block text-sm font-semibold text-ink-soft">사용일시<input type="datetime-local" value={adminEdit.requestedAt} onChange={e=>setAdminEdit({...adminEdit,requestedAt:e.target.value})} className="mt-2 min-h-12 w-full rounded-xl bg-brand-beige-light px-3 text-ink"/></label><label className="block text-sm font-semibold text-ink-soft">결제 전 금액<input inputMode="numeric" value={adminEdit.originalAmount||''} onChange={e=>setAdminEdit({...adminEdit,originalAmount:Number(e.target.value.replace(/\D/g,''))})} className="mt-2 min-h-12 w-full rounded-xl bg-brand-beige-light px-3 text-right text-lg font-bold"/></label></div>}
    </Modal>
  </Layout>;
}
