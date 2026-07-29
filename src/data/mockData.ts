// =========================================================
// 개발 모드 초기 데이터 (Seed Data)
// -----------------------------------------------------------
// 실제 서비스로 전환할 때는 이 파일과 이 파일을 호출하는
// seed.ts만 제거하면 됩니다. (다른 코드는 이 파일에 의존하지 않음)
// =========================================================

import { simpleHash } from '@/utils/hash';
import { formatDate, addDays, getMondayOfWeek, todayStr } from '@/utils/date';
import type {
  Employee,
  EmployeeCredential,
  ScheduleWeek,
  ShiftEntry,
  LeaveRequest,
  WorkTimeRecord,
  OrderItem,
  Vendor,
  Notice,
} from '@/data/types';

const now = new Date().toISOString();

function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ---------------------------------------------------------
// 직원
// ---------------------------------------------------------
export const seedEmployees: Employee[] = [
  {
    id: 'emp_admin',
    name: 'admin',
    phone: '010-0000-0000',
    role: 'admin',
    position: '점장',
    wageType: 'monthly',
    monthlySalary: 3500000,
    payday: '매월 25일',
    status: 'active',
    hireDate: '2023-01-01',
    isFirstLogin: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_hall1',
    name: '김하은',
    phone: '010-1234-5678',
    role: 'employee',
    position: '홀',
    wageType: 'hourly',
    hourlyWage: 10500,
    payday: '매월 10일',
    status: 'active',
    hireDate: '2024-03-02',
    isFirstLogin: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_kitchen1',
    name: '박주방',
    phone: '010-2222-3333',
    role: 'employee',
    position: '주방',
    wageType: 'hourly',
    hourlyWage: 11500,
    payday: '매월 5일',
    status: 'active',
    hireDate: '2023-11-10',
    isFirstLogin: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_hourly1',
    name: '이시급',
    phone: '010-4444-5555',
    role: 'employee',
    position: '홀',
    wageType: 'hourly',
    hourlyWage: 10030,
    payday: '매월 15일',
    status: 'active',
    hireDate: '2025-01-15',
    isFirstLogin: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'emp_monthly1',
    name: '최월급',
    phone: '010-6666-7777',
    role: 'employee',
    position: '매니저',
    wageType: 'monthly',
    monthlySalary: 2800000,
    payday: '매월 말일',
    status: 'active',
    hireDate: '2022-06-01',
    isFirstLogin: true,
    createdAt: now,
    updatedAt: now,
  },
];

export const seedCredentials: EmployeeCredential[] = [
  { employeeId: 'emp_admin', passwordHash: simpleHash('admin1234') },
  ...seedEmployees
    .filter((e) => e.id !== 'emp_admin')
    .map((e) => ({
      employeeId: e.id,
      passwordHash: simpleHash(phoneDigits(e.phone)),
    })),
];

// ---------------------------------------------------------
// 스케줄 (이번주 / 다음주)
// ---------------------------------------------------------
const thisMonday = formatDate(getMondayOfWeek(new Date()));
const nextMonday = formatDate(addDays(getMondayOfWeek(new Date()), 7));

function buildWeekShifts(weekStartDate: string): ShiftEntry[] {
  const staffIds = ['emp_hall1', 'emp_kitchen1', 'emp_hourly1', 'emp_monthly1'];
  const shifts: ShiftEntry[] = [];
  const patterns: Record<string, { start: string; end: string }> = {
    emp_hall1: { start: '10:00', end: '19:00' },
    emp_kitchen1: { start: '11:00', end: '21:00' },
    emp_hourly1: { start: '16:30', end: '23:00' },
    emp_monthly1: { start: '09:00', end: '18:00' },
  };
  const monday = new Date(
    Number(weekStartDate.slice(0, 4)),
    Number(weekStartDate.slice(5, 7)) - 1,
    Number(weekStartDate.slice(8, 10))
  );
  for (let i = 0; i < 7; i++) {
    const date = formatDate(addDays(monday, i));
    staffIds.forEach((employeeId, idx) => {
      const isOff = (i + idx) % 6 === 5; // 직원마다 요일을 다르게 쉬도록
      const pattern = patterns[employeeId];
      shifts.push({
        id: `shift_${weekStartDate}_${employeeId}_${date}`,
        employeeId,
        date,
        startTime: isOff ? null : pattern.start,
        endTime: isOff ? null : pattern.end,
        status: isOff ? 'off' : 'working',
        source: 'manual',
        updatedAt: now,
        updatedBy: 'emp_admin',
      });
    });
  }
  return shifts;
}

