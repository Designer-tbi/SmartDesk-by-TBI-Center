/**
 * Thin fetch wrapper used by every component to call the backend.
 *
 * Authentication is delivered via an HttpOnly cookie set by the server at
 * /api/auth/login — we therefore need `credentials: 'include'` so the browser
 * attaches it on every request. There is no token in JavaScript anymore.
 *
 * Cross-tenant impersonation (super-admin only) and preferences like the
 * selected company id come from the in-memory `session` singleton which is
 * hydrated at app boot from /api/auth/me.
 */
type Session = {
  companyId: string | null;
  isDemo: boolean;
};

const session: Session = {
  companyId: null,
  isDemo: false,
};

export const setApiSession = (next: Partial<Session>) => {
  Object.assign(session, next);
};

export const clearApiSession = () => {
  session.companyId = null;
  session.isDemo = false;
};

export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString();
  const companyId = session.companyId;

  if (companyId) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}companyId=${companyId}`;
  }

  const newInit: RequestInit = {
    credentials: 'include', // send the HttpOnly session cookie
    ...(init || {}),
  };

  newInit.headers = {
    ...newInit.headers,
    'x-demo-mode': session.isDemo ? 'true' : 'false',
    'x-company-id': companyId || '',
  };

  const safeFetch = (window as any).__safe_fetch__ || fetch;
  const response = await safeFetch(url, newInit);

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('auth-error'));
  }

  if (response.ok) {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html') && url.includes('/api/')) {
      console.error(`API returned HTML instead of JSON for ${url}. Vercel routing issue.`);
      throw new Error("L'API n'est pas configurée correctement sur le serveur (HTML reçu au lieu de JSON).");
    }
  }

  return response;
};
