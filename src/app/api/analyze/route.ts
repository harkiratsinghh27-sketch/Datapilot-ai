import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { runQuery } from '@/lib/db';
import { fileCache } from '@/lib/store';
import { callLlm } from '@/lib/llm';
import { generateHeuristicSql, generateDeterministicNarrative } from '@/lib/heuristics';

export async function POST(req: NextRequest) {
  try {
    const { file_id, question, csv_content, filename } = await req.json();

    if (!file_id || !question) {
      return NextResponse.json({ detail: 'file_id and question are required' }, { status: 400 });
    }

    const tableName = `t_${file_id.replace(/-/g, '')}`;
    let cachedFile = fileCache.get(file_id);

    // Auto-rehydrate table on Vercel serverless cold-start if csv_content is provided
    if (!cachedFile && csv_content) {
      try {
        const filePath = join(tmpdir(), `${file_id}.csv`);
        await writeFile(filePath, Buffer.from(csv_content));
        await runQuery(`CREATE TABLE IF NOT EXISTS ${tableName} AS SELECT * FROM read_csv_auto('${filePath}')`);
        
        const rowCountRes = await runQuery(`SELECT count(*) as count FROM ${tableName}`);
        const rowCount = Number(rowCountRes[0]?.count || 0);
        const schemaRes = await runQuery(`PRAGMA table_info('${tableName}')`);
        const columns = schemaRes.map((r: any) => ({ name: r.name, type: r.type }));
        const sampleRowsRes = await runQuery(`SELECT * FROM ${tableName} LIMIT 5`);

        cachedFile = {
          fileId: file_id,
          filename: filename || 'dataset.csv',
          filePath,
          profile: {
            columns,
            rowCount,
            stats: {},
            sampleRows: sampleRowsRes
          }
        };
        fileCache.set(file_id, cachedFile);
      } catch (rehydrateErr: any) {
        console.warn('Serverless auto-rehydration failed:', rehydrateErr.message);
      }
    }

    if (!cachedFile) {
      return NextResponse.json({ detail: 'File not found or expired. Please upload again.' }, { status: 404 });
    }

    const columns = cachedFile.profile.columns || [];
    const rowCount = cachedFile.profile.rowCount || 0;

    // Call 1: Generate SQL via LLM with Deterministic Fallback
    const sqlSystemPrompt = `You are a careful data analyst. You receive a dataset schema, sample rows, column statistics, and a user question. Return a single JSON object with these keys:
- sql: one read-only SELECT against a table named "${tableName}". No DDL, no DML, no PRAGMA, no ATTACH, no semicolon-separated statements. Quote identifiers with double quotes. Always include a LIMIT 5000 if no smaller limit is needed.
- chart: { type, title, horizontal, x_label, y_label }. type is one of: bar, line, pie, doughnut, scatter, table, none. Use "none" for single-row results. Set horizontal true when category labels are long.
- kpis: array of up to 4 { label, value } strings.
If the user's question is conversational (e.g., "hello") or unrelated to the data, do not refuse to answer. Instead, generate {"sql": "SELECT * FROM \\"${tableName}\\" LIMIT 5", "chart": {"type": "none"}, "kpis": []}.
Return ONLY the JSON object. No prose, no markdown fences.`;

    const sqlUserPrompt = `Dataset: ${cachedFile.filename}
Rows: ${rowCount}
Columns: ${JSON.stringify(columns)}
Sample rows: ${JSON.stringify(cachedFile.profile.sampleRows || [])}
Column profile: ${JSON.stringify(cachedFile.profile.stats || {})}
Question: ${question}`;

    let sqlData: any = null;

    try {
      let sqlResponseText = await callLlm(sqlSystemPrompt, sqlUserPrompt);
      sqlResponseText = sqlResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      sqlData = JSON.parse(sqlResponseText);
    } catch (llmErr: any) {
      console.warn("LLM SQL generation failed or rate-limited, switching to deterministic heuristic engine:", llmErr.message);
      // Fallback seamlessly to deterministic engine
      sqlData = generateHeuristicSql(question, tableName, columns, rowCount);
    }

    if (!sqlData || !sqlData.sql) {
      sqlData = generateHeuristicSql(question, tableName, columns, rowCount);
    }

    let rawSql = String(sqlData.sql).trim();

    // Basic SQL security & syntax validation
    const upperSql = rawSql.toUpperCase();
    const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'MERGE', 'PRAGMA', 'ATTACH', 'COPY', 'INSTALL', 'LOAD'];
    const hasForbidden = forbidden.some(f => upperSql.match(new RegExp(`\\b${f}\\b`)));

    if (!upperSql.startsWith('SELECT') || hasForbidden || rawSql.includes(';')) {
      console.warn("Non-conforming SQL generated, replacing with safe heuristic SQL:", rawSql);
      sqlData = generateHeuristicSql(question, tableName, columns, rowCount);
      rawSql = sqlData.sql;
    }

    let finalSql = rawSql;
    if (!finalSql.toUpperCase().includes('LIMIT')) {
      finalSql += ' LIMIT 5000';
    }

    // Execute SQL with DuckDB (with self-healing fallback if query fails)
    let resultRows: any[] = [];
    try {
      const timeoutPromise = new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('Query timeout')), 10000));
      resultRows = await Promise.race([runQuery(finalSql), timeoutPromise]);
    } catch (sqlErr: any) {
      console.warn(`Query execution failed (${sqlErr.message}), self-healing with deterministic schema query...`);
      // Self-heal: LLM might have used an invalid column name
      const heuristicFallback = generateHeuristicSql(question, tableName, columns, rowCount);
      finalSql = heuristicFallback.sql;
      sqlData.chart = heuristicFallback.chart;
      resultRows = await runQuery(finalSql);
    }

    const resultColumns = resultRows.length > 0 ? Object.keys(resultRows[0]) : [];

    // Call 2: Generate Narrative via LLM or Deterministic Narrative Engine
    let narrData: any = null;
    const narrativeSystemPrompt = `You are a careful data analyst. You previously wrote a SQL query. Here is the result. Return ONLY a JSON object with keys \`narrative\`, \`kpis\`, and \`insights\`. Reference real numbers from the result. Do not invent values. If the result is empty, say so and suggest one valid follow-up. If the original question was a conversational greeting (like "hello" or "who are you"), reply naturally in the narrative field and leave insights empty. Return ONLY valid JSON, no markdown formatting.`;
    
    const narrativeUserPrompt = `SQL: ${finalSql}
Result columns: ${JSON.stringify(resultColumns)}
Result rows (first 50): ${JSON.stringify(resultRows.slice(0, 50))}
Original question: ${question}`;

    try {
      let narrResponseText = await callLlm(narrativeSystemPrompt, narrativeUserPrompt);
      narrResponseText = narrResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      narrData = JSON.parse(narrResponseText);
    } catch (narrErr: any) {
      console.warn("LLM Narrative generation skipped or rate-limited, generating deterministic narrative:", narrErr.message);
      narrData = generateDeterministicNarrative(question, finalSql, resultRows, resultColumns);
    }

    if (!narrData || !narrData.narrative) {
      narrData = generateDeterministicNarrative(question, finalSql, resultRows, resultColumns);
    }

    // Normalize KPIs into an array of { label, value }
    let normalizedKpis: Array<{ label: string; value: string | number }> = [];
    if (Array.isArray(narrData.kpis)) {
      normalizedKpis = narrData.kpis.filter((k: any) => k && typeof k === 'object' && k.label && k.value !== undefined);
    } else if (narrData.kpis && typeof narrData.kpis === 'object') {
      normalizedKpis = Object.entries(narrData.kpis).map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: String(v) }));
    } else if (Array.isArray(sqlData.kpis)) {
      normalizedKpis = sqlData.kpis.filter((k: any) => k && typeof k === 'object' && k.label && k.value !== undefined);
    }

    // Build chart spec
    const chartSpec = sqlData.chart || { type: 'table' };
    if (chartSpec.type !== 'none' && chartSpec.type !== 'table' && resultRows.length > 0) {
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
        kpis: normalizedKpis,
        chart: chartSpec,
        insights: Array.isArray(narrData.insights) ? narrData.insights : []
      }
    });

  } catch (error: any) {
    console.error("Critical error in analyze route:", error);
    return NextResponse.json({ detail: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
}
