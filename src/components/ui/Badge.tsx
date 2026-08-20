import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand' | 'violet';

const TONE_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  brand: 'bg-soft-red text-accent-red border-accent-red/10',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
  brand: 'bg-accent-red',
  violet: 'bg-violet-500',
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  /** Small leading status dot instead of an icon. */
  dot?: boolean;
};

/**
 * Status/category pill. Every module previously hand-rolled its own
 * getStatusColor()/getPriorityColor() switch with inconsistent radius and
 * tracking — this is the single shared shape for all of them.
 */
export const Badge = ({ tone = 'neutral', dot, className, children, ...props }: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider whitespace-nowrap',
      TONE_CLASSES[tone],
      className,
    )}
    {...props}
  >
    {dot && <span className={cn('w-1.5 h-1.5 rounded-full', DOT_CLASSES[tone])} />}
    {children}
  </span>
);
