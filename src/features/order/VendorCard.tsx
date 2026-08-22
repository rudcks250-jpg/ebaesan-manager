import { useEffect, useState } from 'react';
import {
  Copy,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Minus,
  Plus,
  Store,
  MessageCircle,
  Smartphone,
  RotateCcw,
  History,
  Search,
  ArrowLeft,
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
  '굵은 고춧가루': { name: '굵은 고춧가루', specification: '1kg' },
  '고운 고춧가루': { name: '고운 고춧가루', specification: '1kg' },
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
  페이파타월: { name: '페이파타월', specification: '박스' },
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState<OrderCompletion[]>([]);
  const [selections, setSelections] = useState<ItemSelectionMap>(() =>
    Object.fromEntries((vendor.items ?? []).map((item) => [item.id, { checked: false, qty: 1 }]))
  );

  const lastOrderText = vendorService.formatLastOrder(vendor.lastOrderAt);
  const directOrderMessage = vendorService.getDirectOrderMessage(vendor);
  const phoneDisplay = vendorService.formatPhoneDisplay(vendor.phone);
  const selectedCount = Object.values(selections).filter((s) => s.checked).length;
  const isKimchiVendor = vendor.id === 'vendor_fixed_kimchi';
  const isLpgVendor = vendor.id === 'vendor_fixed_lpg';
  const isCoupangVendor = vendor.id === 'vendor_coupang';
  const showsDetailedRecentOrder = isKimchiVendor || isLpgVendor;
  const isSharedCompletionVendor =
    showsDetailedRecentOrder || vendor.id === 'vendor_fixed_charcoal';
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
    showToast('기본 발주 품목을 불러왔습니다.');
  };

  const orderedItems = [...(vendor.items ?? [])].sort((a, b) => {
    const aSelected = selections[a.id]?.checked ? 1 : 0;
    const bSelected = selections[b.id]?.checked ? 1 : 0;
    if (aSelected !== bSelected) return bSelected - aSelected;
    return (b.defaultQty ?? 1) - (a.defaultQty ?? 1);
  });
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase('ko-KR');
  const searchedItems = normalizedSearch
    ? orderedItems.filter((item) =>
        productDisplayName(vendor.name, item.name).toLocaleLowerCase('ko-KR').includes(normalizedSearch),
      )
    : orderedItems;
  const visibleItems = showAllItems || normalizedSearch ? searchedItems : searchedItems.slice(0, 6);
  const hiddenItemCount = Math.max(0, searchedItems.length - visibleItems.length);

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
      showToast(isLpgVendor ? '문자 내용이 복사되었습니다.' : '발주 내용이 복사되었습니다.');
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
    const localCompletion: OrderCompletion = {
      id: 'local',
      vendorId: vendor.id,
      vendorName: vendor.name,
      completedBy: session.employeeId,
      completedByName: session.name,
      completedAt,
    };
    try {
      const saved = await orderHistoryRepository.record({
        vendorId: vendor.id,
        vendorName: vendor.name,
        completedBy: session.employeeId,
        completedByName: session.name,
      });
      vendorService.markOrdered(vendor.id, session.name);
      if (isSharedCompletionVendor) setRecentOrder(saved);
      if (isLpgVendor) setOrderHistory((history) => [saved, ...history.filter((item) => item.id !== saved.id)]);
      showToast('발주 완료로 표시했습니다.');
      onChanged();
    } catch {
      if (isLpgVendor) {
        showToast('발주 기록 저장에 실패했습니다.', 'error');
      } else {
        // 기존 거래처는 DB 마이그레이션 적용 전의 로컬 완료 동작을 유지합니다.
        vendorService.markOrdered(vendor.id, session.name);
        if (isSharedCompletionVendor) setRecentOrder(localCompletion);
        showToast('발주 완료로 표시했습니다.');
        onChanged();
      }
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelOrdered = async () => {
    if (completing || !session) return;
    setCompleting(true);
    try {
      if (isLpgVendor && recentOrder && recentOrder.id !== 'local') {
        await orderHistoryRepository.deleteById(recentOrder.id);
      } else {
        await orderHistoryRepository.deleteToday(vendor.id);
      }
      vendorService.cancelTodayOrder(vendor.id);
      if (isSharedCompletionVendor) {
        const latest = await orderHistoryRepository.findLatest(vendor.id);
        setRecentOrder(latest);
        if (isLpgVendor) {
          setOrderHistory((history) => history.filter((item) => item.id !== recentOrder?.id));
        }
      }
      showToast('오늘 발주 완료를 취소했습니다.');
      onChanged();
    } catch {
      showToast('발주 완료 취소에 실패했습니다.', 'error');
    } finally {
      setCompleting(false);
    }
  };

  const handleOpenHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      setOrderHistory(await orderHistoryRepository.findAll(vendor.id));
    } catch {
      showToast('발주 이력을 불러오지 못했습니다.', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const formatHistoryDate = (iso: string) => {
    const date = new Date(iso);
    const dateText = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date).replace(/\. /g, '.').replace(/\.$/, '');
    const timeText = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
    return `${dateText} ${timeText}`;
  };

  const openPreview = () => {
    if (!requireOrderMessage()) return;
    setPreviewOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setPreviewOpen(false);
    setSearchQuery('');
    setShowAllItems(false);
  };

  return (
    <>
      <Card
        hover
        padded={false}
        role="button"
        tabIndex={0}
        onClick={() => setSheetOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') setSheetOpen(true);
        }}
        className="cursor-pointer p-4 sm:p-5"
      >
        <div className="flex items-center gap-3">
          <div className="card-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-red-light to-[#DDEEFF]">
            <Store size={19} className="text-brand-red" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-bold text-ink sm:text-lg">{vendor.name}</p>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${
                ordered ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-beige-light text-ink-faint'
              }`}>
                {ordered ? '발주완료' : '미발주'}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
              <span>{vendor.type === 'quantity' ? `${selectedCount}개 선택` : '고정 발주'}</span>
              <span aria-hidden="true">·</span>
              <span>마지막 발주 {recentOrder ? vendorService.formatLastOrder(recentOrder.completedAt) : (lastOrderText ?? '기록 없음')}</span>
            </div>
          </div>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setEditOpen(true);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`${vendor.name} 거래처 및 품목 수정`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-faint hover:bg-brand-beige-light press-scale"
          >
            <Pencil size={16} />
          </button>
          <ChevronRight size={18} className="shrink-0 text-ink-faint" />
        </div>
      </Card>

      <Modal
        open={sheetOpen}
        onClose={closeSheet}
        title={previewOpen ? '발주 내용 미리보기' : vendor.name}
        panelClassName="sm:max-w-2xl"
        footer={!previewOpen ? (
          <button
            type="button"
            onClick={openPreview}
            disabled={vendor.type === 'quantity' && selectedCount === 0}
            className="flex min-h-14 w-full items-center justify-between rounded-2xl bg-brand-red px-5 text-left text-white shadow-[0_8px_20px_-10px_rgba(0,122,255,.9)] press-scale disabled:cursor-not-allowed disabled:bg-ink-faint disabled:opacity-50"
          >
            <span>
              <span className="block text-xs font-semibold opacity-80">
                {vendor.type === 'quantity' ? `${selectedCount}개 품목 선택` : '고정 발주 내용'}
              </span>
              <span className="mt-0.5 block text-base font-bold">발주 예정 내용 확인</span>
            </span>
            <ChevronRight size={20} />
          </button>
        ) : undefined}
      >
        {previewOpen ? (
          <div className="space-y-4 pb-6">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-brand-red"
            >
              <ArrowLeft size={17} /> 품목 다시 선택
            </button>
            <div className="rounded-[22px] bg-brand-beige-light p-5">
              <p className="mb-2 text-xs font-bold text-ink-faint">발주 예정 내용</p>
              <pre className="whitespace-pre-wrap font-sans text-[15px] font-semibold leading-7 text-ink">{getOrderMessage()}</pre>
            </div>

            {isLpgVendor ? (
              <button onClick={handleCopy} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-red-light text-sm font-bold text-brand-red press-scale">
                <Copy size={19} /> 문자 내용 복사
              </button>
            ) : (
              <div className={`grid gap-2 ${isCoupangVendor ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {!isCoupangVendor && (usesKakaoShare ? (
                  <button onClick={handleKakaoShare} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#FEE500] px-3 text-sm font-bold text-[#191919] press-scale">
                    <MessageCircle size={19} /> 카카오톡 공유
                  </button>
                ) : (
                  <button onClick={handleSms} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-red px-3 text-sm font-bold text-white press-scale">
                    <Smartphone size={19} /> 문자 보내기
                  </button>
                ))}
                <button onClick={handleCopy} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-red-light px-3 text-sm font-bold text-brand-red press-scale">
                  <Copy size={19} /> 내용 복사
                </button>
              </div>
            )}

            <button
              onClick={ordered ? () => setCancelConfirmOpen(true) : handleMarkOrdered}
              disabled={completing}
              className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold text-white press-scale disabled:opacity-50 ${
                ordered ? 'bg-emerald-600' : 'bg-brand-red'
              }`}
            >
              {ordered ? <RotateCcw size={18} /> : <CheckCircle2 size={18} />}
              {completing ? '처리 중...' : ordered ? '✔ 발주 완료 (취소)' : '발주 완료'}
            </button>

            {isLpgVendor && (
              <button onClick={handleOpenHistory} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-black/[0.07] bg-white text-sm font-bold text-ink-soft press-scale">
                <History size={18} /> 발주 이력 보기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-5">
            <div className="flex items-center justify-between rounded-2xl bg-brand-beige-light px-4 py-3">
              <div>
                <p className={`text-sm font-bold ${ordered ? 'text-emerald-700' : 'text-ink'}`}>{ordered ? '오늘 발주완료' : '오늘 미발주'}</p>
                <p className="mt-0.5 text-xs text-ink-faint">마지막 발주 · {recentOrder ? vendorService.formatLastOrder(recentOrder.completedAt) : (lastOrderText ?? '기록 없음')}</p>
              </div>
              <span className="text-sm font-bold text-brand-red">{vendor.type === 'quantity' ? `${selectedCount}개 선택` : '고정 발주'}</span>
            </div>

            {vendor.type === 'quantity' ? (
              <>
                <button onClick={loadDefaults} className="min-h-12 w-full rounded-2xl border border-brand-red/10 bg-brand-red-light text-sm font-bold text-brand-red press-scale">
                  기본 발주 불러오기
                </button>
                <label className="relative block">
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="품목 검색"
                    className="h-12 w-full rounded-2xl border border-black/[0.07] bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-brand-red"
                  />
                </label>

                <div className="divide-y divide-black/[0.05] rounded-[22px] border border-black/[0.06] bg-white px-3 sm:px-4">
                  {visibleItems.map((item) => {
                    const sel = selections[item.id];
                    const display = productDisplayParts(vendor.name, item.name);
                    return (
                      <div key={item.id} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2.5">
                        <label className="flex min-w-0 cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={sel?.checked ?? false} onChange={() => toggleCheck(item.id)} className="h-5 w-5 shrink-0 accent-brand-red" />
                          <span className="min-w-0 leading-tight">
                            <span className="block truncate text-sm font-bold text-ink sm:text-[15px]">{display.name}</span>
                            <span className="mt-1 block truncate text-xs font-medium text-ink-faint">{display.specification || item.unit}</span>
                          </span>
                        </label>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button type="button" onClick={() => setQty(item.id, (sel?.qty ?? 1) - 1)} aria-label={`${display.name} 수량 줄이기`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-beige-light text-ink press-scale">
                            <Minus size={14} />
                          </button>
                          <input type="number" min={1} value={sel?.qty ?? 1} onChange={(event) => setQty(item.id, Number(event.target.value) || 1)} aria-label={`${display.name} 수량`} className="h-9 w-10 rounded-xl border border-black/[0.07] text-center text-sm font-bold tabular-nums text-ink" />
                          <button type="button" onClick={() => setQty(item.id, (sel?.qty ?? 1) + 1)} aria-label={`${display.name} 수량 늘리기`} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-beige-light text-ink press-scale">
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {visibleItems.length === 0 && <p className="py-8 text-center text-sm font-medium text-ink-faint">검색 결과가 없습니다.</p>}
                </div>

                {!normalizedSearch && searchedItems.length > 6 && (
                  <button type="button" onClick={() => setShowAllItems((current) => !current)} className="min-h-11 w-full rounded-xl text-sm font-bold text-brand-red press-scale">
                    {showAllItems ? '자주 쓰는 품목만 보기' : `전체 품목 보기 (+${hiddenItemCount})`}
                  </button>
                )}
              </>
            ) : (
              <div className="rounded-[22px] bg-brand-beige-light p-5">
                <p className="text-xs font-bold text-ink-faint">고정 발주 내용</p>
                <p className="mt-2 whitespace-pre-wrap text-[15px] font-semibold leading-7 text-ink">{getOrderMessage()}</p>
              </div>
            )}

            {(vendor.contactName || phoneDisplay) && (
              <p className="text-center text-xs text-ink-faint">{[vendor.contactName, phoneDisplay].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        )}
      </Modal>

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

      {isLpgVendor && historyOpen && (
        <Modal open onClose={() => setHistoryOpen(false)} title="LPG 가스 발주 이력">
          {historyLoading ? (
            <p className="py-8 text-center text-sm text-ink-faint">불러오는 중...</p>
          ) : orderHistory.length > 0 ? (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {orderHistory.map((item) => (
                <div key={item.id} className="rounded-2xl bg-brand-beige-light px-4 py-3.5">
                  <p className="text-sm font-bold tabular-nums text-ink">{formatHistoryDate(item.completedAt)}</p>
                  <p className="mt-1 text-sm font-semibold text-ink-soft">{item.completedByName}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm font-medium text-ink-faint">아직 발주 기록이 없습니다.</p>
          )}
        </Modal>
      )}
    </>
  );
}
