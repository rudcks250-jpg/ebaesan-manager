import { orderRepository } from '@/repositories/orderRepository';
import { vendorRepository } from '@/repositories/vendorRepository';
import { noticeRepository } from '@/repositories/noticeRepository';
import { seedOrderItems, seedVendors } from '@/data/mockData';

// 직원관리/스케줄/근로시간/휴무신청/급여관리는 Supabase로 이전되어 더 이상
// localStorage 목데이터를 심지 않습니다 (supabase/schema.sql로 테이블을 만들고
// Supabase 대시보드에서 초기 데이터를 등록해주세요).
//
// 발주관리(order/vendor)와 공지사항(notice)은 이번 이전 범위에 포함되지 않아
// 계속 localStorage 목데이터를 사용합니다.
export function seedDevDataIfNeeded(): void {
  orderRepository.seedIfEmpty(seedOrderItems);
  vendorRepository.seedIfEmpty(seedVendors);
  noticeRepository.seedIfEmpty();
}
