import { GoogleGenAI } from '@google/genai';

async function listModels() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const models = await ai.models.list();
    console.log(models);
  } catch (err) {
    console.error('Error:', err);
  }
}

listModels();
