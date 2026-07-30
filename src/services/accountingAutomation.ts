import { apiFetch } from '../lib/api';

export interface SuggestedEntry {
  description: string;
  items: { accountId: string; debit: number; credit: number }[];
}

/**
 * Delegates to the backend, which holds the Gemini API key server-side.
 * This used to call the Gemini SDK directly from the browser with the key
 * baked into the client bundle via vite.config.ts's `define` — readable by
 * anyone who opened devtools on the deployed app. See
 * server/services/accountingAI.ts for the real implementation now.
 */
export async function suggestAccountingEntry(
  description: string,
  amount: number,
  standard: string = 'OHADA',
): Promise<SuggestedEntry> {
  const res = await apiFetch('/api/journal-entries/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, amount, standard }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `Suggestion échouée (HTTP ${res.status})`);
  }
  return res.json();
}
