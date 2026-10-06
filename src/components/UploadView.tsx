'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface UploadViewProps {
  onUploadSuccess: (data: any) => void;
}

export function UploadView({ onUploadSuccess }: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds 50MB limit.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'tsv', 'json', 'parquet', 'xlsx'].includes(ext || '')) {
      setError('Unsupported file type. Please upload CSV, TSV, JSON, Parquet, or XLSX.');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Upload failed');
      }
      onUploadSuccess(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
      <div className="w-full max-w-[560px] bg-[var(--surface)] border border-[var(--line)] rounded-[10px] shadow-sm overflow-hidden flex flex-col">
        <div className="p-8 pb-6 text-center">
          <div className="mx-auto w-10 h-10 bg-[var(--surface-3)] border border-[var(--line-2)] rounded-[8px] flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-5 h-5 text-[var(--accent)]" />
          </div>
          <p className="text-[12px] font-semibold text-[var(--muted)] tracking-wider uppercase mb-2">Data Desk</p>
          <h1 className="text-[24px] font-bold tracking-tight mb-2">Analyse a CSV file</h1>
          <p className="text-[var(--muted)] text-[15px]">CSV analysis</p>
        </div>

        <div className="px-8 pb-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            className={`border-2 border-dashed rounded-[10px] p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line-2)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]'}`}
          >
            <input
              type="file"
              className="hidden"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                // clear input so same file can be selected again
                e.target.value = '';
              }}
              accept=".csv,.tsv,.json,.parquet,.xlsx"
            />
            {isUploading ? (
              <div className="flex flex-col items-center">
                <div className="w-6 h-6 border-2 border-[var(--line-2)] border-t-[var(--accent)] rounded-full animate-spin mb-3"></div>
                <p className="font-medium text-[15px]">Processing file...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadCloud className="w-8 h-8 text-[var(--muted)] mb-3" />
                <h3 className="font-semibold text-[16px] mb-1">Drop your file here</h3>
                <p className="text-[13px] text-[var(--muted)] mb-4">CSV, TSV, XLSX, JSON or Parquet &middot; up to 50 MB</p>
                <button className="bg-[var(--accent)] text-[var(--surface)] px-4 py-2 rounded-[6px] font-medium text-[14px] hover:bg-[var(--accent-2)] transition-colors">
                  Choose file
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-[6px] bg-[var(--danger-soft)] border border-[var(--danger)] text-[var(--danger)] flex items-start text-[14px]">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-6 bg-[var(--surface-2)] border-t border-[var(--line)] text-center">
          <p className="text-[13px] text-[var(--muted)] mb-4">
            Files are processed by your server.
          </p>
          <button 
            className="text-[13px] font-medium text-[var(--accent)] hover:text-[var(--accent-2)] underline underline-offset-4"
            onClick={async () => {
               // Load demo file logic (mock)
               setError("Demo file feature is coming soon.");
            }}
          >
            Preview with sample data
          </button>
        </div>
      </div>
      
      <div className="fixed bottom-8 text-center w-full max-w-[560px] flex flex-col gap-2 text-[13px] text-[var(--muted)]">
         <div className="flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span> Plain-English questions</div>
         <div className="flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span> Automatic charts/metrics</div>
         <div className="flex items-center justify-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></span> Read-only data</div>
      </div>
    </div>
  );
}
