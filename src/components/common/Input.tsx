import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  children: ReactNode;
}

function FieldWrapper({ label, error, children }: FieldWrapperProps) {
  return (
    <label className="block mb-4">
      {label && <span className="block text-[13px] font-semibold text-ink-soft mb-2">{label}</span>}
      {children}
      {error && <span className="block text-xs text-status-rejected mt-1.5">{error}</span>}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...rest }: InputProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <input
        className={`w-full min-h-12 rounded-control border px-4 py-3 text-[15px] bg-brand-beige-light text-ink placeholder:text-ink-faint outline-none transition-all duration-200 focus:bg-surface focus:border-brand-red/60 focus:ring-4 focus:ring-brand-red/10 ${error ? 'border-status-rejected' : 'border-transparent'} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export function Select({ label, error, className = '', children, ...rest }: SelectProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <select
        className={`w-full min-h-12 rounded-control border px-4 py-3 text-[15px] text-ink outline-none transition-all duration-200 focus:bg-surface focus:border-brand-red/60 focus:ring-4 focus:ring-brand-red/10 bg-brand-beige-light ${error ? 'border-status-rejected' : 'border-transparent'} ${className}`}
        {...rest}
      >
        {children}
      </select>
    </FieldWrapper>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = '', ...rest }: TextareaProps) {
  return (
    <FieldWrapper label={label} error={error}>
      <textarea
        className={`w-full rounded-control border px-4 py-3 text-[15px] bg-brand-beige-light text-ink placeholder:text-ink-faint outline-none transition-all duration-200 focus:bg-surface focus:border-brand-red/60 focus:ring-4 focus:ring-brand-red/10 resize-none ${error ? 'border-status-rejected' : 'border-transparent'} ${className}`}
        rows={3}
        {...rest}
      />
    </FieldWrapper>
  );
}
