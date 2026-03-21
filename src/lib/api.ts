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
  return safeFetch(url, newInit);
};
