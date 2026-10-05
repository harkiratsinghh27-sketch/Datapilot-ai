// Deterministic Analytics Query Engine for DataPilot AI
// Executes safe analytical queries with AlaSQL and high-speed in-memory fallbacks

export interface QueryFilter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'in' | 'between';
  value: any;
  secondValue?: any; // For 'between'
}

export interface StructuredAnalyticsPlan {
  intent: 'aggregation' | 'ranking' | 'trend' | 'comparison' | 'filter' | 'insights' | 'distribution';
  dimension?: string;
  secondaryDimension?: string;
  measure?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median';
  sort?: 'descending' | 'ascending' | 'none';
  limit?: number;
  filters?: QueryFilter[];
  timeGranularity?: 'month' | 'quarter' | 'year' | 'day';
  dateColumn?: string;
  isAnomalyQuery?: boolean;
  targetEntity?: { column: string; value: string };
  isGreeting?: boolean;
}

export interface QueryResult {
  success: boolean;
  rows: Record<string, any>[];
  columns: string[];
  executionTimeMs: number;
  rowCount: number;
  error?: string;
  executedQuery?: string;
}

// Ensure column names are safely escaped for SQL
export function escapeIdentifier(id: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
    return id;
  }
  return `\`${id.replace(/`/g, '``')}\``;
}

