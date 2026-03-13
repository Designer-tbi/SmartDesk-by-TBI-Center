import { GoogleGenAI, Type } from "@google/genai";
import { OHADA_PCG } from "../constants/ohadaPCG";

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

export async function suggestAccountingEntry(description: string, amount: number): Promise<SuggestedEntry> {
  const ai = getAI();
  const prompt = `
    En tant qu'expert comptable OHADA, analyse la description suivante et propose une écriture comptable équilibrée.
    Description: "${description}"
    Montant: ${amount}
    
    Voici la liste des comptes disponibles (PCG OHADA):
    ${JSON.stringify(OHADA_PCG)}

    Retourne le résultat au format JSON suivant :
    {
      "description": "Description améliorée",
      "items": [
        { "accountId": "code_compte", "debit": montant, "credit": montant }
      ]
    }
    Assure-toi que la somme des débits égale la somme des crédits et égale au montant fourni.
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
