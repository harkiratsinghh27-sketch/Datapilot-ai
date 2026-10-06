'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

interface ChartRendererProps {
  spec: any;
}

const PALETTE = ["#2f5d50", "#c2703d", "#8a7b4f", "#7d5a7a", "#4a4a4a", "#b08968", "#6b8f71", "#a33f3f", "#5c6b73", "#9c6b3f"];

export function ChartRenderer({ spec }: ChartRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !spec || spec.type === 'none' || spec.type === 'table') return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const datasets = (spec.datasets || []).map((ds: any, i: number) => {
      const color = PALETTE[i % PALETTE.length];
      return {
        ...ds,
        backgroundColor: spec.type === 'line' ? 'transparent' : color,
        borderColor: color,
        borderWidth: 2,
        tension: 0.1
      };
    });

    if (spec.type === 'pie' || spec.type === 'doughnut') {
      if (datasets.length > 0) {
         datasets[0].backgroundColor = spec.labels.map((_: any, i: number) => PALETTE[i % PALETTE.length]);
         datasets[0].borderColor = 'var(--surface)';
      }
    }

    const config: any = {
      type: spec.type,
      data: {
        labels: spec.labels || [],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: spec.horizontal ? 'y' : 'x',
        plugins: {
          legend: {
            display: datasets.length > 1 || spec.type === 'pie' || spec.type === 'doughnut',
            position: 'top',
          },
          title: {
            display: !!spec.title,
            text: spec.title,
            font: { family: 'var(--font-sans)', size: 13, weight: 'bold' }
          }
        },
        scales: (spec.type === 'pie' || spec.type === 'doughnut') ? {} : {
           x: {
              title: { display: !!spec.x_label, text: spec.x_label }
           },
           y: {
              title: { display: !!spec.y_label, text: spec.y_label },
              beginAtZero: true
           }
        }
      }
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [spec]);

  if (!spec || spec.type === 'none' || spec.type === 'table') {
    return null;
  }

  return (
    <div style={{ height: '290px', width: '100%', position: 'relative' }} className="mt-4 border border-[var(--line)] rounded-[8px] p-4 bg-[var(--surface-2)]">
      <canvas ref={canvasRef} />
    </div>
  );
}
