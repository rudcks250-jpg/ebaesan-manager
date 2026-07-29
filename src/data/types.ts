// =========================================================
// 이배산 업무관리 시스템 - 데이터 타입 정의
// 이 파일의 타입은 프로젝트 전체의 기준(PRD)입니다.
// 임의로 필드를 삭제하지 말고, 확장이 필요하면 옵셔널로 추가하세요.
// =========================================================

export type UserRole = 'admin' | 'manager' | 'employee';

export type WageType = 'hourly' | 'monthly';

export type EmployeeStatus = 'active' | 'inactive' | 'resigned';

// ---------------------------------------------------------
// 직원
// ---------------------------------------------------------
export interface Employee {
  id: string;
  name: string; // 로그인 아이디로 사용 (동명이인 가능 -> 내부 식별은 id 기준)
  phone: string; // 개인번호(전화번호), 초기 비밀번호로 사용
  role: UserRole;
  position: string; // 직책 (홀, 주방 등)
  wageType: WageType;
  hourlyWage?: number; // 시급제
  monthlySalary?: number; // 월급제
  payday?: string; // 급여일 (예: '매월 10일', '매월 말일')
  status: EmployeeStatus;
  hireDate: string; // YYYY-MM-DD
  resignDate?: string;
  isFirstLogin: boolean; // true면 로그인 후 비밀번호 변경 강제
  monthlyLeaveEligible?: boolean;
  lastLoginAt?: string; // 마지막 로그인 시각 (ISO)
  createdAt: string;
  updatedAt: string;
}

// 인증 정보는 직원 정보와 분리 저장 (평문 저장 구조와 분리 -> 추후 인증 서비스 교체 대비)
export interface EmployeeCredential {
  employeeId: string;
  passwordHash: string; // 프로토타입 단계에서는 간이 해시 사용
}

// ---------------------------------------------------------
// 스케줄 (주 단위 근무표)
// ---------------------------------------------------------
export type ShiftStatus = 'working' | 'off' | 'leaveApproved' | 'unscheduled';

export interface ShiftEntry {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD (해당 근무일, 월~일)
  startTime: string | null; // HH:mm, 휴무면 null
  endTime: string | null; // HH:mm, 다음날로 넘어가는 경우도 문자열 그대로 저장 (예: 익일 01:00)
  status: ShiftStatus;
  source: 'manual' | 'leaveApproved';
  memo?: string;
  updatedAt: string;
  updatedBy: string; // 처리한 관리자 employeeId
}

export interface ScheduleWeek {
  id: string;
  weekStartDate: string; // 해당 주 월요일 YYYY-MM-DD
  shifts: ShiftEntry[];
}

// ---------------------------------------------------------
// 휴무 신청
// ---------------------------------------------------------
export type LeaveStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'regular' | 'monthly';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  requestedDate: string; // 신청 대상 날짜 (차주 내) YYYY-MM-DD
  reason: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  rejectReason?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: string; // 관리자 employeeId
}

// ---------------------------------------------------------
// 근로시간 (실제 출퇴근 기록)
// ---------------------------------------------------------
export interface WorkTimeEditHistory {
  editedAt: string;
  editedBy: string; // employeeId (본인 or 관리자)
  note?: string;
}

export interface WorkTimeRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD (출근일 기준)
  clockIn: string | null; // HH:mm
  clockOut: string | null; // HH:mm (자정을 넘기면 계산 로직에서 +1일 처리)
  breakMinutes: number;
  workedMinutes: number | null; // 자동 계산 결과 (출퇴근 모두 입력되어야 계산됨)
  memo?: string;
  isAutoClockIn: boolean; // "출근하기" 버튼으로 기록된 것인지 여부
  editHistory: WorkTimeEditHistory[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------
// 급여관리 - 정산 상태 (근무시간 기반 급여 계산은 저장하지 않고 그때그때 계산합니다.
// 정산 완료 여부만 별도로 저장합니다.)
// ---------------------------------------------------------
export interface PayrollSettlement {
  employeeId: string;
  yearMonth: string; // 'YYYY-MM'
  settled: boolean;
  settledAt?: string;
}

// ---------------------------------------------------------
// 발주관리 (기본 틀)
// ---------------------------------------------------------
export type OrderCategory = 'meat' | 'vegetable' | 'liquor' | 'supplies' | 'etc';

export interface OrderItem {
  id: string;
  category: OrderCategory;
  name: string;
  vendor?: string; // 거래처 (추후 확장)
  unitPrice?: number; // 단가 (추후 확장)
  quantity?: number; // 수량 (추후 확장)
  cycle?: string; // 발주 주기 (추후 확장)
  completed?: boolean; // 발주 완료 여부 (추후 확장)
  createdAt: string;
}

// ---------------------------------------------------------
// 발주관리 - 거래처 기반 실사용 구조
// ---------------------------------------------------------
export type VendorType = 'quantity' | 'fixed';

// 수량 입력형 거래처의 품목 (체크박스 + 수량)
export interface VendorItem {
  id: string;
  name: string;
  unit: string; // kg, 개, 병, 박스 등
  defaultQty: number; // '기본 발주 불러오기' 시 사용되는 기본 수량
}

// 고정 발주형 거래처의 정해진 발주 내용
export interface FixedOrderSpec {
  itemName: string;
  quantity: number;
  unit: string;
}

export interface Vendor {
  id: string;
  name: string; // 거래처명
  contactName: string; // 담당자명
  phone: string; // 전화번호 (숫자만 저장)
  type: VendorType;
  items?: VendorItem[]; // type === 'quantity'인 경우 사용
  fixedOrder?: FixedOrderSpec; // type === 'fixed'인 경우 사용
  lastOrderAt?: string; // 마지막 발주 완료 시각 (ISO)
  lastOrderedByName?: string; // 로컬 즉시 표시용 마지막 발주자
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------
// 공지사항
// ---------------------------------------------------------
export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

// ---------------------------------------------------------
// 인증 세션
// ---------------------------------------------------------
export interface AuthSession {
  employeeId: string;
  name: string;
  role: UserRole;
}

// ---------------------------------------------------------
// 오픈 준비 체크리스트
// ---------------------------------------------------------
export interface OpeningPreparationItem {
  key: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
}

export interface OpeningPreparation {
  id: string;
  targetDate: string; // 실제 사용하는 날짜
  items: OpeningPreparationItem[];
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  updatedAt: string;
  updatedBy?: string;
}
