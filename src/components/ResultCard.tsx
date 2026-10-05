'use client';

import React, { useState } from 'react';
import { 
  Copy, 
  Check, 
  Lightbulb, 
  Download, 
  Table as TableIcon,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { AIAnalysisResponse } from '@/types/dataset';
import { AnalyticsChart } from './AnalyticsChart';
import { formatValue } from '@/lib/agent';

interface ResultCardProps {
  analysis: AIAnalysisResponse;
  onAskQuestion?: (question: string) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ analysis, onAskQuestion }) => {
  const [copiedAnswer, setCopiedAnswer] = useState(false);
  const [copiedTable, setCopiedTable] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const {
    answer,
    metrics = [],
    table,
    chart,
    insights = [],
    warnings = [],
    followUpQuestions = []
  } = analysis;

  const handleCopyAnswer = () => {
    navigator.clipboard.writeText(answer);
    setCopiedAnswer(true);
    setTimeout(() => setCopiedAnswer(false), 2000);
  };

  const handleCopyTable = () => {
    if (!table || table.rows.length === 0) return;
    const header = table.columns.join('\t');
    const rows = table.rows.map(r => table.columns.map(c => r[c] ?? '').join('\t')).join('\n');
    navigator.clipboard.writeText(`${header}\n${rows}`);
    setCopiedTable(true);
    setTimeout(() => setCopiedTable(false), 2000);
  };

  const handleDownloadTableCSV = () => {
    if (!table || table.rows.length === 0) return;
    const header = table.columns.map(c => `"${c}"`).join(',');
    const rows = table.rows.map(r => table.columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const csvContent = `${header}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `datapilot_analysis_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Sort table rows if requested
  const sortedRows = React.useMemo(() => {
    if (!table || !table.rows) return [];
    if (!sortCol) return table.rows;
    return [...table.rows].sort((a, b) => {
      const valA = a[sortCol];
      const valB = b[sortCol];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    });
  }, [table, sortCol, sortAsc]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  // Helper to render bold markdown (**text**) and paragraph breaks into styled HTML elements
  const renderFormattedContent = (content: string) => {
    if (!content) return null;
    const paragraphs = content.split('\n\n');
    return paragraphs.map((para, pIdx) => {
      const parts = para.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={pIdx} className={pIdx > 0 ? 'mt-2.5 text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed' : 'text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-relaxed'}>
          {parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-bold text-slate-950 dark:text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
      
      {/* 1. Header & Text Answer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Grounded Analytics Result</span>
            </span>
          </div>

          <button
            onClick={handleCopyAnswer}
            className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {copiedAnswer ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAnswer ? 'Copied' : 'Copy Summary'}</span>
          </button>
        </div>

        <div className="font-normal">
          {renderFormattedContent(answer)}
        </div>

        {/* Calculation Section */}
        {analysis.calculation && (
          <details className="mt-4 group border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-800/30">
            <summary className="cursor-pointer px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-between">
              <span>How this was calculated</span>
              <ChevronRight className="w-4 h-4 text-slate-400 group-open:rotate-90 transition-transform" />
            </summary>
            <div className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300 border-t border-slate-200 dark:border-slate-800 space-y-2">
              {analysis.calculation.dataUsed && analysis.calculation.dataUsed.length > 0 && (
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1">Data Used:</strong>
                  <ul className="list-disc list-inside">
                    {analysis.calculation.dataUsed.map((item, idx) => <li key={idx}>{item}</li>)}
                  </ul>
                </div>
              )}
              {analysis.calculation.formula && (
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1">Formula:</strong>
                  <code className="bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded text-[11px] font-mono">{analysis.calculation.formula}</code>
                </div>
              )}
              {analysis.calculation.steps && analysis.calculation.steps.length > 0 && (
                <div>
                  <strong className="text-slate-900 dark:text-white block mb-1">Calculation Steps:</strong>
                  <ul className="list-decimal list-inside space-y-1">
                    {analysis.calculation.steps.map((step, idx) => <li key={idx}>{step}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </details>
        )}
      </div>

      {/* 2. KPI Cards */}
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m, idx) => (
            <div
              key={idx}
              className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">{m.label}</span>
              <div className="flex items-baseline space-x-2 mt-1">
                <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {typeof m.value === 'number' ? formatValue(m.value, '$') : m.value}
                </span>
                {m.change && (
                  <span className={`text-xs font-semibold flex items-center ${m.trend === 'down' ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {m.trend === 'down' ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5" />}
                    {m.change}
                  </span>
                )}
              </div>
              {m.subtext && (
                <span className="text-xs text-slate-400 mt-1 truncate">{m.subtext}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Interactive Chart */}
      {chart && <AnalyticsChart config={chart} />}

      {/* 4. Interactive Data Table */}
      {table && table.rows && table.rows.length > 0 && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-900">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-800/60">
            <div className="flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Data Table ({table.rows.length} rows)
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyTable}
                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors"
                title="Copy table to clipboard"
              >
                {copiedTable ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copiedTable ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={handleDownloadTableCSV}
                className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors"
                title="Download CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-x-auto overflow-y-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
                <tr>
                  {table.columns.map((c) => (
                    <th
                      key={c}
                      onClick={() => toggleSort(c)}
                      className="px-4 py-2.5 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{c}</span>
                        {sortCol === c && (
                          <span className="text-blue-500 text-[10px]">{sortAsc ? '▲' : '▼'}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedRows.map((r, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors">
                    {table.columns.map((c) => {
                      const isMoneyCol = /revenue|sales|profit|cost|price|spend|amount|aov/i.test(c);
                      return (
                        <td key={c} className="px-4 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                          {typeof r[c] === 'number'
                            ? isMoneyCol
                              ? `$${Number.isInteger(r[c]) ? r[c].toLocaleString() : r[c].toFixed(2)}`
                              : Number.isInteger(r[c]) ? r[c].toLocaleString() : r[c].toFixed(2)
                            : String(r[c] ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Problem Solving & Actionable Business Takeaways */}
      {insights && insights.length > 0 && (
        <div className="p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 space-y-2.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-900 dark:text-blue-200">
            <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Problem Solving & Strategic Takeaways</span>
          </div>
          <ul className="space-y-1.5 text-xs text-blue-950 dark:text-blue-200 list-disc list-inside">
            {insights.map((ins, idx) => (
              <li key={idx} className="leading-relaxed font-normal">
                {ins.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
                  part.startsWith('**') && part.endsWith('**') ? (
                    <strong key={i} className="font-bold text-blue-950 dark:text-white">
                      {part.slice(2, -2)}
                    </strong>
                  ) : (
                    part
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 6. Warnings (if any data quality caveat) */}
      {warnings && warnings.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start space-x-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {warnings.map((w, idx) => (
              <p key={idx}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* 7. Suggested Next Inquiries (Interactive Clickable Chips) */}
      {followUpQuestions && followUpQuestions.length > 0 && onAskQuestion && (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Suggested Next Inquiries</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {followUpQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onAskQuestion(q)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/70 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-sm group"
              >
                <span>{q}</span>
                <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
