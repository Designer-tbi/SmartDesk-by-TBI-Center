/**
 * Global automation notifications.
 *
 * Two delivery paths, same dedupe set:
 *   1. WebSocket — cross-module automation events (quote → invoice,
 *      invoice → journal entry, contract → payslip) delivered instantly.
 *      Only live outside Vercel's serverless runtime (see server.ts —
 *      the WS server is never started there).
 *   2. Polling fallback — GET /api/company/activity/recent, which reads
 *      the same events from activity_log (see server/routes/company.ts).
 *      This is what actually fires on serverless deployments, where the
 *      WebSocket never connects.
 *
 * Mount once, ideally next to <ToastHost /> in App.tsx.
 */
import { useEffect, useRef } from 'react';
import { useWebSocket } from './websocket';
import { toast } from './toast';
import { apiFetch } from './api';

const POLL_INTERVAL_MS = 15_000;

const LABELS: Record<string, (data: any) => string> = {
  INVOICE_AUTO_CREATED: (d) =>
    `Facture ${d.invoiceId} créée automatiquement depuis le devis signé ${d.quoteId}.`,
  JOURNAL_AUTO_CREATED: (d) =>
    `Écriture comptable enregistrée pour la facture ${d.invoiceId}.`,
  PAYSLIP_AUTO_CREATED: (d) =>
    `Bulletin de paie brouillon créé pour le contrat ${d.contractId}.`,
};

// activity_log `action` ids the corresponding server-side logActivity()
// calls use (see invoices.ts / publicSignature.ts) — distinct from the
// WebSocket message `type`s above, which are named after the resource
// rather than the log entry.
const AUTOMATION_ACTIONS = ['AUTO_JOURNAL_ENTRY', 'AUTO_INVOICE_FROM_QUOTE', 'AUTO_PAYSLIP'];

export const useAutomationNotifications = (companyId?: string | null) => {
  const { lastMessage } = useWebSocket();
  const seen = useRef(new Set<string>());

  // -- WebSocket path --
  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage as any;
    const fn = LABELS[type];
    if (!fn) return;
    if (companyId && data?.companyId && data.companyId !== companyId) return;

    // Deduplicate: WebSocket can fire twice when the same payload
    // lands on two listeners during HMR.
    const key = `${type}-${data?.invoiceId || data?.payslipId || ''}-${
      data?.quoteId || data?.contractId || ''
    }`;
    if (seen.current.has(key)) return;
    seen.current.add(key);
    toast.success(fn(data));
  }, [lastMessage, companyId]);

  // -- Polling fallback --
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    let timer: number | null = null;
    // Baseline starts as "now" — the first poll only establishes what
    // already happened before this session started; it must never dump
    // the whole historical backlog as toasts on page load.
    let sinceIso: string | null = new Date().toISOString();
    let primed = false;

    const poll = async () => {
      try {
        const params = new URLSearchParams({ actions: AUTOMATION_ACTIONS.join(',') });
        if (sinceIso) params.set('since', sinceIso);
        const res = await apiFetch(`/api/company/activity/recent?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const rows: Array<{ id: string; action: string; details: string; createdAt: string }> = await res.json();
        for (const row of rows) {
          if (seen.current.has(row.id)) continue;
          seen.current.add(row.id);
          // The very first poll seeds the dedupe set silently — only
          // toast events discovered on subsequent polls.
          if (primed) toast.success(row.details);
          if (!sinceIso || row.createdAt > sinceIso) sinceIso = row.createdAt;
        }
        primed = true;
      } catch {
        /* offline / transient — retried on the next tick */
      }
    };

    poll();
    timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer != null) window.clearInterval(timer);
    };
  }, [companyId]);
};
