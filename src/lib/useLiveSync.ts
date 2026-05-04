/**
 * Live-sync hook — auto-refreshes module data when the server
 * broadcasts a `RESOURCE_CHANGED` event for a matching resource key.
 *
 * Usage:
 *
 *   useLiveSync(['contacts'], fetchData);
 *   useLiveSync(['invoices', 'quotes'], fetchData);
 *
 * Events from the same tab/user are debounced (they would re-trigger
 * the fetch that just succeeded).
 */
import { useEffect, useRef } from 'react';
import { useWebSocket } from './websocket';

export const useLiveSync = (
  resources: string[],
  refetch: () => void | Promise<void>,
  companyId?: string | null,
) => {
  const { lastMessage } = useWebSocket();
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (!lastMessage) return;
    const { type, data } = lastMessage as any;
    if (type !== 'RESOURCE_CHANGED') return;
    if (!resources.includes(data?.resource)) return;
    if (companyId && data?.companyId && data.companyId !== companyId) return;

    // Coalesce bursts (bulk imports, sequential writes).
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      pending.current = null;
      refetch();
    }, 250);
  }, [lastMessage, resources, refetch, companyId]);

  useEffect(() => () => {
    if (pending.current) window.clearTimeout(pending.current);
  }, []);
};
