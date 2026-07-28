import type { ShiftEntry } from '@/data/types';
import { getEmployeeAccent } from '@/utils/employeeAccent';
import type { PointerEventHandler } from 'react';

function formatTime(value: string) {
  const [hours = '00', minutes = '00'] = value.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

function shortTime(value: string) {
  return value.endsWith(':00') ? String(Number(value.slice(0, 2))) : value;
}

export function ScheduleCell({
  shift,
  employeeName,
  isOwnRow,
  selected,
  preview,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  clickable,
}: {
  shift: ShiftEntry | undefined;
  employeeName: string;
  isOwnRow: boolean;
  selected: boolean;
  preview: boolean;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
  onPointerMove?: PointerEventHandler<HTMLButtonElement>;
  onPointerUp?: PointerEventHandler<HTMLButtonElement>;
  onPointerCancel?: PointerEventHandler<HTMLButtonElement>;
  clickable: boolean;
}) {
  const status = shift?.status ?? 'unscheduled';
  const startLabel = shift?.startTime ? formatTime(shift.startTime) : '';
  const endLabel = shift?.endTime ? formatTime(shift.endTime) : '';
  const working = status === 'working' && startLabel !== '' && endLabel !== '';
  const accent = getEmployeeAccent(employeeName);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      aria-label={
        working
          ? `${startLabel}부터 ${endLabel}까지 근무`
          : status === 'unscheduled'
            ? '스케줄 추가'
            : '휴무'
      }
      className={`group/cell flex min-h-11 w-full touch-pan-y select-none items-center justify-center rounded-[16px] px-1.5 transition-all duration-150 ${
        clickable ? 'cursor-pointer hover:bg-brand-red-light/45 active:scale-[.98]' : 'cursor-default'
      } ${isOwnRow ? 'bg-brand-red-light/20' : ''} ${
        selected ? 'bg-brand-red-light/70 shadow-[inset_0_0_0_2px_rgba(0,122,255,.28)]' : ''
      } ${preview ? 'bg-brand-red-light shadow-[inset_0_0_0_2px_rgba(0,122,255,.5)] scale-[.98]' : ''}`}
    >
      {working ? (
        <span
          className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-[14px] px-2.5 py-1.5 text-[14px] font-extrabold tabular-nums whitespace-nowrap transition-all duration-150 ${accent.soft} ${accent.text} ${
            clickable ? 'group-hover/cell:-translate-y-0.5 group-hover/cell:shadow-[0_8px_18px_-13px_rgba(0,0,0,.5)]' : ''
          }`}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${accent.dot}`} aria-hidden="true" />
          {shortTime(startLabel)}-{shortTime(endLabel)}
        </span>
      ) : status === 'unscheduled' ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F0F1F3] text-base font-medium text-ink-faint transition-all duration-150 group-hover/cell:bg-brand-red group-hover/cell:text-white group-hover/cell:shadow-[0_6px_14px_-8px_rgba(0,122,255,.8)]">
          ＋
        </span>
      ) : (
        <span className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[14px] bg-[#FFF0EF] px-3 py-1.5 text-[13px] font-bold text-[#B34E47] transition-all duration-150 group-hover/cell:-translate-y-0.5">
          <span className="h-2 w-2 rounded-full bg-[#DE8A84]" aria-hidden="true" />
          휴무
        </span>
      )}
    </button>
  );
}
