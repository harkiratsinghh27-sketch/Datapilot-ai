export interface ColumnInfo {
  name: string;
  type: string;
}

export interface HeuristicResult {
  sql: string;
  chart: {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter' | 'table' | 'none';
    title?: string;
    horizontal?: boolean;
    x_label?: string;
    y_label?: string;
  };
  kpis: Array<{ label: string; value: string | number }>;
  narrative?: string;
}

/**
 * Heuristic Natural Language to SQL converter.
 * Guarantees a valid, read-only SELECT query against tableName for any prompt.
 */
export function generateHeuristicSql(
  question: string,
  tableName: string,
  columns: ColumnInfo[],
  rowCount: number
): HeuristicResult {
  const q = question.toLowerCase().trim();
  const colNames = columns.map(c => c.name);

  // Categorize columns
  const numericCols = columns
    .filter(c => {
      const t = c.type.toUpperCase();
      return t.includes('INT') || t.includes('FLOAT') || t.includes('DOUBLE') || t.includes('DECIMAL') || t.includes('NUMERIC');
    })
    .map(c => c.name);

  const textCols = columns
    .filter(c => {
      const t = c.type.toUpperCase();
      return t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('STRING');
    })
    .map(c => c.name);

  const dateCols = columns
    .filter(c => {
      const t = c.type.toUpperCase();
      return t.includes('DATE') || t.includes('TIME');
    })
    .map(c => c.name);

  // Helper: Find best matching column name in question
  const findMentionedCol = (cols: string[]): string | undefined => {
    let bestCol: string | undefined = undefined;
    let maxScore = 0;

    for (const c of cols) {
      const lowerCol = c.toLowerCase();
      // Exact full name match in question
      if (q.includes(lowerCol)) {
        const score = lowerCol.length * 2;
        if (score > maxScore) {
          maxScore = score;
          bestCol = c;
        }
      }

      // Word-level match (e.g. "spent" in "TotalSpent" or "customer" in "CustomerName")
      const words = lowerCol.split(/[^a-z0-9]+/);
      for (const w of words) {
        if (w.length >= 3 && q.includes(w)) {
          const score = w.length;
          if (score > maxScore) {
            maxScore = score;
            bestCol = c;
          }
        }
      }

      // CamelCase token split (e.g., TotalSpent -> total, spent)
      const camelWords = c.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
      for (const w of camelWords) {
        if (w.length >= 3 && q.includes(w)) {
          const score = w.length;
          if (score > maxScore) {
            maxScore = score;
            bestCol = c;
          }
        }
      }
    }
    return bestCol;
  };

  // 1. Conversational greetings
  if (/^(hi|hello|hey|help|who are you|what can you do|about)\b/i.test(q)) {
    return {
      sql: `SELECT * FROM "${tableName}" LIMIT 5`,
      chart: { type: 'none', title: 'Data Preview' },
      kpis: [
        { label: 'Total Rows', value: rowCount },
        { label: 'Columns', value: columns.length }
      ],
      narrative: `Hello! I'm DataPilot AI. Your dataset "${tableName}" contains ${rowCount} rows across ${columns.length} columns. You can ask me to find specific trends, top contributors, category breakdowns, or summarize metrics.`
    };
  }

  // 2. "Top N" / "Highest" / "Lowest" / "Bottom N"
  const topMatch = q.match(/\b(top|bottom|highest|lowest|best|worst|first|last)\s*(\d+)?\b/i);
  if (topMatch) {
    const isBottom = /bottom|lowest|worst/i.test(topMatch[1]);
    const limit = topMatch[2] ? parseInt(topMatch[2], 10) : 5;
    const direction = isBottom ? 'ASC' : 'DESC';

    const groupCol = findMentionedCol(textCols) || textCols[0] || colNames[0];
    const metricCol = findMentionedCol(numericCols) || numericCols[0];

    if (groupCol && metricCol && groupCol !== metricCol) {
      return {
        sql: `SELECT "${groupCol}", SUM("${metricCol}") AS "Total ${metricCol}" FROM "${tableName}" GROUP BY "${groupCol}" ORDER BY "Total ${metricCol}" ${direction} LIMIT ${limit}`,
        chart: {
          type: 'bar',
          title: `${isBottom ? 'Bottom' : 'Top'} ${limit} ${groupCol} by ${metricCol}`,
          x_label: groupCol,
          y_label: metricCol
        },
        kpis: [
          { label: 'Metric', value: metricCol },
          { label: 'Limit', value: limit }
        ]
      };
    }
  }

  // 3. "By" / "Per" / "Breakdown" / "Distribution"
  if (/\b(by|per|breakdown|distribution|grouped by)\b/i.test(q)) {
    const groupCol = findMentionedCol(textCols) || findMentionedCol(dateCols) || textCols[0];
    const metricCol = findMentionedCol(numericCols);

    if (groupCol) {
      if (metricCol) {
        return {
          sql: `SELECT "${groupCol}", ROUND(SUM("${metricCol}"), 2) AS "Total ${metricCol}" FROM "${tableName}" GROUP BY "${groupCol}" ORDER BY "Total ${metricCol}" DESC LIMIT 20`,
          chart: {
            type: 'bar',
            title: `${metricCol} by ${groupCol}`,
            x_label: groupCol,
            y_label: metricCol
          },
          kpis: [
            { label: 'Grouping', value: groupCol },
            { label: 'Metric', value: metricCol }
          ]
        };
      } else {
        return {
          sql: `SELECT "${groupCol}", COUNT(*) AS "Record Count" FROM "${tableName}" GROUP BY "${groupCol}" ORDER BY "Record Count" DESC LIMIT 20`,
          chart: {
            type: 'bar',
            title: `Count by ${groupCol}`,
            x_label: groupCol,
            y_label: 'Count'
          },
          kpis: [
            { label: 'Grouping', value: groupCol }
          ]
        };
      }
    }
  }

  // 4. Aggregations: "Total", "Average", "Mean", "Sum", "Count"
  if (/\b(total|sum|average|avg|mean|max|maximum|min|minimum|count)\b/i.test(q)) {
    const metricCol = findMentionedCol(numericCols) || numericCols[0];
    if (metricCol) {
      const isAvg = /\b(average|avg|mean)\b/i.test(q);
      const isMax = /\b(max|maximum|highest)\b/i.test(q);
      const isMin = /\b(min|minimum|lowest)\b/i.test(q);

      if (isAvg) {
        return {
          sql: `SELECT ROUND(AVG("${metricCol}"), 2) AS "Average ${metricCol}", COUNT(*) AS "Count" FROM "${tableName}"`,
          chart: { type: 'none' },
          kpis: [{ label: `Avg ${metricCol}`, value: 'Calculated' }]
        };
      } else if (isMax) {
        return {
          sql: `SELECT MAX("${metricCol}") AS "Max ${metricCol}" FROM "${tableName}"`,
          chart: { type: 'none' },
          kpis: [{ label: `Max ${metricCol}`, value: 'Calculated' }]
        };
      } else if (isMin) {
        return {
          sql: `SELECT MIN("${metricCol}") AS "Min ${metricCol}" FROM "${tableName}"`,
          chart: { type: 'none' },
          kpis: [{ label: `Min ${metricCol}`, value: 'Calculated' }]
        };
      } else {
        return {
          sql: `SELECT ROUND(SUM("${metricCol}"), 2) AS "Total ${metricCol}", COUNT(*) AS "Total Rows" FROM "${tableName}"`,
          chart: { type: 'none' },
          kpis: [{ label: `Total ${metricCol}`, value: 'Calculated' }]
        };
      }
    }
  }

  // 5. "Give all", "Show all", "List", "Display", "All customers", etc.
  // Check if specific columns were asked for
  const mentionedCols = colNames.filter(c => {
    const clean = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean && q.includes(clean);
  });

  if (mentionedCols.length > 0) {
    const quotedCols = mentionedCols.map(c => `"${c}"`).join(', ');
    return {
      sql: `SELECT ${quotedCols} FROM "${tableName}" LIMIT 5000`,
      chart: { type: 'table', title: 'Selected Records' },
      kpis: [{ label: 'Selected Columns', value: mentionedCols.length }]
    };
  }

  // Default: SELECT * FROM tableName LIMIT 5000
  return {
    sql: `SELECT * FROM "${tableName}" LIMIT 5000`,
    chart: { type: 'table', title: 'Dataset Records' },
    kpis: [{ label: 'Total Rows', value: rowCount }]
  };
}

