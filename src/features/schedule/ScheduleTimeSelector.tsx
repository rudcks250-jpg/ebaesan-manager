import { BriefcaseBusiness, Coffee, LogIn, LogOut } from 'lucide-react';

export const SCHEDULE_TIME_SLOTS = [
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00', '22:30',
  '23:00', '23:30',
] as const;

// 기존 관리자 스케줄 코드와의 호환성을 유지하되 단일 슬롯 source를 공유합니다.
export const SCHEDULE_START_TIMES = SCHEDULE_TIME_SLOTS;
export const SCHEDULE_END_TIMES = SCHEDULE_TIME_SLOTS;

type WorkStatus = 'working' | 'off';

interface ScheduleTimeSelectorProps {
  status: WorkStatus;
  startTime: string;
  endTime: string;
  onStatusChange: (status: WorkStatus) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  showStatus?: boolean;
}

const normalButton =
  'min-h-12 rounded-2xl border border-black/[0.07] bg-white px-3 text-sm font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.03),0_7px_18px_-14px_rgba(0,0,0,.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(0,0,0,.04),0_12px_24px_-14px_rgba(0,0,0,.35)] active:scale-[.98]';

export function ScheduleTimeSelector({
  status,
  startTime,
  endTime,
  onStatusChange,
  onStartTimeChange,
  onEndTimeChange,
  showStatus = true,
}: ScheduleTimeSelectorProps) {
  return (
    <div className="rounded-[22px] border border-white/80 bg-white/90 p-5 sm:p-6 shadow-premium ring-1 ring-black/[0.035]">
      {showStatus && <section>
        <div className="flex items-center gap-2 mb-3">
          <BriefcaseBusiness size={17} className="text-brand-red" />
          <h3 className="text-[15px] font-bold text-ink">근무 상태</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-brand-beige-light p-1.5">
          <button
            type="button"
            onClick={() => onStatusChange('working')}
            aria-pressed={status === 'working'}
            className={`min-h-12 rounded-[14px] flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 active:scale-[.98] ${
              status === 'working'
                ? 'bg-brand-red text-white shadow-[0_7px_18px_-10px_rgba(0,122,255,.8)]'
                : 'text-ink-soft hover:bg-white/70'
            }`}
          >
            <BriefcaseBusiness size={16} /> 정상근무
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('off')}
            aria-pressed={status === 'off'}
            className={`min-h-12 rounded-[14px] flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 active:scale-[.98] ${
              status === 'off'
                ? 'bg-status-rejected text-white shadow-[0_7px_18px_-10px_rgba(255,59,48,.65)]'
                : 'text-ink-soft hover:bg-white/70'
            }`}
          >
            <Coffee size={16} /> 휴무
          </button>
        </div>
      </section>}

      <div className={`grid transition-all duration-200 ${status === 'off' ? 'grid-rows-[0fr] opacity-40 mt-0' : `grid-rows-[1fr] opacity-100 ${showStatus ? 'mt-6' : 'mt-0'}`}`}>
        <div className="overflow-hidden">
          <section>
            <div className="flex items-center gap-2 mb-3">
              <LogIn size={17} className="text-status-working" />
              <h3 className="text-[15px] font-bold text-ink">근무 시작</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {SCHEDULE_START_TIMES.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => onStartTimeChange(time)}
                  aria-pressed={startTime === time}
                  className={`${normalButton} ${
                    startTime === time
                      ? '!border-transparent !bg-brand-red !text-white shadow-[0_8px_20px_-10px_rgba(0,122,255,.8)]'
                      : ''
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <LogOut size={17} className="text-status-pending" />
              <h3 className="text-[15px] font-bold text-ink">근무 종료</h3>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {SCHEDULE_END_TIMES.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => onEndTimeChange(time)}
                  aria-pressed={endTime === time}
                  className={`${normalButton} ${
                    endTime === time
                      ? '!border-transparent !bg-brand-red !text-white shadow-[0_8px_20px_-10px_rgba(0,122,255,.8)]'
                      : ''
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