export const seedSchedules: ScheduleWeek[] = [
  { id: `week_${thisMonday}`, weekStartDate: thisMonday, shifts: buildWeekShifts(thisMonday) },
  { id: `week_${nextMonday}`, weekStartDate: nextMonday, shifts: buildWeekShifts(nextMonday) },
];

// ---------------------------------------------------------
// 휴무 신청
// ---------------------------------------------------------
const nextWeekWednesday = formatDate(addDays(getMondayOfWeek(new Date()), 9));
const nextWeekFriday = formatDate(addDays(getMondayOfWeek(new Date()), 11));

export const seedLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave_seed_pending',
    employeeId: 'emp_hall1',
    requestedDate: nextWeekWednesday,
    reason: '개인 사정으로 휴무 신청합니다.',
    leaveType: 'regular',
    status: 'pending',
    createdAt: now,
  },
  {
    id: 'leave_seed_approved',
    employeeId: 'emp_kitchen1',
    requestedDate: nextWeekFriday,
    reason: '가족 행사 참석',
    leaveType: 'regular',
    status: 'approved',
    createdAt: now,
    processedAt: now,
    processedBy: 'emp_admin',
  },
];

// ---------------------------------------------------------
// 근로시간
// ---------------------------------------------------------
const yesterday = formatDate(addDays(new Date(), -1));
const twoDaysAgo = formatDate(addDays(new Date(), -2));

export const seedWorkTimeRecords: WorkTimeRecord[] = [
  {
    id: 'wt_seed_1',
    employeeId: 'emp_hall1',
    date: yesterday,
    clockIn: '10:02',
    clockOut: '19:05',
    breakMinutes: 30,
    workedMinutes: 8 * 60 + 33,
    isAutoClockIn: false,
    editHistory: [],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'wt_seed_2',
    employeeId: 'emp_kitchen1',
    date: twoDaysAgo,
    clockIn: '11:05',
    clockOut: '21:10',
    breakMinutes: 60,
    workedMinutes: 9 * 60 + 5,
    isAutoClockIn: false,
    editHistory: [],
    createdAt: now,
    updatedAt: now,
  },
  // 미입력 기록 (emp_hourly1의 어제 근무는 실제 기록이 없는 상태)
];

// ---------------------------------------------------------
// 발주 카테고리 샘플
// ---------------------------------------------------------
export const seedOrderItems: OrderItem[] = [
  { id: 'order_1', category: 'meat', name: '삼겹살', createdAt: now },
  { id: 'order_2', category: 'meat', name: '목살', createdAt: now },
  { id: 'order_3', category: 'vegetable', name: '상추', createdAt: now },
  { id: 'order_4', category: 'liquor', name: '소주', createdAt: now },
  { id: 'order_5', category: 'supplies', name: '냅킨', createdAt: now },
];

