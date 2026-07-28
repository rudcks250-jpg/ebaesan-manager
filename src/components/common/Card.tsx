import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
  hover?: boolean;
}

export function Card({ children, className = '', padded = true, hover = false, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface/95 rounded-card border border-white/80 shadow-premium ring-1 ring-black/[0.035] ${hover ? 'card-hover' : ''} ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
