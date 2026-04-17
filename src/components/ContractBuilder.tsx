import React, { useState, useEffect, useMemo } from 'react';
import {
  BUILTIN_CONTRACT_TEMPLATES,
  renderContract,
  getTemplateById,
  ContractTemplateDef,
  ContractVariable,
} from '../lib/contractTemplates';
import { FileText, Sparkles, Eye, Pencil } from 'lucide-react';

export type ContractBuilderValue = {
  templateId?: string;
  type: 'CDI' | 'CDD' | 'Freelance' | 'Stage';
  content: string;
};

type AutofillContext = {
  companyName?: string;
  companyAddress?: string;
  companyRepresentative?: string;
  employeeName?: string;
  employeeAddress?: string;
  employeeRole?: string;
  employeeSalary?: number;
  contractStartDate?: string;
  city?: string;
};

function resolveAutofill(v: ContractVariable, ctx: AutofillContext): string {
  if (!v.autofill) return '';
  switch (v.autofill) {
    case 'companyName': return ctx.companyName || '';
    case 'companyAddress': return ctx.companyAddress || '';
    case 'companyRepresentative': return ctx.companyRepresentative || '';
    case 'employeeName': return ctx.employeeName || '';
    case 'employeeAddress': return ctx.employeeAddress || '';
    case 'employeeRole': return ctx.employeeRole || '';
    case 'employeeSalary': return ctx.employeeSalary ? String(ctx.employeeSalary) : '';
    case 'contractStartDate': return ctx.contractStartDate || '';
    case 'city': return ctx.city || '';
    case 'today': return new Date().toISOString().split('T')[0];
    default: return '';
  }
}

type Props = {
  autofillContext: AutofillContext;
  /**
   * Called whenever the generated content / type changes so the parent
   * can persist it into its own form state.
   */
  onChange: (value: ContractBuilderValue) => void;
  /** Initial values restored when editing an existing contract. */
  initialTemplateId?: string;
  /** Hides the preview toggle — useful for tests. */
  defaultToPreview?: boolean;
};

