import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { NeuralEngine, QuickSource, OutlineItem, ExternalKeys } from "../types";

export interface NeuralResult {
  text: string;
  thought?: string;
  keyUsed?: string;
}

// ==========================================
//  KEY ROTATION ENGINE (Supports 8+ Keys)
// ==========================================
const getGeminiKeys = (userKey?: string): string[] => {
    // 1. If user provided a custom key in UI settings, use only that
    if (userKey && userKey.trim().length > 0) {
        return [userKey.trim()];
    }

    // 2. Look for the comma-separated list from Vercel/Vite
    let envKeys = "";
    try {
        const metaEnv = (import.meta as any).env;
        envKeys = metaEnv?.VITE_GEMINI_API_KEYS || metaEnv?.GEMINI_API_KEY || "";
        
        // Fallback for different environments
        if (!envKeys && typeof process !== 'undefined' && process.env.VITE_GEMINI_API_KEYS) {
            envKeys = process.env.VITE_GEMINI_API_KEYS;
        }
    } catch (e) {}

    // Clean and split the keys into an array
    return envKeys.split(',').map(k => k.trim()).filter(k => k.length > 0);
};

function isQuotaError(error: any): boolean {
    const msg = error?.message?.toLowerCase() || "";
    return msg.includes("quota") || msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("limit");
}

const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = 1,
  delay: number = 1500
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

// ==========================================
//  MAIN AI GENERATOR (With Rotation)
// ==========================================
export const callNeuralEngine = async (
  engine: NeuralEngine,
  prompt: string,
  systemInstruction: string,
  file?: QuickSource | null,
  userKeys: ExternalKeys = {}
): Promise<NeuralResult> => {
  
  if (engine === NeuralEngine.GEMINI_3_FLASH || engine === NeuralEngine.GEMINI_3_PRO) {
    const availableKeys = getGeminiKeys(userKeys[engine]);

    if (availableKeys.length === 0) {
      throw new Error("No API Keys found. Add VITE_GEMINI_API_KEYS to Vercel.");
    }

    // Loop through all keys (Rotation)
    for (let i = 0; i < availableKeys.length; i++) {
      try {
        return await withRetry(async () => {
          const ai = new GoogleGenAI({ apiKey: availableKeys[i] });
          const parts: any[] = [{ text: prompt }];
          if (file) {
            parts.push({ inlineData: { data: file.data, mimeType: file.mimeType } });
          }

          const response: GenerateContentResponse = await ai.models.generateContent({
            model: engine,
            contents: { parts },
            config: {
              systemInstruction,
              temperature: 0.7,
              topP: 0.95,
              topK: 64
            },
          });

          return {
            text: response.text || "No content generated.",
            thought: `Neural synthesis complete (Key #${i + 1}/${availableKeys.length})`
          };
        });
      } catch (error: any) {
        // If Quota Error and we have more keys, try next key
        if (isQuotaError(error) && i < availableKeys.length - 1) {
          console.warn(`Key #${i + 1} exhausted. Rotating...`);
          continue; 
        }
        return { text: `<div class="p-6 bg-red-50 text-red-600 rounded-xl">Error: ${error.message}</div>` };
      }
    }
  }

  // Fallback for other engines (GPT, Grok, etc)
  const userKey = userKeys[engine];
  if (!userKey) return { text: `<div class="p-6 bg-orange-50 text-orange-600">Key required for ${engine}</div>` };

  return withRetry(async () => {
    let endpoint = "";
    if (engine === NeuralEngine.GPT_4O) endpoint = "https://api.openai.com/v1/chat/completions";
    else if (engine === NeuralEngine.GROK_3) endpoint = "https://api.x.ai/v1/chat/completions";
    else if (engine === NeuralEngine.DEEPSEEK_V3) endpoint = "https://api.deepseek.com/chat/completions";

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userKey}` },
      body: JSON.stringify({
        model: engine,
        messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    const data = await response.json();
    return { text: data.choices[0].message.content, thought: `External synthesis via ${engine}.` };
  }).catch((error: any) => ({ text: `<div class="p-6 bg-red-50 text-red-600">Error: ${error.message}</div>` }));
};

// ==========================================
//  OUTLINE GENERATOR (With Rotation)
// ==========================================
export const generateNeuralOutline = async (
  prompt: string
): Promise<OutlineItem[]> => {
  const availableKeys = getGeminiKeys();

  for (let i = 0; i < availableKeys.length; i++) {
    try {
      const ai = new GoogleGenAI({ apiKey: availableKeys[i] });
      const response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                children: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      children: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING } } } }
                    }
                  }
                }
              },
              required: ["title"]
            }
          }
        }
      });

      const jsonStr = response.text || "[]";
      const data = JSON.parse(jsonStr);
      
      const addIds = (items: any[]): OutlineItem[] => {
        return items.map((item, index) => ({
          id: `outline-${Date.now()}-${index}-${Math.random()}`,
          title: item.title,
          expanded: true,
          children: item.children ? addIds(item.children) : []
        }));
      };

      return addIds(data);
    } catch (error: any) {
      if (isQuotaError(error) && i < availableKeys.length - 1) {
        continue; // Rotate key for outline
      }
      console.error(`Outline generation failed.`, error.message);
      return [];
    }
  }
  return [];
};
