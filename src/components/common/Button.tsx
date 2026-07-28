import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-red text-white shadow-[0_6px_16px_-7px_rgba(0,122,255,.75)] hover:bg-brand-red-dark hover:-translate-y-0.5 active:bg-brand-red-dark',
  secondary:
    'bg-surface text-ink border border-black/[0.08] hover:bg-brand-beige-light disabled:text-ink-faint',
  ghost: 'bg-transparent text-ink-soft hover:bg-brand-beige-light disabled:text-ink-faint',
  danger: 'bg-surface text-status-rejected border border-status-rejected/20 hover:bg-status-rejected hover:text-white disabled:text-ink-faint',
};

// 높이 약 48~52px, 큰 radius(pill에 가깝게)
const SIZE_CLASSES: Record<Size, string> = {
  sm: 'text-sm px-4 py-2.5 rounded-xl min-h-[40px]',
  md: 'text-[15px] px-5 py-3 rounded-[14px] min-h-[48px]',
  lg: 'text-base px-6 py-3.5 rounded-2xl min-h-[52px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`font-semibold press-scale disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
