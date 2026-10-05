'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  Bot, 
  ChevronRight,
  Loader2
} from 'lucide-react';
import { DatasetProfile, ChatMessage, ConversationContext } from '@/types/dataset';
import { ResultCard } from './ResultCard';

interface ChatInterfaceProps {
  profile: DatasetProfile;
  dataset: Record<string, any>[];
  apiKey: string;
  initialQuestion?: string;
}

const SUGGESTED_QUESTIONS = [
  'What is our total revenue?',
  'What were the top 5 products by sales?',
  'What were the worst-performing products?',
  'Show monthly sales trend.',
  'Find unusual drops in sales.',
  'Which store location generated the most profit?',
  'How did Berlin Flagship perform?',
  'Which products sold the most units?',
  'What is the average transaction value?',
  'Compare sales across store locations.',
  'Show top customer segments.',
  'Which month had the highest sales?',
  'Orders above $5,000'
];

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  profile,
  dataset,
  apiKey,
  initialQuestion
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<ConversationContext>({});
  
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [loadingStateIdx, setLoadingStateIdx] = useState(0);

  const loadingStates = [
    "Understanding your question...",
    "Checking dataset columns...",
    "Selecting analysis tools...",
    "Calculating results...",
    "Preparing insights...",
    "Formulating final response..."
  ];

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      setLoadingStateIdx(0);
      interval = setInterval(() => {
        setLoadingStateIdx((prev) => (prev < loadingStates.length - 1 ? prev + 1 : prev));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Smooth scroll strictly within the chat messages container (NEVER jump outer window)
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, isLoading, loadingStateIdx]);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: `Hello! I have indexed **${profile.fileName}** (${profile.rowCount.toLocaleString()} transactions across ${profile.columnCount} business dimensions). Ask any question in plain English to get deterministic calculations, interactive charts, and problem-solving takeaways.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [profile]);

  // If triggered with an initial question from another view
  useEffect(() => {
    if (initialQuestion && messages.length <= 1) {
      handleAskQuestion(initialQuestion);
    }
  }, [initialQuestion]);

  const handleAskQuestion = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed || isLoading) return;

    const userMessageId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuestion('');
    setIsLoading(true);

    try {
      // Execute through the server-side API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          profile,
          dataset,
          context,
          customApiKey: apiKey
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze data.');
      }

      const analysis = await response.json();

      // Update conversational context for follow-up questions
      const newContext: ConversationContext = {
        lastIntent: analysis.calculationPlan || analysis.requestType,
        lastQuery: analysis.query,
        lastDimensions: profile.keyDimensions,
        lastMeasures: profile.keyMeasures,
        historySummary: `${context.historySummary || ''} User: ${trimmed}. AI answered with ${analysis.requestType}.`.substring(0, 1000)
      };
      setContext(newContext);

      const aiMessageId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: 'assistant',
        content: analysis.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        analysis
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessageId = `err-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const errorMessage: ChatMessage = {
        id: errorMessageId,
        role: 'assistant',
        content: `I encountered an issue processing that query: ${err.message || 'Unknown error'}. Please try rephrasing or check column filters.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAskQuestion(inputQuestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAskQuestion(inputQuestion);
    }
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 h-[calc(100vh-8.5rem)] overflow-hidden">
      
      {/* Left Sidebar: Dataset context & Suggested questions */}
      <div className="w-full lg:w-80 shrink-0 flex flex-col space-y-4 overflow-y-auto pr-1">
        
        {/* Active Dataset Pill */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Dataset</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              Live
            </span>
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
              {profile.fileName}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {profile.rowCount.toLocaleString()} rows • {profile.columnCount} columns
            </p>
          </div>
        </div>

        {/* Suggested Prompts (Hidden on mobile to save space) */}
        <div className="hidden lg:flex flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3 flex-col overflow-hidden">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-200 shrink-0">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Suggested Questions</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleAskQuestion(q)}
                disabled={isLoading}
                className="w-full text-left text-xs p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 transition-all flex items-start justify-between group"
              >
                <span className="leading-snug">{q}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0 mt-0.5 ml-1" />
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Main Conversation Stream */}
      <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden h-full">
        
        {/* Messages Container (Scrollable) */}
        <div 
          ref={messagesContainerRef}
          className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6"
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-3xl ${msg.role === 'user' ? 'w-auto' : 'w-full'}`}>
                {msg.role === 'user' ? (
                  <div className="px-4 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-medium shadow-sm">
                    {msg.content}
                  </div>
                ) : (
                  <div>
                    {msg.analysis ? (
                      <ResultCard analysis={msg.analysis} onAskQuestion={handleAskQuestion} />
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                        {msg.content}
                      </div>
                    )}
                  </div>
                )}
                <span className={`text-[10px] text-slate-400 mt-1 block ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {msg.timestamp}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-1">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-300 flex items-center space-x-3">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="animate-pulse">{loadingStates[loadingStateIdx]}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Bar Form */}
        <form onSubmit={handleFormSubmit} className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 shrink-0">
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything (e.g. 'top 5 performing products', 'monthly sales trend', 'compare store locations')..."
              className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none resize-none max-h-32"
            />
            <button
              type="submit"
              disabled={!inputQuestion.trim() || isLoading}
              className={`p-2.5 rounded-xl transition-all ${
                inputQuestion.trim() && !isLoading
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Enter to send • Shift+Enter for new line • Grounded calculations from {profile.fileName}
          </p>
        </form>

      </div>

    </div>
  );
};
