import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Full-panel loading state — replaces the bare centered Loader2 every module re-implemented. */
export const PanelSpinner = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center justify-center py-20', className)}>
    <Loader2 className="w-8 h-8 text-accent-red animate-spin" />
  </div>
);
