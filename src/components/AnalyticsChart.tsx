'use client';

import React, { useState, useRef } from 'react';
import { Download } from 'lucide-react';
import { ChartConfig } from '@/types/dataset';
import { formatValue } from '@/lib/agent';

interface AnalyticsChartProps {
  config: ChartConfig;
}

const PALETTE = [
  '#2563eb', // Blue
  '#0d9488', // Teal
  '#7c3aed', // Purple
  '#ea580c', // Orange
  '#059669', // Emerald
  '#d97706', // Amber
  '#db2777', // Pink
  '#4f46e5', // Indigo
];

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ config }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { type, title, xAxis, yAxis, data, unit = '$' } = config;

  if (!data || data.length === 0) return null;

  const handleDownloadSVG = () => {
    if (!chartRef.current) return;
    const svgElem = chartRef.current.querySelector('svg');
    if (!svgElem) return;

    const svgData = new XMLSerializer().serializeToString(svgElem);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_chart.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Dimensions
  const isHBar = type === 'horizontal_bar';
  const width = 640;
  const height = 280;
  const padding = { top: 30, right: 35, bottom: 45, left: isHBar ? 120 : 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const numericValues = data.map(d => Number(d.value) || 0);
  const maxVal = Math.max(...numericValues, 1);
  const minVal = Math.min(...numericValues, 0);

  // SVG Line Chart Calculation
  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = padding.top + chartH - ((Number(d.value) || 0) / maxVal) * chartH;
    return { x, y, name: d.name, value: d.value };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`
    : '';

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 my-3 shadow-sm" ref={chartRef}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
          <p className="text-xs text-slate-500">Interactive SVG Visualizer • Hover for data values</p>
        </div>
        <button
          onClick={handleDownloadSVG}
          className="flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors shadow-2xs"
          title="Download chart image"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export SVG</span>
        </button>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartH * (1 - pct);
            const val = maxVal * pct;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#94a3b8"
                  strokeOpacity="0.2"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94a3b8"
                  fontWeight="500"
                >
                  {formatValue(val, unit)}
                </text>
              </g>
            );
          })}

          {/* Line Chart */}
          {type === 'line' && (
            <g>
              <path d={areaD} fill="url(#areaGradient)" />
              <path
                d={pathD}
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={hoverIndex === i ? 6 : 4}
                    fill={hoverIndex === i ? '#1d4ed8' : '#2563eb'}
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="cursor-pointer transition-all"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  />
                  {/* X Axis Label */}
                  {(i % Math.ceil(points.length / 8) === 0 || i === points.length - 1) && (
                    <text
                      x={p.x}
                      y={height - padding.bottom + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#64748b"
                    >
                      {p.name}
                    </text>
                  )}
                </g>
              ))}
            </g>
          )}

          {/* Horizontal Bar Chart (Top rankings) */}
          {type === 'horizontal_bar' && (
            <g>
              {data.map((d, i) => {
                const barH = Math.min(22, (chartH / data.length) - 6);
                const y = padding.top + i * (chartH / data.length) + 4;
                const barW = Math.max(4, ((Number(d.value) || 0) / maxVal) * chartW);
                const isHovered = hoverIndex === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-pointer"
                  >
                    <text
                      x={padding.left - 8}
                      y={y + barH / 1.4}
                      textAnchor="end"
                      fontSize="10"
                      fontWeight="600"
                      fill="#64748b"
                    >
                      {String(d.name).length > 20 ? `${String(d.name).slice(0, 18)}..` : d.name}
                    </text>

                    <rect
                      x={padding.left}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="4"
                      fill={PALETTE[i % PALETTE.length]}
                      opacity={isHovered ? 1 : 0.88}
                      className="transition-all"
                    />

                    <text
                      x={padding.left + barW + 8}
                      y={y + barH / 1.4}
                      fontSize="10"
                      fontWeight="bold"
                      fill="#475569"
                    >
                      {formatValue(d.value, unit)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {/* Vertical Bar Chart (Default) */}
          {(type === 'bar' || type === 'donut' || type === 'scatter') && (
            <g>
              {data.map((d, i) => {
                const colW = chartW / data.length;
                const barW = Math.min(42, colW * 0.65);
                const barH = Math.max(2, ((Number(d.value) || 0) / maxVal) * chartH);
                const x = padding.left + i * colW + (colW - barW) / 2;
                const y = padding.top + chartH - barH;
                const isHovered = hoverIndex === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="cursor-pointer"
                  >
                    <rect
                      x={x}
                      y={y}
                      width={barW}
                      height={barH}
                      rx="5"
                      fill={PALETTE[i % PALETTE.length]}
                      opacity={isHovered ? 1 : 0.9}
                      className="transition-all"
                    />

                    <text
                      x={x + barW / 2}
                      y={height - padding.bottom + 18}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="500"
                      fill="#64748b"
                    >
                      {String(d.name).length > 10 ? `${String(d.name).slice(0, 8)}..` : d.name}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoverIndex !== null && data[hoverIndex] && (
          <div className="absolute top-2 right-4 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-lg border border-slate-700 text-xs pointer-events-none transition-all">
            <span className="text-slate-400 font-medium">{data[hoverIndex].name}: </span>
            <span className="font-bold text-blue-400">{formatValue(data[hoverIndex].value, unit)}</span>
          </div>
        )}
      </div>
    </div>
  );
};
