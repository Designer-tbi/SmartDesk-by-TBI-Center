import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Adds a hover lift + shadow — use for clickable/interactive cards. */
  interactive?: boolean;
  /** Removes the default padding (for cards that manage their own, e.g. tables). */
  noPadding?: boolean;
};

/**
 * Standard surface used across every module: white panel, subtle brand-tinted
 * border, soft shadow. Centralising this is what keeps radius/border/shadow
 * consistent instead of drifting per-module (rounded-2xl vs rounded-3xl,
 * border-red-100 vs border-slate-200, etc.).
 */
export const Card = ({ className, interactive, noPadding, children, ...props }: CardProps) => (
  <div
    className={cn(
      'bg-white rounded-2xl border border-red-100/80 shadow-sm',
      !noPadding && 'p-6',
      interactive && 'transition-all hover:shadow-md hover:border-red-200',
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between gap-4 mb-5', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-base font-bold text-slate-900 tracking-tight', className)} {...props}>
    {children}
  </h3>
);
