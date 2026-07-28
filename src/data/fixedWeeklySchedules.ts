export interface FixedWeeklyShift {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
}

export interface FixedWeeklySchedule {
  employeeName: string;
  shifts: readonly FixedWeeklyShift[];
}

export const FIXED_WEEKLY_SCHEDULES: readonly FixedWeeklySchedule[] = [
  {
    employeeName: '투안',
    shifts: [
      { weekday: 5, startTime: '19:00', endTime: '23:00' },
      { weekday: 6, startTime: '18:30', endTime: '23:00' },
      { weekday: 0, startTime: '18:30', endTime: '23:00' },
    ],
  },
  {
    employeeName: '프엉 안',
    shifts: [
      { weekday: 1, startTime: '19:00', endTime: '23:00' },
      { weekday: 2, startTime: '19:00', endTime: '23:00' },
      { weekday: 3, startTime: '19:00', endTime: '23:00' },
      { weekday: 4, startTime: '19:00', endTime: '23:00' },
    ],
  },
];
