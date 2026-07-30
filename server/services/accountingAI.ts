/**
 * Server-side proxy for the Gemini-powered journal entry suggestion.
 *
 * This used to run client-side (src/services/accountingAutomation.ts) with
 * GEMINI_API_KEY baked into the browser bundle via vite.config.ts's
 * `define` — meaning the paid API key was readable by anyone who opened
 * devtools on the deployed app. Moved server-side so the key never leaves
 * the backend.
 */
import { GoogleGenAI, Type } from '@google/genai';
import { OHADA_PCG } from '../../src/constants/ohadaPCG.js';
import { US_GAAP } from '../../src/constants/usGAAP.js';
import { FRANCE_PCG } from '../../src/constants/francePCG.js';

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
}

export interface SuggestedEntry {
  description: string;
  items: { accountId: string; debit: number; credit: number }[];
}

export async function suggestAccountingEntry(
  description: string,
  amount: number,
  standard: string = 'OHADA',
): Promise<SuggestedEntry> {
  const ai = getAI();
  const pcg = standard === 'US_GAAP' ? US_GAAP : standard === 'FRANCE' ? FRANCE_PCG : OHADA_PCG;

  const prompt = `
    As an expert accountant specializing in ${standard}, analyze the following description and propose a balanced journal entry.
    Description: "${description}"
    Amount: ${amount}

    Here is the list of available accounts (${standard}):
    ${JSON.stringify(pcg.slice(0, 100))} ... (and more)

    Return the result in the following JSON format:
    {
      "description": "Improved description",
      "items": [
        { "accountId": "account_code", "debit": amount, "credit": amount }
      ]
    }
    Ensure that the sum of debits equals the sum of credits and matches the provided amount.
    Use ONLY the account codes from the provided list or standard ${standard} codes if not in the snippet.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                accountId: { type: Type.STRING },
                debit: { type: Type.NUMBER },
                credit: { type: Type.NUMBER },
              },
              required: ['accountId', 'debit', 'credit'],
            },
          },
        },
        required: ['description', 'items'],
      },
    },
  });

  return JSON.parse(response.text!);
}
