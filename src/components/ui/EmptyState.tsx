import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

/**
 * Shared "nothing here yet" panel. Replaces the italic gray one-liners that
 * were previously repeated (and worded differently) in almost every module's
 * table/list — a real icon + heading + helper text reads far more
 * intentional than a stray &lt;p&gt; in a table cell.
 */
export const EmptyState = ({ icon: Icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
    {Icon && (
      <div className="w-14 h-14 rounded-2xl bg-soft-red flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-accent-red" />
      </div>
    )}
    <h3 className="text-sm font-bold text-slate-700">{title}</h3>
    {description && <p className="text-sm text-slate-400 mt-1 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
