/**
 * Live-sync hook — auto-refreshes module data via two mechanisms:
 *
 *   1. Real-time: a `RESOURCE_CHANGED` WebSocket event for a matching
 *      resource key triggers an immediate (debounced) refetch.
 *   2. Fallback polling: every 10 seconds we refetch unconditionally,
 *      so the UI stays fresh even when WebSockets are unavailable
 *      (e.g. Vercel serverless deployments) or when a remote write
 *      happened from outside the SmartDesk SPA.
 *
 * Usage:
 *
 *   useLiveSync(['contacts'], fetchData);
 *   useLiveSync(['invoices', 'quotes'], fetchData);
 *
 * The polling is paused when the document is hidden (tab in background)
 * to avoid wasting API budget on inactive tabs.
 */
import { useEffect, useRef } from 'react';
import { useWebSocket } from './websocket';

const POLL_INTERVAL_MS = 10_000;

export const useLiveSync = (
  resources: string[],
  refetch: () => void | Promise<void>,
  companyId?: string | null,
) => {
  const { lastMessage } = useWebSocket();
  const pending = useRef<number | null>(null);

  // Keep a stable ref to the latest `refetch` so the polling effect
  // never tears down on every re-render.
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  // -- WebSocket-driven sync (immediate) --
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
      refetchRef.current();
    }, 250);
  }, [lastMessage, resources, companyId]);

  // -- Polling fallback (every 10s, when tab is visible) --
  useEffect(() => {
    let timer: number | null = null;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        refetchRef.current();
      }
    };

    const start = () => {
      if (timer == null) {
        timer = window.setInterval(tick, POLL_INTERVAL_MS);
      }
    };
    const stop = () => {
      if (timer != null) {
        window.clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Immediate refresh when the user returns to the tab so they
        // never see stale data on focus.
        refetchRef.current();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Cleanup the WebSocket debounce timer.
  useEffect(() => () => {
    if (pending.current) window.clearTimeout(pending.current);
  }, []);
};