// ---------------------------------------------------------
// 발주관리 - 거래처 (수량 입력형 4곳 + 고정 발주형 3곳)
// ---------------------------------------------------------
export const jiwooFoodItems: NonNullable<Vendor['items']> = [
  { id: 'item_perilla', name: '깻잎', unit: '개', defaultQty: 2 },
  { id: 'item_lettuce', name: '상추', unit: '개', defaultQty: 3 },
  { id: 'item_onion', name: '양파', unit: '개', defaultQty: 2 },
  { id: 'item_pepper', name: '고추', unit: '개', defaultQty: 1 },
  { id: 'item_garlic', name: '마늘', unit: 'kg', defaultQty: 1 },
  { id: 'item_minced_garlic', name: '다진마늘', unit: 'kg', defaultQty: 1 },
  { id: 'item_cucumber', name: '청오이', unit: '개', defaultQty: 1 },
  { id: 'item_peeled_potato', name: '깐감자', unit: 'kg', defaultQty: 1 },
  { id: 'item_zucchini', name: '쥬키니', unit: '개', defaultQty: 1 },
  { id: 'item_mushroom', name: '총알새송이버섯', unit: '2kg', defaultQty: 1 },
  { id: 'item_gochujang', name: '태양초고추장', unit: '14kg', defaultQty: 1 },
  { id: 'item_pickled_radish_wrap', name: '쌈무', unit: '팩', defaultQty: 1 },
  { id: 'item_naengmyeon_kimchi', name: '냉면김치', unit: '팩', defaultQty: 1 },
  { id: 'item_sesame_oil', name: '참기름', unit: '병', defaultQty: 1 },
  { id: 'item_fried_rice_foil', name: '볶음밥용호일', unit: '개', defaultQty: 1 },
  { id: 'item_roasted_sesame', name: '볶은깨', unit: '봉', defaultQty: 1 },
  { id: 'item_soybean_powder', name: '콩가루', unit: '봉', defaultQty: 1 },
  { id: 'item_miwon', name: '미원', unit: '봉', defaultQty: 1 },
  { id: 'item_dashida', name: '다시다', unit: '봉', defaultQty: 1 },
  { id: 'item_flavored_salt', name: '맛소금', unit: '봉', defaultQty: 1 },
  { id: 'item_kelp', name: '다시마', unit: '봉', defaultQty: 1 },
  { id: 'item_wasabi', name: '와사비', unit: '개', defaultQty: 1 },
  { id: 'item_anchovy_fish_sauce', name: '멸치액젓', unit: '병', defaultQty: 1 },
  { id: 'item_vinegar_bulk', name: '식초말통', unit: '통', defaultQty: 1 },
  { id: 'item_soy_sauce_bulk', name: '간장말통', unit: '통', defaultQty: 1 },
  { id: 'item_wet_wipes', name: '물티슈', unit: '박스', defaultQty: 1 },
  { id: 'item_rice', name: '쌀', unit: '포', defaultQty: 1 },
  { id: 'item_sugar', name: '설탕', unit: '포', defaultQty: 1 },
  { id: 'item_mihwa_miso_16kg', name: '미화합동된장16kg', unit: '통', defaultQty: 1 },
  { id: 'item_sinsong_miso_16kg', name: '신송된장16kg', unit: '통', defaultQty: 1 },
  { id: 'item_green_onion', name: '대파', unit: '단', defaultQty: 1 },
  { id: 'item_egg', name: '계란', unit: '판', defaultQty: 1 },
  { id: 'item_water_parsley', name: '미나리', unit: '단', defaultQty: 1 },
  { id: 'item_broth_radish', name: '육수용무', unit: '개', defaultQty: 1 },
  { id: 'item_haedeun_milmyeon', name: '해든밀면', unit: '박스', defaultQty: 1 },
  { id: 'item_broth_anchovy', name: '육수용멸치', unit: '박스', defaultQty: 1 },
  { id: 'item_toilet_paper', name: '두루마리휴지', unit: '팩', defaultQty: 1 },
  { id: 'item_partner_table_napkin', name: '파트너테이블냅킨', unit: '박스', defaultQty: 1 },
  { id: 'item_sea_salt_20kg', name: '천일염20kg', unit: '포', defaultQty: 1 },
  { id: 'item_pickled_garlic_leaves', name: '명이나물', unit: '팩', defaultQty: 1 },
  { id: 'item_chojeong_bibim_sauce', name: '초정 비빔장', unit: '통', defaultQty: 1 },
  { id: 'item_nongmin_bone_broth', name: '농민 사골육수', unit: '박스', defaultQty: 1 },
  { id: 'item_codano_buldak_sauce', name: '코다노 불닭소스', unit: '통', defaultQty: 1 },
  { id: 'item_tofu', name: '두부', unit: '모', defaultQty: 1 },
  { id: 'item_ssamjang', name: '순창궁 쌈장', unit: '14kg', defaultQty: 1 },
  { id: 'item_lard_oil', name: '라드유', unit: '통', defaultQty: 1 },
  { id: 'item_fried_rice_cheese', name: '볶음밥 치즈', unit: '봉', defaultQty: 1 },
  { id: 'item_disposable_apron', name: '일회용 앞치마', unit: '팩', defaultQty: 1 },
  { id: 'item_cotton_gloves', name: '목장갑', unit: '켤레', defaultQty: 1 },
  { id: 'item_seaweed_flakes', name: '김가루', unit: '봉', defaultQty: 1 },
  { id: 'item_dish_soap', name: '주방세제', unit: '통', defaultQty: 1 },
  { id: 'item_paper_cup', name: '종이컵', unit: '줄', defaultQty: 1 },
  { id: 'item_nitrile_gloves', name: '니트릴장갑 L', unit: 'L', defaultQty: 1 },
];

