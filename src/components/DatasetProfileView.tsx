'use client';

import React from 'react';
import { 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  HelpCircle, 
  BarChart, 
  Database,
  Hash,
  Copy
} from 'lucide-react';
import { DatasetProfile } from '@/types/dataset';
import { formatValue } from '@/lib/agent';

interface DatasetProfileViewProps {
  profile: DatasetProfile;
}

export const DatasetProfileView: React.FC<DatasetProfileViewProps> = ({ profile }) => {
  return (
    <div className="w-full space-y-6">
      
      {/* Top Health & Summary Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <Database className="w-4 h-4 text-blue-500" />
            <span>Total Rows</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {profile.rowCount.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400">Records indexed</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <Hash className="w-4 h-4 text-indigo-500" />
            <span>Total Columns</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {profile.columnCount}
          </p>
          <span className="text-[11px] text-slate-400">Dimensions & measures</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <Copy className="w-4 h-4 text-amber-500" />
            <span>Duplicate Rows</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {profile.duplicateRowsCount}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {profile.duplicateRowsCount === 0 ? '✓ No duplicates' : `${profile.duplicateRowsCount} duplicates detected`}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            <span>Missing Values</span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {profile.missingValuesCount}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            {profile.missingValuesCount === 0 ? '✓ Complete dataset' : 'Null cells detected'}
          </span>
        </div>

      </div>

      {/* Semantic Schema & Statistics Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <span>Column Profiling & Statistics</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic type detection, semantic role mapping, and summary distribution metrics
          </p>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3 whitespace-nowrap">Column Name</th>
                  <th className="px-4 py-3 whitespace-nowrap">Detected Type</th>
                  <th className="px-4 py-3 whitespace-nowrap">Semantic Role</th>
                  <th className="px-4 py-3 whitespace-nowrap">Unique Values</th>
                  <th className="px-4 py-3 whitespace-nowrap">Missing %</th>
                  <th className="px-4 py-3 whitespace-nowrap">Min / Max</th>
                  <th className="px-4 py-3 whitespace-nowrap">Mean / Median</th>
                  <th className="px-4 py-3 whitespace-nowrap">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {profile.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {col.name}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {col.type}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        col.semanticRole === 'revenue' || col.semanticRole === 'profit'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                          : col.semanticRole === 'cost' || col.semanticRole === 'expense'
                          ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300'
                          : col.semanticRole === 'date'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300'
                          : col.semanticRole === 'product' || col.semanticRole === 'category'
                          ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      }`}>
                        {col.semanticRole}
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 dark:text-slate-300 font-mono">
                      {col.uniqueCount.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={col.nullCount > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-medium'}>
                        {col.nullPercentage}% ({col.nullCount})
                      </span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {col.min !== undefined && col.max !== undefined
                        ? `${typeof col.min === 'number' ? formatValue(col.min) : col.min} - ${typeof col.max === 'number' ? formatValue(col.max) : col.max}`
                        : '-'}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                      {col.mean !== undefined && col.median !== undefined
                        ? `μ: ${formatValue(col.mean)} | m: ${formatValue(col.median)}`
                        : '-'}
                    </td>

                    <td className="px-4 py-3 text-slate-500 text-[11px] max-w-xs truncate">
                      {col.sampleValues.map(v => String(v)).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