const VariableInput = ({
  v,
  value,
  onChange,
}: {
  v: ContractVariable;
  value: string;
  onChange: (val: string) => void;
}) => {
  const base =
    'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-red/20 outline-none';
  if (v.type === 'textarea') {
    return (
      <textarea
        className={`${base} min-h-[70px] resize-y`}
        placeholder={v.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`contract-var-${v.key}`}
      />
    );
  }
  return (
    <input
      type={v.type || 'text'}
      className={base}
      placeholder={v.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={`contract-var-${v.key}`}
    />
  );
};

export const ContractBuilder = ({
  autofillContext,
  onChange,
  initialTemplateId,
  defaultToPreview = false,
}: Props) => {
  const [templateId, setTemplateId] = useState<string | undefined>(initialTemplateId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(defaultToPreview);

  const template = useMemo<ContractTemplateDef | undefined>(
    () => (templateId ? getTemplateById(templateId) : undefined),
    [templateId],
  );

  // Re-seed autofilled values whenever the template or the autofill
  // context changes (e.g. user picks an employee).
  useEffect(() => {
    if (!template) return;
    const all: ContractVariable[] = [
      ...template.partiesVariables,
      ...template.articles.flatMap((a) => a.variables || []),
    ];
    setValues((prev) => {
      const next = { ...prev };
      for (const v of all) {
        const autoValue = resolveAutofill(v, autofillContext);
        // Only fill if the current value is empty — don't clobber typed input.
        if (autoValue && !next[v.key]) next[v.key] = autoValue;
      }
      return next;
    });
  }, [template, autofillContext]);

  // Emit the rendered contract whenever inputs change.
  useEffect(() => {
    if (!template) {
      onChange({ templateId, type: 'CDI', content: '' });
      return;
    }
    const content = renderContract(template, values, extras);
    onChange({ templateId: template.id, type: template.contractType, content });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template, values, extras]);

  const setValue = (key: string, val: string) =>
    setValues((p) => ({ ...p, [key]: val }));
  const setExtra = (id: string, val: string) =>
    setExtras((p) => ({ ...p, [id]: val }));

  return (
    <div className="space-y-6" data-testid="contract-builder-root">
      {/* Template picker */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
          Modèle de contrat
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BUILTIN_CONTRACT_TEMPLATES.map((tpl) => {
            const active = templateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplateId(tpl.id)}
                data-testid={`contract-template-${tpl.id}`}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'bg-accent-red/10 border-accent-red shadow-sm'
                    : 'bg-white border-slate-200 hover:border-accent-red/40 hover:bg-soft-red/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <FileText
                    className={`w-4 h-4 ${
                      active ? 'text-accent-red' : 'text-slate-400'
                    }`}
                  />
                  <span
                    className={`text-sm font-bold ${
                      active ? 'text-accent-red' : 'text-slate-900'
                    }`}
                  >
                    {tpl.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {tpl.tagline}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {!template && (
        <div className="text-xs text-slate-500 italic px-1">
          Choisissez un modèle pour afficher le formulaire adapté.
        </div>
      )}

      {template && (
        <>
          {/* Parties block */}
          <section className="space-y-3 p-4 bg-soft-red/10 rounded-xl border border-red-50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-red" />
              <h4 className="text-xs font-black text-accent-red uppercase tracking-widest">
                Parties au contrat
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {template.partiesVariables.map((v) => (
                <div key={v.key} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                    {v.label}
                  </label>
                  <VariableInput
                    v={v}
                    value={values[v.key] || ''}
                    onChange={(val) => setValue(v.key, val)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Articles */}
          {template.articles.map((art) => {
            const vars = art.variables || [];
            const hasVars = vars.length > 0;
            return (
              <section
                key={art.id}
                className="space-y-3 p-4 bg-white rounded-xl border border-slate-100 shadow-sm"
              >
                <h4 className="text-sm font-black text-slate-900">
                  {art.title}
                </h4>
                {hasVars && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {vars.map((v) => (
                      <div
                        key={v.key}
                        className={`space-y-1 ${v.type === 'textarea' ? 'md:col-span-2' : ''}`}
                      >
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                          {v.label}
                        </label>
                        <VariableInput
                          v={v}
                          value={values[v.key] || ''}
                          onChange={(val) => setValue(v.key, val)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {art.extensible && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
                      Texte additionnel pour cet article (optionnel)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-accent-red/20 outline-none min-h-[60px] resize-y"
                      placeholder="Ajoutez des clauses ou précisions complémentaires…"
                      value={extras[art.id] || ''}
                      onChange={(e) => setExtra(art.id, e.target.value)}
                      data-testid={`contract-extra-${art.id}`}
                    />
                  </div>
                )}
              </section>
            );
          })}

          {/* Footer variables */}
          <section className="space-y-3 p-4 bg-soft-red/10 rounded-xl border border-red-50">
            <h4 className="text-xs font-black text-accent-red uppercase tracking-widest">
              Signature
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Ville
                </label>
                <VariableInput
                  v={{ key: 'ville', label: 'Ville' }}
                  value={values['ville'] || ''}
                  onChange={(val) => setValue('ville', val)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">
                  Date de signature
                </label>
                <VariableInput
                  v={{ key: 'dateSignature', label: 'Date', type: 'date' }}
                  value={values['dateSignature'] || ''}
                  onChange={(val) => setValue('dateSignature', val)}
                />
              </div>
            </div>
          </section>

          {/* Preview toggle */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowPreview((s) => !s)}
              className="inline-flex items-center gap-2 text-xs font-bold text-accent-red hover:text-primary-red uppercase tracking-widest"
              data-testid="contract-preview-toggle"
            >
              {showPreview ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? 'Masquer l’aperçu' : 'Afficher l’aperçu'}
            </button>
          </div>

          {showPreview && (
            <pre
              className="whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed font-mono text-slate-700 max-h-[400px] overflow-auto"
              data-testid="contract-preview"
            >
              {renderContract(template, values, extras)}
            </pre>
          )}
        </>
      )}
    </div>
  );
};
