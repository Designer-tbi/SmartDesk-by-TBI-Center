export const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const newInit = { ...(init || {}) };
  const token = localStorage.getItem('token');
  
  newInit.headers = {
    ...newInit.headers,
    'x-demo-mode': localStorage.getItem('demoMode') === 'true' ? 'true' : 'false',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
  return fetch(input, newInit);
};
