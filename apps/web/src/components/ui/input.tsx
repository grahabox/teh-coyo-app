import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...props }: ComponentPropsWithRef<'input'>) {
  return (
    <input
      className={cn(
        'w-full min-h-11 rounded-xl border border-border bg-white px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-emerald-100 disabled:bg-muted aria-invalid:border-red-500 aria-invalid:focus:ring-red-100',
        className,
      )}
      {...props}
    />
  );
}
