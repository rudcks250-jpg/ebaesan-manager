import { useEffect, useState } from 'react';
import {
  Copy,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Minus,
  Plus,
  Store,
  MessageCircle,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { vendorService, type ItemSelectionMap } from '@/services/vendorService';
import { copyText } from '@/utils/clipboard';
import { VendorEditModal } from '@/features/order/VendorEditModal';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  orderHistoryRepository,
  type OrderCompletion,
} from '@/repositories/orderHistoryRepository';
import type { Vendor } from '@/data/types';

interface VendorCardProps {
  vendor: Vendor;
  onChanged: () => void;
}

const JIWOO_FOOD_STANDARDS: Readonly<Record<string, { name: string; specification: string }>> = {
  간마늘: { name: '간마늘', specification: '1kg' },
  간장: { name: '간장', specification: '13L' },
  간장말통: { name: '간장', specification: '13L' },
  건다시마: { name: '건다시마', specification: '1kg' },
  다시마: { name: '건다시마', specification: '1kg' },
  '건다시마(60g)': { name: '건다시마(60g)', specification: '60g' },
  '계란(특란)': { name: '계란(특란)', specification: '30입' },
  계란: { name: '계란(특란)', specification: '30입' },
  '고추가루(김치용)': { name: '고추가루(김치용)', specification: '2.5kg' },
  '고추가루(다데기)': { name: '고추가루(다데기)', specification: '2.5kg' },
  깐감자: { name: '깐감자', specification: '1kg' },
  깻잎: { name: '깻잎', specification: '1kg' },
  다진마늘: { name: '다진마늘', specification: '1kg' },
  다시다: { name: '다시다', specification: '2kg' },
  대파: { name: '대파', specification: '단' },
  돌미나리: { name: '돌미나리', specification: '4kg' },
  미나리: { name: '돌미나리', specification: '4kg' },
  멸치액젓: { name: '멸치액젓', specification: '9kg' },
  물티슈: { name: '물티슈', specification: '400매' },
  밀면: { name: '해든밀면', specification: '2kg×8ea' },
  해든밀면: { name: '해든밀면', specification: '2kg×8ea' },
  백오이: { name: '청오이', specification: '개' },
  오이: { name: '청오이', specification: '개' },
  청오이: { name: '청오이', specification: '개' },
  볶은콩가루: { name: '볶은콩가루', specification: '1kg' },
  콩가루: { name: '볶은콩가루', specification: '1kg' },
  부라보: { name: '부라보', specification: '12L' },
  새송이버섯: { name: '총알새송이버섯', specification: '2kg' },
  버섯: { name: '총알새송이버섯', specification: '2kg' },
  삼진호일: { name: '삼진호일', specification: '30cm' },
  볶음밥용호일: { name: '삼진호일', specification: '30cm' },
  상추: { name: '상추', specification: '2kg' },
  적상추: { name: '적상추', specification: '1kg' },
  쌀: { name: '쌀', specification: '20kg' },
  쌈무: { name: '쌈무', specification: '3kg' },
  '애호박(주키니)': { name: '애호박(주키니)', specification: '' },
  쥬키니: { name: '애호박(주키니)', specification: '' },
  양파: { name: '양파', specification: '15kg' },
  와사비: { name: '와사비', specification: '750g' },
  유한락스: { name: '유한락스', specification: 'BOX' },
  종이컵: { name: '종이컵', specification: '1000개' },
  종이타월: { name: '종이타월', specification: '4500장' },
  주키니호박: { name: '주키니호박', specification: '개' },
  '찌개용 두부': { name: '찌개용 두부', specification: '3kg' },
  두부: { name: '찌개용 두부', specification: '3kg' },
  청국장: { name: '청국장', specification: '2kg' },
  '청양고추(1kg)': { name: '청양고추(1kg)', specification: '1kg' },
  '청양고추(3kg)': { name: '청양고추', specification: '3kg' },
  고추: { name: '청양고추', specification: '3kg' },
  고추장: { name: '태양초고추장', specification: '14kg' },
  태양초고추장: { name: '태양초고추장', specification: '14kg' },
  참기름: { name: '참기름', specification: '1.8L' },
  총알새송이버섯: { name: '총알새송이버섯', specification: '2kg' },
  통깨: { name: '통깨', specification: '1kg' },
  볶은깨: { name: '통깨', specification: '1kg' },
  '통마늘(소)': { name: '통마늘(소)', specification: '1kg' },
  마늘: { name: '통마늘(소)', specification: '1kg' },
  팩두부: { name: '팩두부', specification: '3kg' },
  피자치즈: { name: '피자치즈', specification: '2.5kg' },
  '볶음밥 치즈': { name: '피자치즈', specification: '2.5kg' },
  쌈장: { name: '순창궁 쌈장', specification: '14kg' },
  '순창궁 쌈장': { name: '순창궁 쌈장', specification: '14kg' },
  니트릴장갑: { name: '니트릴장갑 L', specification: '' },
  '니트릴 장갑': { name: '니트릴장갑 L', specification: '' },
  '니트릴장갑 L': { name: '니트릴장갑 L', specification: '' },
};

