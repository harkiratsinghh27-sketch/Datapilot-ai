'use client';

import React from 'react';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Package, 
  MapPin, 
  ArrowRight,
  Sparkles,
  Award
} from 'lucide-react';
import { DatasetProfile } from '@/types/dataset';
import { formatValue } from '@/lib/agent';
import { resolveBusinessColumns } from '@/lib/profiler';
import { AnalyticsChart } from './AnalyticsChart';

interface OverviewDashboardProps {
  profile: DatasetProfile;
  dataset: Record<string, any>[];
  onAskQuestion: (question: string) => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  profile,
  dataset,
  onAskQuestion
}) => {
  // Compute overview metrics deterministically from dataset
  const overviewData = React.useMemo(() => {
    if (!dataset || dataset.length === 0) return null;

    // Bulletproof column resolution using verified business column resolver
    const cols = resolveBusinessColumns(profile, dataset);
    const revCol = cols.revenueCol;
    const profitCol = cols.profitCol;
    const qtyCol = cols.quantityCol;
    const prodCol = cols.productCol;
    const regCol = cols.regionCol;
    const dateCol = cols.dateCol;
    const catCol = cols.categoryCol;

    let totalRevenue = 0;
    let totalProfit = 0;
    let totalQuantity = 0;
    const productRevenue: Record<string, number> = {};
    const regionRevenue: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};
    const categoryRevenue: Record<string, number> = {};

    for (const row of dataset) {
      const rev = revCol ? Number(row[revCol]) || 0 : 0;
      const profit = profitCol ? Number(row[profitCol]) || 0 : 0;
      const qty = qtyCol ? Number(row[qtyCol]) || 0 : 1;

      totalRevenue += rev;
      totalProfit += profit;
      totalQuantity += qty;

      if (prodCol && row[prodCol]) {
        productRevenue[row[prodCol]] = (productRevenue[row[prodCol]] || 0) + rev;
      }
      if (regCol && row[regCol]) {
        regionRevenue[row[regCol]] = (regionRevenue[row[regCol]] || 0) + rev;
      }
      if (catCol && row[catCol]) {
        categoryRevenue[row[catCol]] = (categoryRevenue[row[catCol]] || 0) + rev;
      }
      if (dateCol && row[dateCol]) {
        const monthKey = String(row[dateCol]).substring(0, 7);
        monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + rev;
      }
    }

    const orderCount = dataset.length;
    const aov = orderCount > 0 && totalRevenue > 0 ? totalRevenue / orderCount : 0;

    // Find top product
    const topProdEntry = Object.entries(productRevenue).sort((a, b) => b[1] - a[1])[0];
    // Find top region
    const topRegEntry = Object.entries(regionRevenue).sort((a, b) => b[1] - a[1])[0];

    // Format monthly trend chart data
    const monthlyData = Object.entries(monthlyRevenue)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ name: k, value: Math.round(v) }));

    // Format category distribution chart data
    const categoryData = Object.entries(categoryRevenue)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ name: k, value: Math.round(v) }));

    return {
      totalRevenue,
      totalProfit,
      totalQuantity,
      orderCount,
      aov,
      topProduct: topProdEntry ? { name: topProdEntry[0], revenue: topProdEntry[1] } : null,
      topRegion: topRegEntry ? { name: topRegEntry[0], revenue: topRegEntry[1] } : null,
      monthlyData,
      categoryData
    };
  }, [dataset, profile]);

  if (!overviewData) return null;

  return (
    <div className="w-full space-y-6">
      
      {/* Header banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-lg shadow-blue-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-200 text-xs font-semibold mb-1">
            <Sparkles className="w-4 h-4 text-blue-300" />
            <span>EXECUTIVE OVERVIEW</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {profile.fileName}
          </h2>
          <p className="text-sm text-blue-100 mt-1 max-w-xl">
            {profile.summary} Evaluated deterministically with automatic metric detection.
          </p>
        </div>

        <button
          onClick={() => onAskQuestion('Give me 5 business insights from this dataset')}
          className="px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-2 shrink-0"
        >
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span>Ask AI for Top Insights</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Total Revenue</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatValue(overviewData.totalRevenue, '$')}
            </span>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              Across {overviewData.orderCount.toLocaleString()} total orders
            </p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Total Orders</span>
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {overviewData.orderCount.toLocaleString()}
            </span>
            <p className="text-xs text-slate-500 mt-1">
              {overviewData.totalQuantity.toLocaleString()} units sold
            </p>
          </div>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Average Order Value</span>
            <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatValue(overviewData.aov, '$')}
            </span>
            <p className="text-xs text-teal-600 dark:text-teal-400 font-medium mt-1">
              Revenue per transaction
            </p>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">Total Profit</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {formatValue(overviewData.totalProfit, '$')}
            </span>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              {overviewData.totalRevenue > 0
                ? `${((overviewData.totalProfit / overviewData.totalRevenue) * 100).toFixed(1)}% margin`
                : '100% computed'}
            </p>
          </div>
        </div>

      </div>

      {/* Highlights: Top Product & Top Region */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {overviewData.topProduct && (
          <div
            onClick={() => onAskQuestion(`Show details for product ${overviewData.topProduct?.name}`)}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <Package className="w-4 h-4 text-blue-500" />
                <span>TOP PRODUCT BY REVENUE</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 truncate">
              {overviewData.topProduct.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Generated <span className="font-bold text-slate-900 dark:text-white">{formatValue(overviewData.topProduct.revenue, '$')}</span> in total sales
            </p>
          </div>
        )}

        {overviewData.topRegion && (
          <div
            onClick={() => onAskQuestion(`Show performance for region ${overviewData.topRegion?.name}`)}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all cursor-pointer shadow-sm group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-500">
                <MapPin className="w-4 h-4 text-emerald-500" />
                <span>TOP PERFORMING REGION</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 truncate">
              {overviewData.topRegion.name} Region
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Generated <span className="font-bold text-slate-900 dark:text-white">{formatValue(overviewData.topRegion.revenue, '$')}</span> in total sales
            </p>
          </div>
        )}
      </div>

      {/* Visual Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overviewData.monthlyData.length > 0 && (
          <AnalyticsChart
            config={{
              type: 'line',
              title: 'Monthly Revenue Trend',
              xAxis: 'name',
              yAxis: 'value',
              data: overviewData.monthlyData,
              unit: '$'
            }}
          />
        )}

        {overviewData.categoryData.length > 0 && (
          <AnalyticsChart
            config={{
              type: 'bar',
              title: 'Revenue by Category',
              xAxis: 'name',
              yAxis: 'value',
              data: overviewData.categoryData,
              unit: '$'
            }}
          />
        )}
      </div>

    </div>
  );
};
