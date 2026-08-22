import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
}

export function Modal({ open, onClose, title, children, footer, panelClassName = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-[5px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full bg-surface rounded-t-[28px] sm:rounded-[24px] max-h-[88vh] flex flex-col animate-sheet-in shadow-premium-lg border border-white/70 ${panelClassName || 'sm:max-w-md'}`}
      >
        <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
          <h2 className="text-xl font-bold tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-ink-soft hover:text-ink w-8 h-8 flex items-center justify-center rounded-full bg-brand-beige-light hover:bg-brand-beige press-scale"
          >
            <X size={17} />
          </button>
        </div>
        <div className="px-6 overflow-y-auto grow">{children}</div>
        {footer && <div className="px-6 py-5 border-t border-border shrink-0">{footer}</div>}
      </div>
    </div>
  );
}
