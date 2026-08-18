import { storage, STORAGE_KEYS } from '@/data/storage';
import { orderRepository } from '@/repositories/orderRepository';
import { vendorRepository } from '@/repositories/vendorRepository';
import { noticeRepository } from '@/repositories/noticeRepository';
import { coupangItems, jiwooFoodItems, seedOrderItems, seedVendors } from '@/data/mockData';
import type { Vendor, VendorItem } from '@/data/types';

const BEVERAGE_ITEMS: VendorItem[] = [
  { id: 'item_cola', name: '콜라', unit: '개', defaultQty: 2 },
  { id: 'item_zero_cola', name: '제로콜라', unit: '개', defaultQty: 2 },
  { id: 'item_cider', name: '사이다', unit: '개', defaultQty: 2 },
  { id: 'item_fanta', name: '환타', unit: '개', defaultQty: 2 },
];

const LIQUOR_ITEMS: VendorItem[] = [
  { id: 'item_kelly', name: '켈리', unit: '병', defaultQty: 1 },
  { id: 'item_terra', name: '테라', unit: '병', defaultQty: 1 },
  { id: 'item_cass', name: '카스', unit: '병', defaultQty: 1 },
  { id: 'item_kloud', name: '클라우드', unit: '병', defaultQty: 1 },
  { id: 'item_saero', name: '새로', unit: '병', defaultQty: 1 },
  { id: 'item_jinro', name: '진로', unit: '병', defaultQty: 1 },
  { id: 'item_chum_churum', name: '처음처럼', unit: '병', defaultQty: 1 },
  { id: 'item_chamisul', name: '참이슬', unit: '병', defaultQty: 1 },
  { id: 'item_tsingtao', name: '칭따오', unit: '병', defaultQty: 1 },
];

const REMOVED_JIWOO_PRODUCT_NAMES = new Set(['미니깐마늘', '쇼리마늘']);
const BOX_MEAT_PRODUCT_NAMES = new Set(['삼겹살', '목살', '껍데기', '항정살']);

function migrateJiwooFoodItem(item: VendorItem): VendorItem | undefined {
  if (
    item.id === 'item_shori_garlic' ||
    REMOVED_JIWOO_PRODUCT_NAMES.has(item.name)
  ) {
    return undefined;
  }

  if (item.id === 'item_cucumber' || ['백오이', '오이'].includes(item.name)) {
    return { ...item, name: '청오이', unit: '개' };
  }
  if (
    item.id === 'item_mushroom' ||
    ['새송이버섯', '버섯'].includes(item.name)
  ) {
    return { ...item, name: '총알새송이버섯', unit: '2kg' };
  }
  if (item.id === 'item_gochujang' || item.name === '고추장') {
    return { ...item, name: '태양초고추장', unit: '14kg' };
  }
  if (item.id === 'item_haedeun_milmyeon' || item.name === '밀면') {
    return { ...item, name: '해든밀면' };
  }
  if (
    item.id === 'item_ssamjang' ||
    ['쌈장', '순창궁 쌈장'].includes(item.name)
  ) {
    return { ...item, name: '순창궁 쌈장', unit: '14kg' };
  }
  if (
    item.id === 'item_nitrile_gloves' ||
    ['니트릴장갑', '니트릴 장갑'].includes(item.name)
  ) {
    return { ...item, name: '니트릴장갑 L', unit: 'L' };
  }
  return item;
}

function syncJiwooFoodCatalog(): void {
  const vendor = vendorRepository.findById('vendor_grocery');
  if (!vendor) return;

  const migratedItems: VendorItem[] = [];
  const migratedNames = new Set<string>();
  for (const existingItem of vendor.items ?? []) {
    const migratedItem = migrateJiwooFoodItem(existingItem);
    if (!migratedItem || migratedNames.has(migratedItem.name)) continue;
    migratedItems.push(migratedItem);
    migratedNames.add(migratedItem.name);
  }

  const existingNames = new Set(migratedItems.map((item) => item.name));
  const missingItems = jiwooFoodItems.filter((item) => !existingNames.has(item.name));
  const nextItems = [...migratedItems, ...missingItems];
  const catalogChanged = JSON.stringify(vendor.items ?? []) !== JSON.stringify(nextItems);

  if (vendor.name !== '지우푸드' || catalogChanged) {
    vendorRepository.update(vendor.id, {
      name: '지우푸드',
      items: nextItems,
      updatedAt: new Date().toISOString(),
    });
  }
}

