'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Check, Shield, Cpu, ExternalLink } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  setModel: (m: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  setApiKey,
  model,
  setModel
}) => {
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempModel, setTempModel] = useState(model);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setTempKey(apiKey);
    setTempModel(model);
  }, [apiKey, model, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(tempKey);
    setModel(tempModel);
    localStorage.setItem('datapilot_gemini_key', tempKey);
    localStorage.setItem('datapilot_gemini_model', tempModel);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-5">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-1 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">AI Engine Settings</h3>
            <p className="text-xs text-slate-500">Configure Gemini API and model orchestrator</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Google Gemini API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Leave blank to use built-in deterministic planner</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 dark:text-blue-400 underline inline-flex items-center space-x-0.5"
              >
                <span>Get API key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Model Selection
            </label>
            <select
              value={tempModel}
              onChange={(e) => setTempModel(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="gemini-flash-lite-latest">Gemini Flash-Lite Latest (Free Tier Default)</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            </select>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-start space-x-2 text-xs text-slate-600 dark:text-slate-400">
          <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Your API key is never shared or stored on external servers. Raw business data is never transmitted to the LLM—only schema metadata.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
          >
            {saved ? <Check className="w-4 h-4 text-white" /> : null}
            <span>{saved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
