export interface EmployeeAccent {
  soft: string;
  text: string;
  dot: string;
  backgroundColor: string;
  color: string;
  dotColor: string;
}

const ACCENTS: readonly EmployeeAccent[] = [
  { soft: 'bg-[#EDF5FF]', text: 'text-[#356FAD]', dot: 'bg-[#6CA6E4]', backgroundColor: '#EDF5FF', color: '#356FAD', dotColor: '#6CA6E4' },
  { soft: 'bg-[#EDF8EF]', text: 'text-[#3D7B4B]', dot: 'bg-[#72B47E]', backgroundColor: '#EDF8EF', color: '#3D7B4B', dotColor: '#72B47E' },
  { soft: 'bg-[#F5F0FF]', text: 'text-[#7355A3]', dot: 'bg-[#9D82CA]', backgroundColor: '#F5F0FF', color: '#7355A3', dotColor: '#9D82CA' },
  { soft: 'bg-[#FFF4E8]', text: 'text-[#996426]', dot: 'bg-[#E4A65D]', backgroundColor: '#FFF4E8', color: '#996426', dotColor: '#E4A65D' },
  { soft: 'bg-[#FFF0F5]', text: 'text-[#A05272]', dot: 'bg-[#D988A7]', backgroundColor: '#FFF0F5', color: '#A05272', dotColor: '#D988A7' },
  { soft: 'bg-[#EAF8F6]', text: 'text-[#287A72]', dot: 'bg-[#64B5AC]', backgroundColor: '#EAF8F6', color: '#287A72', dotColor: '#64B5AC' },
  { soft: 'bg-[#F0F2FF]', text: 'text-[#5968A8]', dot: 'bg-[#8995D3]', backgroundColor: '#F0F2FF', color: '#5968A8', dotColor: '#8995D3' },
  { soft: 'bg-[#FFF7E5]', text: 'text-[#936B25]', dot: 'bg-[#DDB058]', backgroundColor: '#FFF7E5', color: '#936B25', dotColor: '#DDB058' },
  { soft: 'bg-[#EAF8FB]', text: 'text-[#327B89]', dot: 'bg-[#6DB8C5]', backgroundColor: '#EAF8FB', color: '#327B89', dotColor: '#6DB8C5' },
  { soft: 'bg-[#FFF0EF]', text: 'text-[#A6534D]', dot: 'bg-[#D98780]', backgroundColor: '#FFF0EF', color: '#A6534D', dotColor: '#D98780' },
  { soft: 'bg-[#ECF8F2]', text: 'text-[#397D60]', dot: 'bg-[#72B794]', backgroundColor: '#ECF8F2', color: '#397D60', dotColor: '#72B794' },
  { soft: 'bg-[#EEF7FC]', text: 'text-[#417B9C]', dot: 'bg-[#7DB3D0]', backgroundColor: '#EEF7FC', color: '#417B9C', dotColor: '#7DB3D0' },
  { soft: 'bg-[#FFF0F3]', text: 'text-[#A25266]', dot: 'bg-[#D88499]', backgroundColor: '#FFF0F3', color: '#A25266', dotColor: '#D88499' },
  { soft: 'bg-[#F4F0FF]', text: 'text-[#7057A0]', dot: 'bg-[#9A83C7]', backgroundColor: '#F4F0FF', color: '#7057A0', dotColor: '#9A83C7' },
];

const EMPLOYEE_ACCENT_INDEX: Record<string, number> = {
  박경찬: 0,
  김경재: 1,
  김하은: 2,
  채린: 3,
  차우: 4,
  구동욱: 5,
  이도윤: 6,
  서진훈: 7,
  유경진: 8,
  이철영: 9,
  후에: 10,
  유준영: 11,
  투안: 12,
  '프엉 안': 13,
};

export function getEmployeeAccent(name: string): EmployeeAccent {
  const fixedIndex = EMPLOYEE_ACCENT_INDEX[name];
  if (fixedIndex !== undefined) return ACCENTS[fixedIndex];

  const hash = Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0);
  return ACCENTS[hash % ACCENTS.length];
}
