'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  ArrowUpDown, 
  Table as TableIcon, 
  Filter, 
  Tag
} from 'lucide-react';
import { DatasetProfile } from '@/types/dataset';

interface DataExplorerProps {
  profile: DatasetProfile;
  dataset: Record<string, any>[];
}

export const DataExplorer: React.FC<DataExplorerProps> = ({ profile, dataset }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const columns = useMemo(() => {
    return profile.columns.map(c => c.name);
  }, [profile]);

  // Filter and sort first 50 rows
  const filteredRows = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];

    let rows = dataset;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter(r =>
        columns.some(c => String(r[c] ?? '').toLowerCase().includes(term))
      );
    }

    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const valA = a[sortCol];
        const valB = b[sortCol];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        return sortAsc
          ? String(valA ?? '').localeCompare(String(valB ?? ''))
          : String(valB ?? '').localeCompare(String(valA ?? ''));
      });
    }

    return rows.slice(0, 50);
  }, [dataset, searchTerm, sortCol, sortAsc, columns]);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!dataset || dataset.length === 0) return;
    const header = columns.map(c => `"${c}"`).join(',');
    const rows = dataset.map(r => columns.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([`${header}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.fileName || 'dataset'}_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      
      {/* Explorer Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <TableIcon className="w-5 h-5 text-blue-600" />
            <span>Dataset Preview</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing {filteredRows.length} of {dataset.length.toLocaleString()} rows • Sortable columns & full-text filter
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search in rows..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44 sm:w-60"
            />
          </div>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV</span>
          </button>
        </div>
      </div>

      {/* Table with horizontal scroll */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/50">
        <div className="max-h-[600px] overflow-x-auto overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap text-slate-400 font-medium">#</th>
                {profile.columns.map((col) => (
                  <th
                    key={col.name}
                    onClick={() => toggleSort(col.name)}
                    className="px-4 py-3 cursor-pointer hover:bg-slate-200/80 dark:hover:bg-slate-700/80 transition-colors whitespace-nowrap"
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900 dark:text-white">{col.name}</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        {sortCol === col.name && (
                          <span className="text-blue-500 text-[10px]">{sortAsc ? '▲' : '▼'}</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-normal bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {col.type}
                        </span>
                        {col.semanticRole !== 'unknown' && col.semanticRole !== 'dimension' && col.semanticRole !== 'measure' && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                            {col.semanticRole}
                          </span>
                        )}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-400 font-mono text-[11px]">
                    {idx + 1}
                  </td>
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-2.5 whitespace-nowrap text-slate-800 dark:text-slate-200">
                      {typeof row[c] === 'number'
                        ? Number.isInteger(row[c]) ? row[c].toLocaleString() : row[c].toFixed(2)
                        : String(row[c] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
