/**
 * Global automation notifications.
 *
 * Listens on the tenant WebSocket for cross-module automation events
 * (quote → invoice, invoice → journal entry, contract → payslip) and
 * surfaces a visible toast so the user always knows when a ripple
 * action has fired server-side.
 *
 * Mount once, ideally next to <ToastHost /> in App.tsx.
 */
import { useEffect, useRef } from 'react';
import { useWebSocket } from './websocket';
import { toast } from './toast';

const LABELS: Record<string, (data: any) => string> = {
  INVOICE_AUTO_CREATED: (d) =>
    `Facture ${d.invoiceId} créée automatiquement depuis le devis signé ${d.quoteId}.`,
  JOURNAL_AUTO_CREATED: (d) =>
    `Écriture comptable enregistrée pour la facture ${d.invoiceId}.`,
  PAYSLIP_AUTO_CREATED: (d) =>
    `Bulletin de paie brouillon créé pour le contrat ${d.contractId}.`,
};

export const useAutomationNotifications = (companyId?: string | null) => {
  const { lastMessage } = useWebSocket();
  const seen = useRef(new Set<string>());

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
};
