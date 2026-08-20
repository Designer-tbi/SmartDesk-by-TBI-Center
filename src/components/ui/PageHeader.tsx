import React from 'react';

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/**
 * Consistent module page header: title + optional description on the left,
 * primary actions (usually a Button) right-aligned. Every module previously
 * threw its own ad hoc heading + button row together — this gives every
 * page the same rhythm at the top.
 */
export const PageHeader = ({ title, description, actions }: PageHeaderProps) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
      {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
    </div>
    {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
  </div>
);
