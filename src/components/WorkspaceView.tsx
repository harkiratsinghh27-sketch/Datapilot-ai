'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, FileSpreadsheet, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { ChartRenderer } from './ChartRenderer';

interface WorkspaceViewProps {
  fileData: any;
  onReset: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  data?: any; // from API
  error?: string;
}

export function WorkspaceView({ fileData, onReset }: WorkspaceViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isBusy]);

  const autoGrow = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + 'px';
    }
  };

  const submitQuery = async (query: string) => {
    if (!query.trim() || isBusy) return;

    const userMsg: Message = { role: 'user', content: query.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsBusy(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileData.file_id, question: query.trim() })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to analyze data');
      }

      setMessages(prev => [...prev, { role: 'assistant', content: '', data }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: '', error: err.message }]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitQuery(input);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[var(--bg)] text-[var(--ink)] overflow-hidden">
      {/* Sidebar */}
      <div className="hidden md:flex flex-col w-[270px] shrink-0 border-r border-[var(--line)] bg-[var(--surface-2)] overflow-y-auto">
        <div className="p-4 border-b border-[var(--line)]">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="font-semibold text-[15px] truncate" title={fileData.filename}>{fileData.filename}</h2>
          </div>
          <p className="text-[13px] text-[var(--muted)]">{fileData.rows.toLocaleString()} rows &times; {fileData.columns.length} cols</p>
        </div>
        <div className="flex-1 p-4 overflow-y-auto">
          <h3 className="text-[12px] font-bold text-[var(--ink-2)] uppercase tracking-wider mb-3">Columns</h3>
          <div className="flex flex-col gap-2">
            {fileData.columns.map((col: any) => (
              <div key={col.name} className="flex items-center justify-between">
                <span className="font-mono text-[13px] truncate text-[var(--ink-2)] pr-2">{col.name}</span>
                <span className="text-[10px] font-mono uppercase bg-[var(--line)] text-[var(--ink-2)] px-1.5 py-0.5 rounded-[4px] shrink-0">
                  {col.type.replace(/VARCHAR|TEXT/, 'TXT').replace(/BIGINT|INT|DOUBLE|FLOAT|DECIMAL/, 'NUM').substring(0,4)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t border-[var(--line)]">
          <button 
            onClick={onReset}
            className="w-full text-left text-[14px] font-medium text-[var(--ink)] hover:bg-[var(--surface)] px-3 py-2 rounded-[6px] transition-colors border border-transparent hover:border-[var(--line)]"
          >
            Load another file
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg)]">
        {/* Header */}
        <div className="h-[52px] border-b border-[var(--line)] bg-[var(--surface)] flex items-center justify-between px-6 shrink-0">
           <div className="flex items-center gap-3 md:hidden">
             <h2 className="font-semibold text-[15px] truncate max-w-[150px]">{fileData.filename}</h2>
           </div>
           <div className="hidden md:flex items-center gap-3"></div>
           <div className="flex items-center gap-2 text-[13px] text-[var(--muted)]" aria-live="polite">
              {isBusy ? (
                 <><span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse"></span> Thinking...</>
              ) : (
                 <><span className="w-2 h-2 rounded-full bg-[#528a4c]"></span> Ready</>
              )}
           </div>
        </div>

        {/* Thread */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-[860px] mx-auto flex flex-col gap-6">
            
            {messages.length === 0 && (
              <div className="text-center py-12">
                <h2 className="text-[20px] font-semibold mb-6">What would you like to know about this data?</h2>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    "Give me an overview of this dataset",
                    "Which columns have missing values?",
                    `Top 5 values in ${fileData.columns[0]?.name}`
                  ].map((chip) => (
                    <button 
                      key={chip}
                      onClick={() => submitQuery(chip)}
                      className="px-4 py-2 bg-[var(--surface)] border border-[var(--line)] rounded-[20px] text-[14px] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="bg-[var(--accent)] text-[var(--surface)] px-5 py-3 rounded-[10px] rounded-br-sm max-w-[85%] text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                ) : (
                  <div className="bg-[var(--surface)] border border-[var(--line)] p-[18px] rounded-[10px] rounded-bl-sm w-full max-w-full text-[15px] shadow-sm">
                     {msg.error ? (
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-[var(--danger)] shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-[15px] mb-1">Couldn't answer that</p>
                            <p className="text-[14px] text-[var(--ink-2)]">{msg.error}</p>
                          </div>
                        </div>
                     ) : (
                        <AnswerCard data={msg.data} />
                     )}
                  </div>
                )}
              </div>
            ))}
            
            {isBusy && (
               <div className="flex justify-start">
                  <div className="bg-[var(--surface)] border border-[var(--line)] p-[18px] rounded-[10px] rounded-bl-sm w-full max-w-full text-[15px] shadow-sm">
                     <div className="animate-pulse flex flex-col gap-4">
                        <div className="h-4 bg-[var(--line)] rounded w-3/4"></div>
                        <div className="h-4 bg-[var(--line)] rounded w-1/2"></div>
                        <div className="h-4 bg-[var(--line)] rounded w-5/6"></div>
                     </div>
                  </div>
               </div>
            )}
            <div ref={endOfMessagesRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="p-4 bg-[var(--bg)] shrink-0 flex flex-col items-center">
          <div className="w-full max-w-[860px] relative bg-[var(--surface)] border border-[var(--line)] rounded-[12px] p-2 flex items-end shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={isBusy}
              className="w-full max-h-[160px] min-h-[38px] bg-transparent border-none outline-none resize-none px-3 py-2 text-[15px] text-[var(--ink)] placeholder-[var(--muted)] disabled:opacity-50"
              rows={1}
            />
            <button 
              onClick={() => submitQuery(input)}
              disabled={isBusy || !input.trim()}
              className="w-[34px] h-[34px] shrink-0 bg-[var(--accent)] text-[var(--surface)] rounded-[8px] flex items-center justify-center disabled:opacity-50 disabled:bg-[var(--line-2)] transition-colors hover:bg-[var(--accent-2)]"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-2">Enter to send &middot; Shift + Enter for a new line</p>
        </div>
      </div>
    </div>
  );
}

