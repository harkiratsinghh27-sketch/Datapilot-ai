import { DatasetProfile, AIAnalysisResponse, ConversationContext } from '@/types/dataset';
import { executeInJS, validateSQLSecurity } from './analytics-engine';
import OpenAI from 'openai';

export async function runAnalyticsAgent(
  question: string,
  profile: DatasetProfile,
  dataset: Record<string, any>[],
  context?: ConversationContext,
  apiKey?: string
): Promise<AIAnalysisResponse> {
  const activeKey = apiKey || process.env.OPENROUTER_API_KEY;
  // Default to a fast free model on OpenRouter if not specified
  const modelName = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-lite-preview-02-05:free';

  if (!activeKey) {
    return {
      answer: 'AI analysis is temporarily unavailable. Please check your AI configuration. OPENROUTER_API_KEY is missing.',
      confidence: 'low',
      requestType: 'ERROR'
    };
  }

  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: activeKey,
    // Add default headers for OpenRouter
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'DataPilot AI',
    }
  });
  
  // Create schema summary without sending the whole dataset
  const schemaSummary = profile.columns.map(c => ({
    name: c.name,
    type: c.type,
    semanticRole: c.semanticRole,
    nullPercentage: c.nullPercentage,
    uniqueCount: c.uniqueCount,
    min: c.min,
    max: c.max
  }));

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "get_dataset_schema",
        description: "Return the dataset schema including column names, types, and summary statistics.",
        parameters: { type: "object", properties: {} }
      }
    },
    {
      type: "function",
      function: {
        name: "get_column_profile",
        description: "Get detailed statistics and sample values for specific columns to understand their semantic meaning.",
        parameters: { 
          type: "object", 
          properties: {
            columns: { type: "array", items: { type: "string" }, description: "List of column names" }
          },
          required: ["columns"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "run_analytics_query",
        description: "Execute a SQL query against the dataset to get actual numerical results. Supports SELECT, WHERE, GROUP BY, ORDER BY, LIMIT, SUM, AVG, MIN, MAX, COUNT. Table name is 'dataset'.",
        parameters: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The SQL query to execute" }
          },
          required: ["sql"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "calculator",
        description: "Perform mathematical calculations (addition, subtraction, division, percentages). Use this to compute margins, growth rates, or percentage point differences using exact numbers from run_analytics_query.",
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Math expression like '(500000 - 350000) / 500000 * 100'" }
          },
          required: ["expression"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "submit_final_answer",
        description: "Submit the final JSON response to the user. Use this when you have gathered enough information.",
        parameters: {
          type: "object",
          properties: {
            answer: { type: "string", description: "The conversational answer in Markdown format. Cite sources if used." },
            requestType: { type: "string", enum: ["DATA_ANALYSIS", "GENERAL_KNOWLEDGE", "CURRENT_INFORMATION", "MIXED"] },
            insights: { type: "array", items: { type: "string" }, description: "Business insights" },
            metrics: { type: "array", items: { type: "object", properties: { label: {type:"string"}, value: {type:"string"}, subtext: {type:"string"} } } },
            calculation: { 
              type: "object", 
              properties: { 
                dataUsed: { type: "array", items: { type: "string" } }, 
                formula: { type: "string" }, 
                steps: { type: "array", items: { type: "string" } } 
              } 
            },
            chart: { 
              type: "object", 
              properties: {
                type: { type: "string", enum: ["bar", "line", "area", "donut", "scatter", "horizontal_bar"] },
                title: { type: "string" },
                xAxis: { type: "string", description: "Column name for X axis" },
                yAxis: { type: "string", description: "Column name for Y axis" }
              }
            },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            warnings: { type: "array", items: { type: "string" }, description: "Data quality warnings" },
            followUpQuestions: { type: "array", items: { type: "string" } }
          },
          required: ["answer", "requestType", "confidence"]
        }
      }
    }
  ];

  let lastQueryRows: any[] = [];
  let finalResponse: AIAnalysisResponse | null = null;
  const executionStartTime = Date.now();

  const systemInstruction = `You are DataPilot AI, an elite business data analyst agent.
You have access to a dataset with ${profile.rowCount} rows.
Date column: ${profile.dateColumn || 'Order_Date'}

Rules:
1. NEVER invent or hallucinate data, numbers, or column names.
2. For data questions, ALWAYS use tools (get_dataset_schema, run_analytics_query) to find the exact numbers.
3. If asked about current events or outside info, just answer normally based on your training data.
4. Call 'submit_final_answer' when you are done.
5. If the user asks a general question (e.g. "What is recursion?"), just answer it using 'submit_final_answer' without running queries.
6. When using run_analytics_query, use standard SQL. Table name is 'dataset'. Ensure your query uses actual column names.
7. CRITICAL SQL LIMITATION: The SQL engine is AlaSQL. Do NOT use Window Functions (LAG, LEAD, OVER) or CTEs (WITH). Use basic SQL, subqueries, or SELF JOINs instead.
8. For charts, provide the configuration in submit_final_answer. The frontend will use the results of your last run_analytics_query as the chart data, so ensure your last query returns the appropriate grouping.`;

  const historyString = context?.historySummary ? `\nConversation Summary: ${context.historySummary}` : '';
  const currentMessage = `User question: "${question}"${historyString}`;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
    { role: 'user', content: currentMessage }
  ];

  try {
    for (let round = 0; round < 10; round++) {
      const chatResponse = await openai.chat.completions.create({
        model: modelName,
        messages: messages,
        temperature: 0.1,
        tools: tools,
        tool_choice: 'auto'
      });
      
      const responseMessage = chatResponse.choices[0].message;
      messages.push(responseMessage);

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        for (const call of responseMessage.tool_calls) {
          const name = call.function.name;
          
          let args: any = {};
          try {
            args = JSON.parse(call.function.arguments || '{}');
          } catch(e) {}
          
          if (name === 'submit_final_answer') {
            finalResponse = {
              answer: args.answer,
              requestType: args.requestType,
              metrics: args.metrics,
              insights: args.insights,
              calculation: args.calculation,
              confidence: args.confidence,
              warnings: args.warnings,
              followUpQuestions: args.followUpQuestions,
              executionTimeMs: Date.now() - executionStartTime
            };
            if (args.chart && lastQueryRows.length > 0) {
              finalResponse.chart = {
                type: args.chart.type || 'bar',
                title: args.chart.title || 'Chart',
                xAxis: args.chart.xAxis || Object.keys(lastQueryRows[0])[0],
                yAxis: args.chart.yAxis || Object.keys(lastQueryRows[0])[1],
                data: lastQueryRows.map(row => ({
                  name: String(row[args.chart.xAxis] || Object.values(row)[0] || 'Unknown'),
                  value: Number(row[args.chart.yAxis] || Object.values(row)[1] || 0)
                }))
              };
            }
            if (lastQueryRows.length > 0) {
              finalResponse.table = {
                columns: Object.keys(lastQueryRows[0] || {}),
                rows: lastQueryRows
              };
            }
            return finalResponse;
          }
          
          let result: any;
          try {
            if (name === 'get_dataset_schema') {
              result = schemaSummary;
            } else if (name === 'get_column_profile') {
              result = (args.columns || []).map((colName: string) => {
                const col = profile.columns.find(c => c.name === colName || c.originalName === colName);
                return col ? { ...col, sampleValues: col.sampleValues.slice(0, 10) } : { error: `Column ${colName} not found` };
              });
            } else if (name === 'run_analytics_query') {
              const check = validateSQLSecurity(args.sql);
              if (!check.valid) {
                result = { error: check.reason };
              } else {
                const queryRes = executeInJS(args.sql, dataset);
                if (queryRes.success) {
                  lastQueryRows = queryRes.rows.slice(0, 100); 
                  result = { 
                    rowCount: queryRes.rowCount, 
                    rows: lastQueryRows.slice(0, 20),
                    summary: queryRes.rowCount > 20 ? `Returned ${queryRes.rowCount} rows, showing top 20.` : undefined
                  };
                } else {
                  result = { error: queryRes.error };
                }
              }
            } else if (name === 'calculator') {
              try {
                if (/^[0-9+\-*/().\s]+$/.test(args.expression)) {
                  result = { result: new Function(`return ${args.expression}`)() };
                } else {
                  result = { error: 'Invalid mathematical expression.' };
                }
              } catch (e: any) {
                result = { error: e.message };
              }
            } else {
              result = { error: 'Unknown tool' };
            }
          } catch (e: any) {
            result = { error: e.message };
          }
          
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(result)
          });
        }
      } else {
        // Model replied with text instead of a tool call
        if (!finalResponse) {
          finalResponse = {
            answer: responseMessage.content || 'No response text.',
            requestType: 'MIXED',
            confidence: 'medium',
            executionTimeMs: Date.now() - executionStartTime
          };
        }
        return finalResponse;
      }
    }
    
    return finalResponse || {
      answer: 'Analysis took too long to complete. Please try a simpler question.',
      confidence: 'low',
      requestType: 'ERROR'
    };
    
  } catch (err: any) {
    console.error('Agent execution error:', err);
    let errorMessage = err.message;
    
    if (errorMessage.includes('429')) {
      errorMessage = "OpenRouter Rate Limit Reached. Please wait a moment.";
    }

    return {
      answer: `AI Analysis failed: ${errorMessage}`,
      confidence: 'low',
      requestType: 'ERROR'
    };
  }
}
