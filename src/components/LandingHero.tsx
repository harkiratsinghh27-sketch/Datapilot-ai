'use client';

import React, { useRef, useState } from 'react';
import { 
  UploadCloud, 
  Database, 
  BarChart2, 
  FileSpreadsheet, 
  Zap, 
  TrendingUp, 
  ShieldCheck,
  Loader2,
  ArrowRight,
  MessageSquareText
} from 'lucide-react';

interface LandingHeroProps {
  onFileUpload: (file: File) => void;
  onLoadDemo: () => void;
  isLoading: boolean;
  loadingStep: string;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  onFileUpload,
  onLoadDemo,
  isLoading,
  loadingStep
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        onFileUpload(file);
      } else {
        alert('Please upload a valid .csv file.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col justify-center py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        <p className="text-[13px] font-semibold tracking-wide uppercase mb-4" style={{ color: 'var(--primary)' }}>
          Business Analytics Platform
        </p>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5" style={{ color: 'var(--foreground)' }}>
          Turn spreadsheets into
          <br />
          <span style={{ color: 'var(--primary)' }}>actionable insights</span>
        </h1>

        <p className="text-base sm:text-lg leading-relaxed max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
          Upload a CSV, ask questions in plain English. Get verified calculations, charts, and business intelligence — no code required.
        </p>
      </div>

      {/* Upload Area */}
      <div className="max-w-xl mx-auto w-full mb-10">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          className={`relative rounded-xl p-8 text-center cursor-pointer group transition-all ${
            isDragOver ? 'scale-[1.01]' : ''
          }`}
          style={{
            border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border)'}`,
            background: isDragOver ? 'var(--primary-muted)' : 'var(--card)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{loadingStep || 'Processing…'}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Computing schema and statistics</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform"
                style={{ background: 'var(--primary-muted)', color: 'var(--primary)' }}>
                <UploadCloud className="w-6 h-6" />
              </div>

              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Drop your CSV here, or <span style={{ color: 'var(--primary)' }} className="underline underline-offset-4">browse</span>
              </p>
              <p className="text-xs mt-1.5" style={{ color: 'var(--muted-light)' }}>
                CSV files up to 100 MB
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2"
                  style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  <UploadCloud className="w-4 h-4" />
                  Upload CSV
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLoadDemo();
                  }}
                  className="w-full sm:w-auto px-5 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  style={{ border: '1px solid var(--border)', color: 'var(--foreground)', background: 'var(--card)' }}
                >
                  <FileSpreadsheet className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                  Try demo dataset
                  <ArrowRight className="w-3.5 h-3.5" style={{ color: 'var(--muted)' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-6 mt-4 text-[11px] font-medium" style={{ color: 'var(--muted-light)' }}>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />
            Client-side only
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} />
            Deterministic SQL
          </span>
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
            Grounded answers
          </span>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto w-full">
        {[
          { icon: Database, title: 'Import', desc: 'Automatic schema detection, type inference, and data quality profiling.' },
          { icon: MessageSquareText, title: 'Query', desc: 'Ask in natural language — rankings, trends, comparisons, filters.' },
          { icon: TrendingUp, title: 'Insights', desc: 'Charts, metrics, and calculations verified against your data.' },
        ].map((feat) => (
          <div key={feat.title} className="p-5 rounded-lg transition-colors" 
            style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
            <feat.icon className="w-5 h-5 mb-3" style={{ color: 'var(--primary)' }} />
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--foreground)' }}>{feat.title}</h3>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--muted)' }}>{feat.desc}</p>
          </div>
        ))}
      </div>

    </div>
  );
};

