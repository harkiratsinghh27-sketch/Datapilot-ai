import { NextRequest, NextResponse } from 'next/server';
import { runQuery } from '@/lib/db';
import { fileCache } from '@/lib/store';
import { callLlm } from '@/lib/llm';

export async function POST(req: NextRequest) {
  try {
    const { file_id, question } = await req.json();

    if (!file_id || !question) {
      return NextResponse.json({ detail: 'file_id and question are required' }, { status: 400 });
    }

    const cachedFile = fileCache.get(file_id);
    if (!cachedFile) {
      return NextResponse.json({ detail: 'File not found or expired. Please upload again.' }, { status: 404 });
    }

    const tableName = `t_${file_id.replace(/-/g, '')}`;

    // Call 1: Generate SQL
    const sqlSystemPrompt = `You are a careful data analyst. You receive a dataset schema, sample rows, column statistics, and a user question. Return a single JSON object with these keys:
- sql: one read-only SELECT against a table named "${tableName}". No DDL, no DML, no PRAGMA, no ATTACH, no semicolon-separated statements. Quote identifiers with double quotes. Always include a LIMIT 5000 if no smaller limit is needed.
- chart: { type, title, horizontal, x_label, y_label }. type is one of: bar, line, pie, doughnut, scatter, table, none. Use "none" for single-row results. Set horizontal true when category labels are long.
- kpis: array of up to 4 { label, value } strings.
If the user's question is conversational (e.g., "hello") or unrelated to the data, do not refuse to answer. Instead, generate {"sql": "SELECT * FROM \\"${tableName}\\" LIMIT 5", "chart": {"type": "none"}, "kpis": []}.
Return ONLY the JSON object. No prose, no markdown fences.`;

    const sqlUserPrompt = `Dataset: ${cachedFile.filename}
Rows: ${cachedFile.profile.rowCount}
Columns: ${JSON.stringify(cachedFile.profile.columns)}
Sample rows: ${JSON.stringify(cachedFile.profile.sampleRows)}
Column profile: ${JSON.stringify(cachedFile.profile.stats)}
Question: ${question}`;

    let sqlResponseText = await callLlm(sqlSystemPrompt, sqlUserPrompt);
    sqlResponseText = sqlResponseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let sqlData: any;
    try {
      sqlData = JSON.parse(sqlResponseText);
    } catch (e) {
      // Retry once if JSON is malformed
      console.log("Malformed JSON from LLM, retrying...");
      let retryResponse = await callLlm(sqlSystemPrompt, sqlUserPrompt + "\n\nWARNING: Your previous response was invalid JSON. You MUST return ONLY valid JSON.");
      retryResponse = retryResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        sqlData = JSON.parse(retryResponse);
      } catch (e2) {
         return NextResponse.json({ detail: 'AI failed to generate a valid response format.' }, { status: 500 });
      }
    }

    const rawSql = sqlData.sql as string;
    if (!rawSql) {
      return NextResponse.json({ detail: 'AI failed to generate SQL.' }, { status: 500 });
    }

    // Validate SQL
    const upperSql = rawSql.toUpperCase();
    if (!upperSql.trim().startsWith('SELECT')) {
       return NextResponse.json({ detail: 'Only SELECT queries are allowed.' }, { status: 400 });
    }
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'MERGE', 'PRAGMA', 'ATTACH', 'COPY', 'INSTALL', 'LOAD'];
    for (const f of forbidden) {
      if (upperSql.match(new RegExp(`\\b${f}\\b`))) {
         return NextResponse.json({ detail: `Query contains forbidden keyword: ${f}` }, { status: 400 });
      }
    }
    if (rawSql.includes(';')) {
      // Very basic check for multiple statements
      const parts = rawSql.split(';').filter(p => p.trim().length > 0);
      if (parts.length > 1) {
         return NextResponse.json({ detail: 'Multiple statements are not allowed.' }, { status: 400 });
      }
    }

    let finalSql = rawSql;
    if (!upperSql.includes('LIMIT')) {
      finalSql += ' LIMIT 5000';
    }

    // Execute SQL
    let resultRows: any[] = [];
    try {
      const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000));
      resultRows = await Promise.race([runQuery(finalSql), timeoutPromise]);
    } catch (e: any) {
      return NextResponse.json({ detail: `SQL Error: ${e.message}` }, { status: 400 });
    }

    const resultColumns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

    // Call 2: Narrate result
    const narrativeSystemPrompt = `You are a careful data analyst. You previously wrote a SQL query. Here is the result. Return ONLY a JSON object with keys \`narrative\`, \`kpis\`, and \`insights\`. Reference real numbers from the result. Do not invent values. If the result is empty, say so and suggest one valid follow-up. If the original question was a conversational greeting (like "hello" or "who are you"), reply naturally in the narrative field and leave insights empty. Return ONLY valid JSON, no markdown formatting.`;
    
    const narrativeUserPrompt = `SQL: ${finalSql}
Result columns: ${JSON.stringify(resultColumns)}
Result rows (first 50): ${JSON.stringify(resultRows.slice(0, 50))}
Original question: ${question}`;

    let narrResponseText = await callLlm(narrativeSystemPrompt, narrativeUserPrompt);
    narrResponseText = narrResponseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let narrData: any;
    try {
      narrData = JSON.parse(narrResponseText);
    } catch (e) {
       // deterministic fallback
       narrData = {
         narrative: `The query executed successfully and returned ${resultRows.length} rows.`,
         kpis: [{ label: 'Result Rows', value: String(resultRows.length) }],
         insights: []
       };
    }

    // Build final chart spec
    const chartSpec = sqlData.chart || { type: 'table' };
    if (chartSpec.type !== 'none' && chartSpec.type !== 'table' && resultRows.length > 0) {
       // Attempt to map data into the chart spec if LLM didn't provide datasets array
       // or if we need to hydrate it from resultRows
       const stringCols = resultColumns.filter(c => typeof resultRows[0][c] === 'string');
       const numCols = resultColumns.filter(c => typeof resultRows[0][c] === 'number');
       
       if (stringCols.length > 0 && numCols.length > 0) {
         chartSpec.labels = resultRows.map(r => String(r[stringCols[0]]));
         chartSpec.datasets = [{
           label: numCols[0],
           data: resultRows.map(r => r[numCols[0]])
         }];
       } else if (numCols.length >= 1) {
         chartSpec.labels = resultRows.map((_, i) => `Row ${i+1}`);
         chartSpec.datasets = [{
           label: numCols[0],
           data: resultRows.map(r => r[numCols[0]])
         }];
       }
    }

    return NextResponse.json({
      sql: finalSql,
      row_count: resultRows.length,
      table: {
        columns: resultColumns,
        rows: resultRows.map(r => Object.values(r))
      },
      answer: {
        narrative: narrData.narrative,
        kpis: narrData.kpis || sqlData.kpis,
        chart: chartSpec,
        insights: narrData.insights || []
      }
    });

  } catch (error: any) {
    console.error("Query error:", error);
    return NextResponse.json({ detail: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
