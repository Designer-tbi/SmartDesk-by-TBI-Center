import { GoogleGenAI, Type } from "@google/genai";
import { OHADA_PCG } from "../constants/ohadaPCG";
import { US_GAAP } from "../constants/usGAAP";
import { FRANCE_PCG } from "../constants/francePCG";

let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn('GEMINI_API_KEY environment variable is missing. AI features will not work.');
    }
    aiClient = new GoogleGenAI({ apiKey: key || 'dummy-key-to-prevent-crash' });
  }
  return aiClient;
}

export interface SuggestedEntry {
  description: string;
  items: { accountId: string; debit: number; credit: number }[];
}

export async function suggestAccountingEntry(description: string, amount: number, standard: string = 'OHADA'): Promise<SuggestedEntry> {
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
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
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
              required: ["accountId", "debit", "credit"],
            },
          },
        },
        required: ["description", "items"],
      },
    },
  });

  return JSON.parse(response.text!);
}