/**
 * Deterministically generates rich narrative and insights based on actual SQL execution results.
 * This guarantees the user always gets high quality commentary even when all LLMs are rate limited.
 */
export function generateDeterministicNarrative(
  question: string,
  sql: string,
  resultRows: any[],
  resultColumns: string[]
): { narrative: string; kpis: Array<{ label: string; value: string | number }>; insights: string[] } {
  const rowCount = resultRows.length;

  if (rowCount === 0) {
    return {
      narrative: `The query executed successfully, but no matching records were found.`,
      kpis: [{ label: 'Returned Rows', value: 0 }],
      insights: ['Try broadening your search criteria or checking available column values.']
    };
  }

  const kpis: Array<{ label: string; value: string | number }> = [
    { label: 'Returned Rows', value: rowCount }
  ];
  const insights: string[] = [];

  // If single row (aggregation)
  if (rowCount === 1) {
    const single = resultRows[0];
    const details: string[] = [];
    for (const col of resultColumns) {
      const val = single[col];
      details.push(`${col}: ${typeof val === 'number' ? val.toLocaleString() : val}`);
      if (kpis.length < 4) {
        kpis.push({ label: col, value: typeof val === 'number' ? Number(val.toFixed(2)) : String(val) });
      }
    }
    return {
      narrative: `Query completed with 1 summary record: ${details.join(', ')}.`,
      kpis,
      insights: ['Result computed directly from full dataset aggregation.']
    };
  }

  // If multi-row result
  const firstRow = resultRows[0];
  const numCols = resultColumns.filter(c => typeof firstRow[c] === 'number');
  const strCols = resultColumns.filter(c => typeof firstRow[c] === 'string');

  if (numCols.length > 0 && strCols.length > 0) {
    const groupCol = strCols[0];
    const metricCol = numCols[0];

    const topItem = resultRows[0];
    const bottomItem = resultRows[resultRows.length - 1];

    let totalMetric = 0;
    for (const r of resultRows) {
      totalMetric += Number(r[metricCol]) || 0;
    }

    kpis.push({
      label: `Top ${groupCol}`,
      value: String(topItem[groupCol])
    });

    if (totalMetric > 0) {
      kpis.push({
        label: `Total ${metricCol}`,
        value: Number(totalMetric.toFixed(2)).toLocaleString()
      });
    }

    insights.push(`"${topItem[groupCol]}" ranks highest with a ${metricCol} of ${Number(topItem[metricCol]).toLocaleString()}.`);
    if (rowCount > 1) {
      insights.push(`The dataset shows a range from ${Number(bottomItem[metricCol]).toLocaleString()} up to ${Number(topItem[metricCol]).toLocaleString()} across ${rowCount} categories.`);
    }

    return {
      narrative: `Retrieved ${rowCount} records. Leading the breakdown is "${topItem[groupCol]}" with ${metricCol} of ${Number(topItem[metricCol]).toLocaleString()}.`,
      kpis,
      insights
    };
  }

  // Plain table or list
  if (strCols.length > 0) {
    insights.push(`Columns include ${resultColumns.slice(0, 4).join(', ')}${resultColumns.length > 4 ? ' and others' : ''}.`);
  }

  return {
    narrative: `Successfully retrieved ${rowCount} rows matching your query "${question}".`,
    kpis,
    insights
  };
}
