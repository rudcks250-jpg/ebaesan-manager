-- 이미 공용 발주 테이블을 적용한 운영 DB에 업체 소프트 삭제를 추가합니다.
alter table public.order_vendors
  add column if not exists deleted_at timestamptz;
