import type { WageType } from '@/data/types';

export interface ManagedEmployeeRecord {
  key: string;
  name: string;
  phone: string;
  position: '직원' | '파트타임';
  wageType: WageType;
  payday: string;
  hourlyWage?: number;
  monthlySalary?: number;
}

export const MANAGED_EMPLOYEE_ROSTER: readonly ManagedEmployeeRecord[] = [
  { key: 'kim-gyeong-jae', name: '김경재', phone: '01097929156', position: '직원', wageType: 'monthly', payday: '매월 4일', monthlySalary: 3_400_000 },
  { key: 'kim-ha-eun', name: '김하은', phone: '01076491940', position: '직원', wageType: 'monthly', payday: '매월 18일', monthlySalary: 3_000_000 },
  { key: 'chaerin', name: '채린', phone: '01096451415', position: '파트타임', wageType: 'hourly', payday: '매월 4일', hourlyWage: 13_000 },
  { key: 'hue', name: '후에', phone: '01022126568', position: '파트타임', wageType: 'hourly', payday: '매주 일요일', hourlyWage: 14_000 },
  { key: 'chau', name: '차우', phone: '01051792368', position: '파트타임', wageType: 'hourly', payday: '매월 말일', hourlyWage: 13_000 },
  { key: 'gu-dong-uk', name: '구동욱', phone: '01026703753', position: '파트타임', wageType: 'hourly', payday: '매월 1일', hourlyWage: 13_000 },
  { key: 'lee-do-yun', name: '이도윤', phone: '01051178535', position: '파트타임', wageType: 'hourly', payday: '매월 13일', hourlyWage: 13_000 },
  { key: 'seo-jin-hun', name: '서진훈', phone: '01091738233', position: '파트타임', wageType: 'hourly', payday: '매월 15일', hourlyWage: 13_000 },
  { key: 'lee-cheol-yeong', name: '이철영', phone: '01026743742', position: '파트타임', wageType: 'hourly', payday: '매월 1일', hourlyWage: 14_000 },
  { key: 'yu-jun-yeong', name: '유준영', phone: '01085460643', position: '파트타임', wageType: 'hourly', payday: '매월 23일', hourlyWage: 14_000 },
  { key: 'yu-gyeong-jin', name: '유경진', phone: '', position: '파트타임', wageType: 'hourly', payday: '매월 23일', hourlyWage: 13_000 },
  { key: 'phuong-an', name: '프엉 안', phone: '', position: '파트타임', wageType: 'hourly', payday: '매월 15일', hourlyWage: 13_000 },
  { key: 'tuan', name: '투안', phone: '0105753292', position: '파트타임', wageType: 'hourly', payday: '매월 17일', hourlyWage: 13_000 },
];
