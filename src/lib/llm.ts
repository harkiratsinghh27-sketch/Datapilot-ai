export async function callLlm(systemInstruction: string, userPrompt: string): Promise<string> {
  // Use OpenRouter if available, otherwise fallback to mock
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("No OPENROUTER_API_KEY found, using mock response.");
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

  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    if (data.choices && data.choices.length > 0) {
       return data.choices[0].message.content || "{}";
    }
    return "{}";
  } catch (error) {
    console.error("LLM Error:", error);
    throw error;
  }
}