function syncVendorCatalogs(): void {
  const coupangVendor = vendorRepository.findById('vendor_coupang');
  if (coupangVendor) {
    const existingItems = coupangVendor.items ?? [];
    const existingNames = new Set(existingItems.map((item) => item.name));
    const missingItems = coupangItems.filter((item) => !existingNames.has(item.name));
    if (missingItems.length > 0) {
      vendorRepository.update(coupangVendor.id, {
        items: [...existingItems, ...missingItems],
      });
    }
  }

  const meatVendor = vendorRepository.findById('vendor_meat');
  if (meatVendor) {
    const meatItems = (meatVendor.items ?? []).map((item) =>
      BOX_MEAT_PRODUCT_NAMES.has(item.name) ? { ...item, unit: '박스' } : item
    );
    if (!meatItems.some((item) => item.name === '껍데기')) {
      meatItems.push({ id: 'item_pork_skin', name: '껍데기', unit: '박스', defaultQty: 1 });
    }
    vendorRepository.update(meatVendor.id, {
      items: meatItems,
    });
  }

  const beverageVendor = vendorRepository.findById('vendor_beverage');
  if (beverageVendor) {
    vendorRepository.update(beverageVendor.id, {
      name: '음료 유통',
      items: BEVERAGE_ITEMS,
    });
  }

  const liquorVendor = vendorRepository.findById('vendor_liquor');
  if (liquorVendor) {
    vendorRepository.update(liquorVendor.id, { items: LIQUOR_ITEMS });
  }

  const charcoalVendor = vendorRepository.findById('vendor_fixed_charcoal');
  if (charcoalVendor) {
    vendorRepository.update(charcoalVendor.id, {
      name: '비제이 무역',
      type: 'fixed',
      items: undefined,
      fixedOrder: undefined,
    });
  }

  const mugeunjiVendor = vendorRepository.findById('vendor_fixed_kimchi');
  if (mugeunjiVendor) {
    vendorRepository.update(mugeunjiVendor.id, {
      name: '태서김치',
      contactName: '태서김치',
      phone: '01027491490',
      type: 'fixed',
      items: undefined,
      fixedOrder: undefined,
    });
  }

  const vendors = storage.get<Vendor[]>(STORAGE_KEYS.vendors) ?? [];
  const withoutSeedJeotgal = vendors.filter((vendor) => vendor.id !== 'vendor_fixed_sauce');
  const requiredVendorIds = new Set(['vendor_fixed_lpg', 'vendor_coupang']);
  const missingVendors = seedVendors.filter(
    (vendor) => requiredVendorIds.has(vendor.id) && !withoutSeedJeotgal.some((saved) => saved.id === vendor.id)
  );
  const nextVendors = [...withoutSeedJeotgal, ...missingVendors];
  if (JSON.stringify(nextVendors) !== JSON.stringify(vendors)) {
    storage.set(STORAGE_KEYS.vendors, nextVendors);
  }
}

// 직원관리/스케줄/근로시간/휴무신청/급여관리는 Supabase로 이전되어 더 이상
// localStorage 목데이터를 심지 않습니다 (supabase/schema.sql로 테이블을 만들고
// Supabase 대시보드에서 초기 데이터를 등록해주세요).
//
// 발주관리(order/vendor)와 공지사항(notice)은 이번 이전 범위에 포함되지 않아
// 계속 localStorage 목데이터를 사용합니다.
export function seedDevDataIfNeeded(): void {
  if (storage.isSeeded()) {
    syncJiwooFoodCatalog();
    syncVendorCatalogs();
    return;
  }

  orderRepository.seedIfEmpty(seedOrderItems);
  vendorRepository.seedIfEmpty(seedVendors);
  noticeRepository.seedIfEmpty();
  syncJiwooFoodCatalog();
  syncVendorCatalogs();

  storage.markSeeded();
}