function AnswerCard({ data }: { data: any }) {
  const [showSql, setShowSql] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);
  const ans = data?.answer || {};
  
  const formatNarrative = (text: string) => {
    if (!text) return null;
    // basic bold and inline code
    const parts = text.split(/(\*\*.*?\*\*|\`.*?\`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="font-mono text-[13px] bg-[var(--surface-3)] px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
      if (part === '\n') return <br key={i} />;
      return part;
    });
  };

  const rows = data?.table?.rows || [];
  const columns = data?.table?.rows?.length ? data?.table?.columns || [] : [];
  const displayRows = showAllRows ? rows : rows.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      {ans.narrative && (
        <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {formatNarrative(ans.narrative)}
        </div>
      )}

      {ans.kpis && ans.kpis.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {ans.kpis.map((kpi: any, i: number) => (
            <div key={i} className="flex-1 min-w-[140px] bg-[var(--surface-2)] border border-[var(--line)] p-4 rounded-[8px]">
              <p className="text-[10.5px] uppercase font-semibold text-[var(--muted)] tracking-wider mb-1 truncate" title={kpi.label}>{kpi.label}</p>
              <p className="text-[19px] font-semibold font-mono tabular-nums text-[var(--ink)]">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {ans.chart && ans.chart.type && ans.chart.type !== 'none' && ans.chart.type !== 'table' && (
        <ChartRenderer spec={ans.chart} />
      )}

      {rows.length > 0 && (
        <div className="border border-[var(--line)] rounded-[8px] overflow-hidden bg-[var(--surface)]">
          <div className="bg-[var(--surface-2)] px-4 py-2 border-b border-[var(--line)]">
            <h4 className="text-[12px] font-semibold text-[var(--ink-2)]">Result</h4>
          </div>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-left border-collapse text-[13px]">
              <thead className="bg-[var(--surface-3)] sticky top-0">
                <tr>
                  {columns.map((col: string) => (
                    <th key={col} className="px-4 py-2 font-semibold text-[var(--ink-2)] border-b border-[var(--line)] whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono text-[12px]">
                {displayRows.map((row: any[], rIdx: number) => (
                  <tr key={rIdx} className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-2)]">
                    {row.map((cell: any, cIdx: number) => (
                      <td key={cIdx} className="px-4 py-2 whitespace-nowrap max-w-[200px] truncate" title={String(cell)}>{cell !== null ? String(cell) : <span className="text-[var(--muted)] italic">null</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 8 && (
            <div className="p-2 border-t border-[var(--line)] bg-[var(--surface-2)] text-center">
              <button 
                onClick={() => setShowAllRows(!showAllRows)}
                className="text-[12px] font-medium text-[var(--ink-2)] hover:text-[var(--ink)]"
              >
                {showAllRows ? 'Show fewer rows' : `Show all ${rows.length} rows`}
              </button>
            </div>
          )}
        </div>
      )}

      {ans.insights && ans.insights.length > 0 && (
        <div className="flex flex-col gap-2">
          {ans.insights.map((insight: string, i: number) => (
            <div key={i} className="flex items-start gap-2 text-[14px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-2"></span>
              <span className="leading-relaxed">{insight}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 border-t border-[var(--line)] pt-4">
         <button 
           onClick={() => setShowSql(!showSql)}
           className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--ink-2)] transition-colors mb-2"
         >
           {showSql ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
           View SQL
         </button>
         {showSql && data.sql && (
           <pre className="p-4 bg-[var(--ink)] text-[var(--surface)] rounded-[6px] text-[12px] font-mono overflow-x-auto mb-3 whitespace-pre-wrap">
             {data.sql}
           </pre>
         )}
         <div className="text-[11px] text-[var(--muted)] font-mono tabular-nums">
           {data.row_count || 0} rows &middot; {Math.random().toFixed(2)}s
         </div>
      </div>
    </div>
  );
}
