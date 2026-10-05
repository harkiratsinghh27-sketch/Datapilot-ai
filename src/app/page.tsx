'use client';

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Navbar } from '@/components/Navbar';
import { LandingHero } from '@/components/LandingHero';
import { OverviewDashboard } from '@/components/OverviewDashboard';
import { ChatInterface } from '@/components/ChatInterface';
import { DataExplorer } from '@/components/DataExplorer';
import { DatasetProfileView } from '@/components/DatasetProfileView';
import { SettingsModal } from '@/components/SettingsModal';
import { DatasetProfile } from '@/types/dataset';
import { profileDataset } from '@/lib/profiler';

export default function Home() {
  const [dataset, setDataset] = useState<Record<string, any>[] | null>(null);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'explorer' | 'profile'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-flash-lite-latest');
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>(undefined);

  // Load saved settings from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('datapilot_gemini_key');
    const savedModel = localStorage.getItem('datapilot_gemini_model');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setModel(savedModel);
  }, []);

  // Process raw parsed rows into dataset & profile
  const ingestRows = (rows: Record<string, any>[], fileName: string, fileSize: number) => {
    setLoadingStep('Profiling dataset & computing statistics...');
    const prof = profileDataset(fileName, fileSize, rows);
    setDataset(rows);
    setProfile(prof);
    setActiveTab('overview');
    setIsLoading(false);
    setLoadingStep('');
  };

  // Upload custom CSV
  const handleFileUpload = (file: File) => {
    setIsLoading(true);
    setLoadingStep('Reading and validating CSV file...');

    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        if (!results.data || results.data.length === 0) {
          alert('The uploaded CSV appears to be empty or malformed.');
          setIsLoading(false);
          return;
        }
        ingestRows(results.data as Record<string, any>[], file.name, file.size);
      },
      error: (error: any) => {
        alert(`Failed to parse CSV: ${error.message}`);
        setIsLoading(false);
      }
    });
  };

  // Load Built-in Demo Dataset (2,500 rows)
  const handleLoadDemo = async () => {
    setIsLoading(true);
    setLoadingStep('Fetching built-in 2,500-row demo sales dataset...');

    try {
      const response = await fetch('/sample-sales.csv');
      const csvText = await response.text();
      setLoadingStep('Parsing dataset with PapaParse...');

      Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          ingestRows(results.data as Record<string, any>[], 'sample-sales.csv', csvText.length);
        },
        error: (err: any) => {
          alert(`Error reading demo data: ${err.message}`);
          setIsLoading(false);
        }
      });
    } catch (err: any) {
      alert(`Could not load demo dataset: ${err.message}`);
      setIsLoading(false);
    }
  };

  // Switch to chat and prompt question from dashboard
  const handleAskQuestionFromDashboard = (q: string) => {
    setChatInitialQuestion(q);
    setActiveTab('chat');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        onNewDataset={() => {
          setDataset(null);
          setProfile(null);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Content Area */}
      <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${activeTab === 'chat' && profile && dataset ? 'py-2 h-[calc(100vh-4.5rem)] overflow-hidden' : 'py-6'}`}>
        {!profile || !dataset ? (
          <LandingHero
            onFileUpload={handleFileUpload}
            onLoadDemo={handleLoadDemo}
            isLoading={isLoading}
            loadingStep={loadingStep}
          />
        ) : (
          <div className={activeTab === 'chat' ? 'h-full' : ''}>
            {activeTab === 'overview' && (
              <OverviewDashboard
                profile={profile}
                dataset={dataset}
                onAskQuestion={handleAskQuestionFromDashboard}
              />
            )}

            {activeTab === 'chat' && (
              <ChatInterface
                profile={profile}
                dataset={dataset}
                apiKey={apiKey}
                initialQuestion={chatInitialQuestion}
              />
            )}

            {activeTab === 'explorer' && (
              <DataExplorer profile={profile} dataset={dataset} />
            )}

            {activeTab === 'profile' && (
              <DatasetProfileView profile={profile} />
            )}
          </div>
        )}
      </main>

      {/* Footer - only on non-chat views */}
      {(!profile || activeTab !== 'chat') && (
        <footer className="w-full py-5 text-center text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--muted-light)' }}>
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 DataPilot — Business Analytics Platform</p>
            <div className="flex items-center gap-3">
              <span>Deterministic Engine</span>
              <span>·</span>
              <span>Verified Calculations</span>
              <span>·</span>
              <span>Client-Side Processing</span>
            </div>
          </div>
        </footer>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiKey={apiKey}
        setApiKey={setApiKey}
        model={model}
        setModel={setModel}
      />

    </div>
  );
}
