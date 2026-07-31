import React, { useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from '../../lib/i18n';
import { apiFetch } from '../../lib/api';

const POLL_INTERVAL_MS = 30_000;
const LAST_READ_KEY = 'notificationsLastReadAt';

type ActivityRow = { id: string; action: string; details: string; createdAt: string };

/**
 * Header notification bell — was a static icon with a permanently-on red
 * dot and no click handler at all. Now backed by the same activity feed
 * the automation toasts poll (GET /api/company/activity/recent, see
 * useAutomationNotifications.ts and server/routes/company.ts) so it
 * reflects real events instead of decoration.
 */
export const NotificationBell = ({ user }: { user?: any }) => {
  const { t, dateLocale } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<ActivityRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastReadAt, setLastReadAt] = useState<string | null>(
    user?.preferences?.[LAST_READ_KEY] || null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchRecent = async () => {
    try {
      const res = await apiFetch('/api/company/activity/recent');
      if (!res.ok) return;
      setItems(await res.json());
    } catch {
      /* transient — retried on the next poll */
    }
  };

  useEffect(() => {
    if (!user?.companyId) return;
    const timer = window.setInterval(fetchRecent, POLL_INTERVAL_MS);
    apiFetch('/api/company/activity/recent')
      .then((res) => (res.ok ? res.json() : null))
      .then((rows) => { if (rows) setItems(rows); });
    return () => window.clearInterval(timer);
  }, [user?.companyId]);

  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  const hasUnread = items.some((item) => !lastReadAt || item.createdAt > lastReadAt);

  const handleToggle = async () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (!opening) return;

    setIsLoading(true);
    await fetchRecent();
    setIsLoading(false);

    const now = new Date().toISOString();
    setLastReadAt(now);
    apiFetch('/api/auth/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [LAST_READ_KEY]: now }),
    }).catch(() => {});
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleToggle}
        data-testid="header-notification-bell"
        className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors relative group"
      >
        <Bell className="w-6 h-6 group-hover:text-accent-red transition-colors" />
        {hasUnread && (
          <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-accent-red rounded-full border-2 border-white" />
        )}
      </button>

      {isOpen && (
        <div
          data-testid="header-notification-panel"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-2xl shadow-xl border border-slate-100 z-50"
        >
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">{t('header.notifications')}</h3>
          </div>
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 text-accent-red animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-slate-400 text-center">{t('header.noNotifications')}</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {[...items].reverse().map((item) => (
                <li key={item.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <p className="text-sm text-slate-700">{item.details}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateLocale })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