const KAKAO_SHARE_VENDORS = new Set(['지우푸드', '비제이무역', '좋은축산유통']);
const KAKAO_SHARE_VENDOR_IDS = new Set([
  'vendor_grocery',
  'vendor_fixed_charcoal',
  'vendor_meat',
]);
const SMS_ONLY_VENDOR_IDS = new Set(['vendor_fixed_kimchi']);

function productDisplayName(vendorName: string, productName: string): string {
  const product = productDisplayParts(vendorName, productName);
  return product.specification ? `${product.name} (${product.specification})` : product.name;
}

function productDisplayParts(
  vendorName: string,
  productName: string
): { name: string; specification?: string } {
  if (vendorName !== '지우푸드') return { name: productName };
  const standard = JIWOO_FOOD_STANDARDS[productName];
  return standard ?? { name: productName };
}

export function VendorCard({ vendor, onChanged }: VendorCardProps) {
  const { showToast } = useToast();
  const { session } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [selections, setSelections] = useState<ItemSelectionMap>(() =>
    Object.fromEntries((vendor.items ?? []).map((item) => [item.id, { checked: false, qty: 1 }]))
  );

  const lastOrderText = vendorService.formatLastOrder(vendor.lastOrderAt);
  const directOrderMessage = vendorService.getDirectOrderMessage(vendor);
  const phoneDisplay = vendorService.formatPhoneDisplay(vendor.phone);
  const selectedCount = Object.values(selections).filter((s) => s.checked).length;
  const isKimchiVendor = vendor.id === 'vendor_fixed_kimchi';
  const isSharedCompletionVendor =
    isKimchiVendor || vendor.id === 'vendor_fixed_charcoal';
  const [recentOrder, setRecentOrder] = useState<OrderCompletion | undefined>(() =>
    vendor.lastOrderAt
      ? {
          id: 'local',
          vendorId: vendor.id,
          vendorName: vendor.name,
          completedBy: '',
          completedByName: vendor.lastOrderedByName ?? '확인 불가',
          completedAt: vendor.lastOrderAt,
        }
      : undefined
  );
  const ordered =
    vendorService.isOrderedToday(vendor) ||
    (recentOrder
      ? vendorService.isOrderedToday({ ...vendor, lastOrderAt: recentOrder.completedAt })
      : false);
  const normalizedVendorName = vendor.name.replace(/\s/g, '');
  const usesKakaoShare =
    !SMS_ONLY_VENDOR_IDS.has(vendor.id) &&
    (KAKAO_SHARE_VENDOR_IDS.has(vendor.id) || KAKAO_SHARE_VENDORS.has(normalizedVendorName));

  useEffect(() => {
    if (!isSharedCompletionVendor) return;
    let cancelled = false;
    orderHistoryRepository.findLatest(vendor.id)
      .then((latest) => {
        if (!cancelled && latest) setRecentOrder(latest);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSharedCompletionVendor, vendor.id]);

  const toggleCheck = (itemId: string) => {
    setSelections((prev) => ({ ...prev, [itemId]: { ...prev[itemId], checked: !prev[itemId].checked } }));
  };
  const setQty = (itemId: string, qty: number) => {
    setSelections((prev) => ({ ...prev, [itemId]: { ...prev[itemId], qty: Math.max(1, qty) } }));
  };
  const loadDefaults = () => {
    setSelections(vendorService.getDefaultSelections(vendor));
    setExpanded(true);
    showToast('기본 발주 품목을 불러왔습니다.');
  };

  const getOrderMessage = (): string => {
    return (
      directOrderMessage ??
      (vendor.type === 'quantity'
        ? vendor.name === '지우푸드'
          ? (() => {
              const lines = (vendor.items ?? [])
                .filter((item) => selections[item.id]?.checked)
                .map((item) => `${productDisplayName(vendor.name, item.name)} ${selections[item.id].qty}`);
              return lines.length > 0 ? `안녕하세요.\n${lines.join('\n')}\n부탁드립니다.\n감사합니다.` : '';
            })()
          : vendorService.buildQuantityMessage(vendor, selections)
        : vendorService.buildFixedMessage(vendor))
    );
  };

  const requireOrderMessage = (): string | null => {
    const message = getOrderMessage();
    if (!directOrderMessage && vendor.type === 'quantity' && !message) {
      showToast('체크된 품목이 없습니다.');
      return null;
    }
    return message;
  };

  const copyOrderMessage = async (message: string): Promise<boolean> => {
    const ok = await copyText(message);
    if (ok) {
      showToast('발주 내용이 복사되었습니다.');
    } else {
      showToast('복사에 실패했어요. 아래 내용을 직접 복사해주세요.');
      setFallbackMessage(message);
    }
    return ok;
  };

  const handleCopy = async () => {
    const message = requireOrderMessage();
    if (!message) return;
    await copyOrderMessage(message);
  };

  const handleKakaoShare = async () => {
    const message = requireOrderMessage();
    if (!message) return;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${vendor.name} 발주`,
          text: message,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    const copied = await copyOrderMessage(message);
    if (copied) {
      showToast('발주 내용을 복사했습니다. 카카오톡 채팅방에 붙여넣어주세요.');
      window.location.href = 'kakaotalk://';
    }
  };

  const handleSms = () => {
    const message = requireOrderMessage();
    if (!message) return;
    const phone = vendor.phone.replace(/\D/g, '');
    if (!phone) {
      showToast('업체 전화번호가 등록되어 있지 않습니다.', 'error');
      return;
    }
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  };

  const handleMarkOrdered = async () => {
    if (completing || !session) return;
    setCompleting(true);
    const completedAt = new Date().toISOString();
    vendorService.markOrdered(vendor.id, session.name);
    const localCompletion: OrderCompletion = {
      id: 'local',
      vendorId: vendor.id,
      vendorName: vendor.name,
      completedBy: session.employeeId,
      completedByName: session.name,
      completedAt,
    };
    if (isSharedCompletionVendor) setRecentOrder(localCompletion);
    showToast('발주 완료로 표시했습니다.');
    onChanged();
    try {
      const saved = await orderHistoryRepository.record({
        vendorId: vendor.id,
        vendorName: vendor.name,
        completedBy: session.employeeId,
        completedByName: session.name,
      });
      if (isSharedCompletionVendor) setRecentOrder(saved);
    } catch {
      // DB 마이그레이션 적용 전에도 로컬 완료 상태와 즉시 갱신은 유지합니다.
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelOrdered = async () => {
    if (completing || !session) return;
    setCompleting(true);
    try {
      await orderHistoryRepository.deleteToday(vendor.id);
      vendorService.cancelTodayOrder(vendor.id);
      if (isSharedCompletionVendor) {
        const latest = await orderHistoryRepository.findLatest(vendor.id);
        setRecentOrder(latest);
      }
      showToast('오늘 발주 완료를 취소했습니다.');
      onChanged();
    } catch {
      showToast('발주 완료 취소에 실패했습니다.', 'error');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Card hover className="space-y-4">
      {/* 헤더: 아이콘 + 거래처명 + 상태 + 수정 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="card-icon w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-red-light to-[#DDEEFF] flex items-center justify-center shrink-0">
            <Store size={19} className="text-brand-red" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-ink truncate">{vendor.name}</p>
            <span
              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                ordered ? 'text-status-rejected' : 'text-status-working'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${ordered ? 'bg-status-rejected' : 'bg-status-working'}`} />
              {ordered ? '오늘 발주완료' : '미발주'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          aria-label={`${vendor.name} 담당자 및 전화번호 수정`}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full text-ink-faint hover:bg-brand-beige-light press-scale"
        >
          <Pencil size={16} />
        </button>
      </div>

      {!isKimchiVendor && (
        <p className="text-xs text-ink-faint">마지막 발주 · {lastOrderText ?? '기록 없음'}</p>
      )}

      {isKimchiVendor && (
        <div className="rounded-[20px] bg-[#F7F9FC] p-4 ring-1 ring-black/[0.04]">
          <p className="text-[11px] font-semibold text-ink-faint">최근 발주</p>
          {recentOrder ? (
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">
                  {vendorService.formatLastOrder(recentOrder.completedAt)}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  발주자 · {recentOrder.completedByName}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-status-working-bg px-2.5 py-1 text-[10px] font-bold text-status-working">
                발주 완료
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm font-medium text-ink-faint">아직 발주 기록이 없습니다.</p>
          )}
        </div>
      )}

      {/* 직접 메시지형 거래처는 상품/수량/고정발주 영역을 렌더링하지 않습니다. */}
      {directOrderMessage && (
        <div className="rounded-2xl bg-brand-beige-light px-4 py-4 text-[14px] font-medium leading-relaxed text-ink">
          {directOrderMessage}
        </div>
      )}
      {!directOrderMessage && (vendor.type === 'quantity' ? (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full flex items-center justify-between text-sm font-semibold text-ink py-1"
          >
            <span>
              품목 {vendor.items?.length ?? 0}개 {selectedCount > 0 && `· ${selectedCount}개 선택됨`}
            </span>
            <ChevronDown size={16} className={`text-ink-faint transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={loadDefaults}
            className="w-full text-sm font-bold text-brand-red bg-brand-red-light border border-brand-red/10 rounded-2xl py-3 mt-3 press-scale hover:-translate-y-0.5"
          >
            기본 발주 불러오기
          </button>
          {expanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4">
              {(vendor.items ?? []).map((item) => {
                const sel = selections[item.id];
                const display = productDisplayParts(vendor.name, item.name);
                return (
                  <div
                    key={item.id}
                    className="min-h-[128px] h-full flex flex-col justify-between gap-5 rounded-2xl bg-white border border-black/[0.07] px-4 py-4 sm:px-5 shadow-[0_1px_2px_rgba(0,0,0,.025),0_8px_24px_-18px_rgba(0,0,0,.24)] transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:shadow-[0_2px_4px_rgba(0,0,0,.035),0_14px_30px_-18px_rgba(0,0,0,.3)]"
                  >
                    <label className="flex items-center gap-3 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sel?.checked ?? false}
                        onChange={() => toggleCheck(item.id)}
                        className="w-5 h-5 accent-brand-red shrink-0 cursor-pointer"
                      />
                      <span className="min-w-0 leading-snug">
                        <span className="font-bold text-[15px] text-ink">{display.name}</span>
                        {display.specification && (
                          <span className="ml-1.5 text-sm font-medium text-ink-faint">
                            ({display.specification})
                          </span>
                        )}
                      </span>
                    </label>
                    <div className="flex items-center justify-end gap-2 shrink-0 self-end">
                      <button
                        onClick={() => setQty(item.id, (sel?.qty ?? 1) - 1)}
                        aria-label={`${display.name} 수량 줄이기`}
                        className="w-9 h-9 rounded-xl bg-brand-beige-light text-ink flex items-center justify-center press-scale hover:bg-brand-beige"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        value={sel?.qty ?? 1}
                        onChange={(e) => setQty(item.id, Number(e.target.value) || 1)}
                        aria-label={`${display.name} 수량`}
                        className="w-12 h-9 text-center rounded-xl border border-black/[0.07] bg-white text-sm tabular-num"
                      />
                      <button
                        onClick={() => setQty(item.id, (sel?.qty ?? 1) + 1)}
                        aria-label={`${display.name} 수량 늘리기`}
                        className="w-9 h-9 rounded-xl bg-brand-beige-light text-ink flex items-center justify-center press-scale hover:bg-brand-beige"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-status-working-bg px-4 py-3.5">
          <p className="text-xs text-ink-faint mb-0.5">매주 고정 발주</p>
          <p className="font-bold text-ink tabular-num">
            {vendor.fixedOrder?.itemName} {vendor.fixedOrder?.quantity}{vendor.fixedOrder?.unit}
          </p>
        </div>
      ))}

      <div className="grid grid-cols-2 gap-2 pt-1">
        {usesKakaoShare ? (
          <button
            onClick={handleKakaoShare}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-3 py-3.5 text-sm font-bold text-[#191919] press-scale"
          >
            <MessageCircle size={19} />
            <span>카카오톡 공유</span>
          </button>
        ) : (
          <button
            onClick={handleSms}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-red px-3 py-3.5 text-sm font-bold text-white press-scale"
          >
            <Smartphone size={19} />
            <span>문자 보내기</span>
          </button>
        )}
        <button
          onClick={handleCopy}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-red-light px-3 py-3.5 text-sm font-bold text-brand-red press-scale"
        >
          <Copy size={19} />
          <span>내용 복사</span>
        </button>
      </div>

      <button
        onClick={ordered ? () => setCancelConfirmOpen(true) : handleMarkOrdered}
        disabled={completing}
        className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold text-white press-scale disabled:opacity-50 ${
          ordered ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-red hover:bg-brand-red/90'
        }`}
      >
        {ordered ? <RotateCcw size={18} /> : <CheckCircle2 size={18} />}
        <span>
          {completing ? '처리 중...' : ordered ? '✔ 발주 완료 (취소)' : '발주 완료'}
        </span>
      </button>

      <p className="text-[11px] text-ink-faint text-center -mt-1">
        {vendor.contactName} · {phoneDisplay}
      </p>

      {editOpen && <VendorEditModal vendor={vendor} onClose={() => setEditOpen(false)} onSaved={onChanged} />}

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="오늘 발주 완료를 취소하시겠습니까?"
        description="오늘 완료 시간과 완료한 직원 정보가 삭제되며, 과거 발주 기록은 유지됩니다."
        confirmLabel="확인"
        danger
        onConfirm={handleCancelOrdered}
        onClose={() => setCancelConfirmOpen(false)}
      />

      {fallbackMessage && (
        <Modal open onClose={() => setFallbackMessage(null)} title="발주 내용">
          <p className="text-xs text-ink-soft mb-2">자동 복사에 실패했어요. 아래 내용을 길게 눌러 직접 복사해주세요.</p>
          <textarea
            readOnly
            value={fallbackMessage}
            rows={6}
            className="w-full rounded-2xl border border-border p-4 text-sm text-ink mb-4"
            onFocus={(e) => e.currentTarget.select()}
          />
        </Modal>
      )}
    </Card>
  );
}
