/**
 * Unified Resilient LLM Client with Multi-Tier Free Fallback:
 * Tier 1: Google Gemini (generous free tier, fast, high RPM, zero admission control)
 * Tier 2: OpenRouter Free Models Cascade (with exponential backoff & model rotation)
 * Tier 3: Returns clean JSON or throws catchable error for deterministic engine
 */

const GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash'
];

const OPENROUTER_FREE_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3.5-lightning:free',
  'liquid/lfm-2.5-2.6b:free',
  'openrouter/free',
  'openrouter/auto'
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return cleaned;
}

/**
 * Call Gemini with automatic model failover
 */
async function callGemini(systemInstruction: string, userPrompt: string, apiKey: string): Promise<string> {
  let lastError: any = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        })
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.warn(`Gemini (${model}) returned HTTP ${res.status}: ${errBody.slice(0, 150)}`);
        lastError = new Error(`Gemini ${model} error: ${res.status}`);
        // If 503 (high demand) or 404 (model retired) or 429, try next Gemini model
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (rawText) {
        const cleaned = cleanJsonResponse(rawText);
        // Verify valid JSON
        JSON.parse(cleaned);
        return cleaned;
      }
    } catch (e: any) {
      console.warn(`Gemini attempt with ${model} failed:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Call OpenRouter with multi-model cascade and 429 admission control backoff
 */
async function callOpenRouter(systemInstruction: string, userPrompt: string, apiKey: string): Promise<string> {
  const modelsToTry = process.env.OPENROUTER_MODEL
    ? [process.env.OPENROUTER_MODEL, ...OPENROUTER_FREE_MODELS.filter(m => m !== process.env.OPENROUTER_MODEL)]
    : OPENROUTER_FREE_MODELS;

  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://datapilot.ai',
          'X-Title': 'DataPilot AI'
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.1
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`OpenRouter (${model}) status ${res.status}: ${errText.slice(0, 150)}`);
        lastError = new Error(`OpenRouter ${model} error: ${res.status} ${errText}`);

        // If rate limited (429) or admission control, pause briefly and rotate model
        if (res.status === 429) {
          await sleep(1000);
        }
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const cleaned = cleanJsonResponse(content);
        JSON.parse(cleaned);
        return cleaned;
      }
    } catch (e: any) {
      console.warn(`OpenRouter attempt with ${model} failed:`, e.message);
      lastError = e;
    }
  }

  throw lastError || new Error('All OpenRouter models failed');
}

/**
 * Master LLM invocation function
 */
export async function callLlm(systemInstruction: string, userPrompt: string): Promise<string> {
  // 1. Try Google Gemini first (Fast, free, reliable, no admission-control 429s)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const result = await callGemini(systemInstruction, userPrompt, geminiKey);
      return result;
    } catch (geminiError: any) {
      console.warn('Gemini failed, falling back to OpenRouter...', geminiError?.message);
    }
  }

  // 2. Try OpenRouter Cascade if Gemini failed or is not available
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const result = await callOpenRouter(systemInstruction, userPrompt, openRouterKey);
      return result;
    } catch (orError: any) {
      console.warn('OpenRouter cascade failed:', orError?.message);
      throw orError;
    }
  }

  throw new Error('No LLM API keys configured or all providers rate limited');
}