export const seedVendors: Vendor[] = [
  {
    id: 'vendor_grocery',
    name: '지우푸드',
    contactName: '김민수',
    phone: '01011112222',
    type: 'quantity',
    items: jiwooFoodItems,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'vendor_meat',
    name: '좋은축산유통',
    contactName: '박정수',
    phone: '01022223333',
    type: 'quantity',
    items: [
      { id: 'item_pork_belly', name: '삼겹살', unit: 'kg', defaultQty: 5 },
      { id: 'item_pork_neck', name: '목살', unit: 'kg', defaultQty: 3 },
      { id: 'item_pork_jowl', name: '항정살', unit: 'kg', defaultQty: 2 },
      { id: 'item_pork_skin', name: '껍데기', unit: 'kg', defaultQty: 1 },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'vendor_beverage',
    name: '음료 유통',
    contactName: '이수진',
    phone: '01033334444',
    type: 'quantity',
    items: [
      { id: 'item_cola', name: '콜라', unit: '개', defaultQty: 2 },
      { id: 'item_zero_cola', name: '제로콜라', unit: '개', defaultQty: 2 },
      { id: 'item_cider', name: '사이다', unit: '개', defaultQty: 2 },
      { id: 'item_fanta', name: '환타', unit: '개', defaultQty: 2 },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'vendor_liquor',
    name: '독도다산주류',
    contactName: '최영호',
    phone: '01044445555',
    type: 'quantity',
    items: [
      { id: 'item_kelly', name: '켈리', unit: '병', defaultQty: 1 },
      { id: 'item_terra', name: '테라', unit: '병', defaultQty: 1 },
      { id: 'item_cass', name: '카스', unit: '병', defaultQty: 1 },
      { id: 'item_kloud', name: '클라우드', unit: '병', defaultQty: 1 },
      { id: 'item_saero', name: '새로', unit: '병', defaultQty: 1 },
      { id: 'item_jinro', name: '진로', unit: '병', defaultQty: 1 },
      { id: 'item_chum_churum', name: '처음처럼', unit: '병', defaultQty: 1 },
      { id: 'item_chamisul', name: '참이슬', unit: '병', defaultQty: 1 },
      { id: 'item_tsingtao', name: '칭따오', unit: '병', defaultQty: 1 },
    ],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'vendor_fixed_kimchi',
    name: '묵은지 업체',
    contactName: '홍길동',
    phone: '01000000000',
    type: 'fixed',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'vendor_fixed_charcoal',
    name: '비제이 무역',
    contactName: '김철수',
    phone: '01055556666',
    type: 'fixed',
    createdAt: now,
    updatedAt: now,
  },
];

// ---------------------------------------------------------
// 공지사항
// ---------------------------------------------------------
export const seedNotices: Notice[] = [
  {
    id: 'notice_1',
    title: '이번 주 회식 안내',
    content: '금요일 영업 종료 후 직원 회식이 있습니다. 참석 여부를 알려주세요.',
    createdAt: now,
    createdBy: 'emp_admin',
  },
];

export const SEED_TODAY = todayStr();
