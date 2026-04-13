export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  let url = input.toString();
  const companyId = localStorage.getItem('selectedCompanyId');
  
  if (companyId) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}companyId=${companyId}`;
  }

  const newInit = { ...(init || {}) };
  const token = localStorage.getItem('token');
  
  newInit.headers = {
    ...newInit.headers,
    'x-demo-mode': localStorage.getItem('demoMode') === 'true' ? 'true' : 'false',
    'x-company-id': companyId || '',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
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