// Convert structured plan into safe executable SQL
export function planToSQL(plan: StructuredAnalyticsPlan, tableName: string = 'dataset'): string {
  const { intent, dimension, measure, aggregation = 'sum', sort = 'descending', limit, filters = [], timeGranularity, dateColumn } = plan;

  const whereClauses: string[] = [];

  for (const f of filters) {
    const col = escapeIdentifier(f.column);
    if (f.operator === 'contains') {
      const val = String(f.value).replace(/'/g, "''");
      whereClauses.push(`LOWER(${col}) LIKE LOWER('%${val}%')`);
    } else if (f.operator === 'in' && Array.isArray(f.value)) {
      const vals = f.value.map(v => typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`).join(', ');
      whereClauses.push(`${col} IN (${vals})`);
    } else if (f.operator === 'between') {
      whereClauses.push(`${col} BETWEEN '${f.value}' AND '${f.secondValue}'`);
    } else {
      const val = typeof f.value === 'number' ? f.value : `'${String(f.value).replace(/'/g, "''")}'`;
      whereClauses.push(`${col} ${f.operator} ${val}`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // 1. Overall Aggregation without dimension (e.g. Total Revenue, Avg Order Value)
  if (!dimension && measure && !timeGranularity && intent !== 'filter') {
    const aggFunc = aggregation.toUpperCase();
    const col = escapeIdentifier(measure);
    const aggAlias = `${aggregation}_${measure.toLowerCase()}`;
    return `SELECT ${aggFunc}(${col}) AS ${aggAlias}, COUNT(*) AS total_count FROM ${tableName} ${whereStr}`.trim();
  }

  // 2. Time-series / trend (e.g. Monthly Revenue)
  if (timeGranularity && (dateColumn || dimension)) {
    const targetDateCol = escapeIdentifier(dateColumn || dimension || 'Order_Date');
    const aggFunc = (aggregation || 'sum').toUpperCase();
    const measureCol = measure ? escapeIdentifier(measure) : '*';
    const measureExpr = measure ? `${aggFunc}(${measureCol})` : 'COUNT(*)';
    const measureAlias = measure ? `${aggregation}_${measure.toLowerCase()}` : 'record_count';

    // SQL standard date formatting (AlaSQL and SQLite support SUBSTR for YYYY-MM)
    let dateExpr = targetDateCol;
    let periodAlias = 'period';
    if (timeGranularity === 'month') {
      dateExpr = `SUBSTR(${targetDateCol}, 1, 7)`;
      periodAlias = 'month';
    } else if (timeGranularity === 'year') {
      dateExpr = `SUBSTR(${targetDateCol}, 1, 4)`;
      periodAlias = 'year';
    } else if (timeGranularity === 'quarter') {
      dateExpr = `SUBSTR(${targetDateCol}, 1, 4) || '-Q' || (CASE WHEN SUBSTR(${targetDateCol}, 6, 2) IN ('01','02','03') THEN '1' WHEN SUBSTR(${targetDateCol}, 6, 2) IN ('04','05','06') THEN '2' WHEN SUBSTR(${targetDateCol}, 6, 2) IN ('07','08','09') THEN '3' ELSE '4' END)`;
      periodAlias = 'quarter';
    }

    const orderClause = intent === 'ranking'
      ? (sort === 'ascending' ? `ORDER BY ${measureAlias} ASC` : `ORDER BY ${measureAlias} DESC`)
      : `ORDER BY ${periodAlias} ASC`;

    return `SELECT ${dateExpr} AS ${periodAlias}, ${measureExpr} AS ${measureAlias} FROM ${tableName} ${whereStr} GROUP BY ${dateExpr} ${orderClause} ${limit ? `LIMIT ${limit}` : ''}`.trim();
  }

  // 3. Dimensional aggregation (e.g. Top 5 Products by Revenue, Revenue by Region)
  if (dimension) {
    const dimCol = escapeIdentifier(dimension);
    const aggFunc = (aggregation || 'sum').toUpperCase();
    const measureCol = measure ? escapeIdentifier(measure) : '*';
    const measureExpr = measure ? `${aggFunc}(${measureCol})` : 'COUNT(*)';
    const measureAlias = measure ? `${aggregation}_${measure.toLowerCase()}` : 'record_count';

    let orderClause = '';
    if (sort === 'descending') {
      orderClause = `ORDER BY ${measureAlias} DESC`;
    } else if (sort === 'ascending') {
      orderClause = `ORDER BY ${measureAlias} ASC`;
    }

    const limitClause = limit ? `LIMIT ${limit}` : '';

    return `SELECT ${dimCol}, ${measureExpr} AS ${measureAlias} FROM ${tableName} ${whereStr} GROUP BY ${dimCol} ${orderClause} ${limitClause}`.trim();
  }

  // 4. Filtered raw rows (e.g. Orders above 10,000)
  return `SELECT * FROM ${tableName} ${whereStr} ${limit ? `LIMIT ${limit}` : 'LIMIT 50'}`.trim();
}

// Validate SQL query to forbid unsafe destructive operations
export function validateSQLSecurity(sql: string): { valid: boolean; reason?: string } {
  const lower = sql.toLowerCase().trim();
  const forbiddenKeywords = [
    'drop ', 'delete ', 'insert ', 'update ', 'alter ', 'create ',
    'truncate ', 'exec ', 'execute ', 'eval', 'script', 'xp_',
    'grant ', 'revoke ', 'attach ', 'pragma '
  ];

  for (const kw of forbiddenKeywords) {
    if (lower.includes(kw)) {
      return { valid: false, reason: `Disallowed keyword in query: ${kw.trim()}` };
    }
  }

  if (!lower.startsWith('select ') && !lower.startsWith('with ')) {
    return { valid: false, reason: 'Query must be a SELECT statement.' };
  }

  return { valid: true };
}

// High-Speed Pure Deterministic Analytical Query Engine
export function executeInJS(sql: string, dataset: Record<string, any>[]): QueryResult {
  const startTime = performance.now();

  try {
    const rows = runNativeAnalyticalFallback(sql, dataset);
    const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
    return {
      success: true,
      rows,
      columns: cols,
      rowCount: rows.length,
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      executedQuery: sql
    };
  } catch (error: any) {
    return {
      success: false,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: Math.round((performance.now() - startTime) * 10) / 10,
      error: error.message || 'Error executing analytics query.',
      executedQuery: sql
    };
  }
}

// Native JS analytical fallback that parses common SELECT ... GROUP BY ... ORDER BY ... LIMIT patterns
function runNativeAnalyticalFallback(sql: string, data: Record<string, any>[]): Record<string, any>[] {
  const cleanSql = sql.replace(/\s+/g, ' ').trim();
  
  // Extract LIMIT
  let limit: number | undefined;
  const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
  if (limitMatch) {
    limit = parseInt(limitMatch[1], 10);
  }

  // Extract WHERE
  let filteredData = data;
  const whereMatch = cleanSql.match(/WHERE\s+(.*?)(?=\s+GROUP\s+BY|\s+ORDER\s+BY|\s+LIMIT|$)/i);
  if (whereMatch) {
    const conditionStr = whereMatch[1];
    filteredData = applyNativeWhere(filteredData, conditionStr);
  }

  // Extract GROUP BY
  const groupByMatch = cleanSql.match(/GROUP\s+BY\s+(.*?)(?=\s+ORDER\s+BY|\s+LIMIT|$)/i);
  if (groupByMatch) {
    const rawGroupExpr = groupByMatch[1].trim();
    // Check if grouping by SUBSTR(col, 1, 7) for month
    const isSubstrMonth = /SUBSTR\s*\(\s*(\w+)\s*,\s*1\s*,\s*7\s*\)/i.test(rawGroupExpr);
    let groupCol = rawGroupExpr;
    const substrMatch = rawGroupExpr.match(/SUBSTR\s*\(\s*(\w+)\s*,/i);
    if (substrMatch) {
      groupCol = substrMatch[1];
    } else {
      const groupColMatch = rawGroupExpr.match(/(\w+)/);
      if (groupColMatch) groupCol = groupColMatch[1];
    }

    // Check aggregations in SELECT
    const sumMatch = cleanSql.match(/SUM\s*\(\s*(\w+)\s*\)/i);
    const avgMatch = cleanSql.match(/AVG\s*\(\s*(\w+)\s*\)/i);
    const countMatch = cleanSql.match(/COUNT\s*\(\s*(\*|\w+)\s*\)/i);
    const minMatch = cleanSql.match(/MIN\s*\(\s*(\w+)\s*\)/i);
    const maxMatch = cleanSql.match(/MAX\s*\(\s*(\w+)\s*\)/i);

    const groups: Record<string, { count: number; sum: number; min: number; max: number; values: number[] }> = {};

    for (const row of filteredData) {
      let key = String(row[groupCol] ?? 'Unknown');
      if (isSubstrMonth && row[groupCol]) {
        key = String(row[groupCol]).substring(0, 7);
      }

      if (!groups[key]) {
        groups[key] = { count: 0, sum: 0, min: Infinity, max: -Infinity, values: [] };
      }

      groups[key].count++;

      const measureCol = sumMatch?.[1] || avgMatch?.[1] || minMatch?.[1] || maxMatch?.[1];
      if (measureCol && row[measureCol] !== undefined && row[measureCol] !== null) {
        const val = Number(row[measureCol]) || 0;
        groups[key].sum += val;
        groups[key].values.push(val);
        if (val < groups[key].min) groups[key].min = val;
        if (val > groups[key].max) groups[key].max = val;
      }
    }

    let results = Object.entries(groups).map(([k, g]) => {
      const out: Record<string, any> = {};
      const keyAlias = isSubstrMonth ? 'month' : groupCol;
      out[keyAlias] = k;

      if (sumMatch) {
        out[`sum_${sumMatch[1].toLowerCase()}`] = Math.round(g.sum * 100) / 100;
      }
      if (avgMatch) {
        const avg = g.count > 0 ? g.sum / g.count : 0;
        out[`avg_${avgMatch[1].toLowerCase()}`] = Math.round(avg * 100) / 100;
      }
      if (countMatch && !sumMatch && !avgMatch) {
        out['record_count'] = g.count;
      }
      if (minMatch) {
        out[`min_${minMatch[1].toLowerCase()}`] = g.min === Infinity ? 0 : g.min;
      }
      if (maxMatch) {
        out[`max_${maxMatch[1].toLowerCase()}`] = g.max === -Infinity ? 0 : g.max;
      }

      return out;
    });

    // Extract ORDER BY
    const orderMatch = cleanSql.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
    if (orderMatch) {
      const orderCol = orderMatch[1];
      const isDesc = (orderMatch[2] || 'ASC').toUpperCase() === 'DESC';
      results.sort((a, b) => {
        const valA = a[orderCol] ?? Object.values(a)[1] ?? 0;
        const valB = b[orderCol] ?? Object.values(b)[1] ?? 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return isDesc ? valB - valA : valA - valB;
        }
        return isDesc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
      });
    }

    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  // Overall Aggregation without GROUP BY (e.g. SELECT SUM(Revenue), COUNT(*))
  const sumMatch = cleanSql.match(/SUM\s*\(\s*(\w+)\s*\)/i);
  const avgMatch = cleanSql.match(/AVG\s*\(\s*(\w+)\s*\)/i);
  const countMatch = cleanSql.match(/COUNT\s*\(\s*(\*|\w+)\s*\)/i);

  if (sumMatch || avgMatch || countMatch) {
    let sum = 0;
    let count = 0;
    const measureCol = sumMatch?.[1] || avgMatch?.[1];

    for (const r of filteredData) {
      count++;
      if (measureCol && r[measureCol] !== undefined && r[measureCol] !== null) {
        sum += Number(r[measureCol]) || 0;
      }
    }

    const res: Record<string, any> = {};
    if (sumMatch) res[`sum_${sumMatch[1].toLowerCase()}`] = Math.round(sum * 100) / 100;
    if (avgMatch) res[`avg_${avgMatch[1].toLowerCase()}`] = count > 0 ? Math.round((sum / count) * 100) / 100 : 0;
    if (countMatch) res['total_count'] = count;

    return [res];
  }

  // Fallback: simple sliced rows with optional ORDER BY
  const rawOrderMatch = cleanSql.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
  let sortedRows = [...filteredData];
  if (rawOrderMatch) {
    const col = rawOrderMatch[1];
    const isDesc = (rawOrderMatch[2] || 'ASC').toUpperCase() === 'DESC';
    sortedRows.sort((a, b) => {
      const valA = a[col] ?? 0;
      const valB = b[col] ?? 0;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return isDesc ? valB - valA : valA - valB;
      }
      return isDesc ? String(valB).localeCompare(String(valA)) : String(valA).localeCompare(String(valB));
    });
  }

  return sortedRows.slice(0, limit || 50);
}

// Multi-condition WHERE evaluation supporting AND, BETWEEN, LIKE, =, !=, >, <, >=, <=
function applyNativeWhere(data: Record<string, any>[], where: string): Record<string, any>[] {
  const clauses = where.split(/\s+AND\s+/i);
  let current = data;

  for (const clause of clauses) {
    const trimmed = clause.trim();
    if (!trimmed) continue;

    // BETWEEN
    const betweenMatch = trimmed.match(/(\w+)\s+BETWEEN\s+'([^']+)'\s+AND\s+'([^']+)'/i);
    if (betweenMatch) {
      const [, col, v1, v2] = betweenMatch;
      current = current.filter(r => {
        const val = String(r[col] ?? '');
        return val >= v1 && val <= v2;
      });
      continue;
    }

    // LIKE
    const likeMatch = trimmed.match(/(?:LOWER\s*\(\s*)?(\w+)(?:\s*\))?\s+LIKE\s+(?:LOWER\s*\(\s*)?'%([^%]+)%'(?:\s*\))?/i);
    if (likeMatch) {
      const [, col, search] = likeMatch;
      current = current.filter(r => String(r[col] ?? '').toLowerCase().includes(search.toLowerCase()));
      continue;
    }

    // = (string or number)
    const eqMatch = trimmed.match(/(\w+)\s*=\s*'([^']*)'/i) || trimmed.match(/(\w+)\s*=\s*(\d+(?:\.\d+)?)/i);
    if (eqMatch) {
      const [, col, val] = eqMatch;
      current = current.filter(r => String(r[col] ?? '').toLowerCase() === String(val).toLowerCase());
      continue;
    }

    // !=
    const neqMatch = trimmed.match(/(\w+)\s*!=\s*'([^']*)'/i) || trimmed.match(/(\w+)\s*!=\s*(\d+(?:\.\d+)?)/i);
    if (neqMatch) {
      const [, col, val] = neqMatch;
      current = current.filter(r => String(r[col] ?? '').toLowerCase() !== String(val).toLowerCase());
      continue;
    }

    // >=
    const numGteMatch = trimmed.match(/(\w+)\s*>=\s*(\d+(?:\.\d+)?)/i);
    if (numGteMatch) {
      const [, col, val] = numGteMatch;
      const threshold = parseFloat(val);
      current = current.filter(r => Number(r[col]) >= threshold);
      continue;
    }

    // <=
    const numLteMatch = trimmed.match(/(\w+)\s*<=\s*(\d+(?:\.\d+)?)/i);
    if (numLteMatch) {
      const [, col, val] = numLteMatch;
      const threshold = parseFloat(val);
      current = current.filter(r => Number(r[col]) <= threshold);
      continue;
    }

    // >
    const numGtMatch = trimmed.match(/(\w+)\s*>\s*(\d+(?:\.\d+)?)/i);
    if (numGtMatch) {
      const [, col, val] = numGtMatch;
      const threshold = parseFloat(val);
      current = current.filter(r => Number(r[col]) > threshold);
      continue;
    }

    // <
    const numLtMatch = trimmed.match(/(\w+)\s*<\s*(\d+(?:\.\d+)?)/i);
    if (numLtMatch) {
      const [, col, val] = numLtMatch;
      const threshold = parseFloat(val);
      current = current.filter(r => Number(r[col]) < threshold);
      continue;
    }
  }

  return current;
}
