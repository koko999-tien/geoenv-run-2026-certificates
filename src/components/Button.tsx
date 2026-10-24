import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-sm rounded-xl transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none';

    const variants = {
      primary:
        'bg-geoenv-600 text-white shadow-[0_8px_20px_-8px_rgba(30,95,196,0.5)] hover:bg-geoenv-700 focus:ring-geoenv-500',
      outline:
        'border border-slate-300 bg-white text-slate-700 hover:border-geoenv-400 hover:text-geoenv-700 focus:ring-geoenv-500',
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        disabled={disabled}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';