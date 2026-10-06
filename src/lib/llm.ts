import { GoogleGenAI } from '@google/genai';

// Initialize SDK. It will automatically pick up GEMINI_API_KEY from environment
const ai = new GoogleGenAI({});
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

export async function callLlm(systemInstruction: string, userPrompt: string): Promise<string> {
  // If no API key, mock for offline tests
  if (!process.env.GEMINI_API_KEY) {
    if (systemInstruction.includes("sql: one read-only SELECT")) {
      return JSON.stringify({
        sql: "SELECT * FROM data LIMIT 5",
        chart: { type: "table", title: "Mock Data" },
        kpis: [{ label: "Rows", value: "5" }]
      });
    } else {
      return JSON.stringify({
        narrative: "This is a mock narrative generated offline.",
        kpis: [{ label: "Mock", value: "True" }],
        insights: ["Mock insight 1", "Mock insight 2"]
      });
    }
  }

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });

    return response.text || "{}";
  } catch (error) {
    console.error("LLM Error:", error);
    throw error;
  }
}
