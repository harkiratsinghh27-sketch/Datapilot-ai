'use client';

import React from 'react';
import { 
  BarChart3, 
  MessageSquareText, 
  Table, 
  Layers, 
  Upload, 
  Settings, 
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';
import { DatasetProfile } from '@/types/dataset';

interface NavbarProps {
  activeTab: 'overview' | 'chat' | 'explorer' | 'profile';
  setActiveTab: (tab: 'overview' | 'chat' | 'explorer' | 'profile') => void;
  profile: DatasetProfile | null;
  onNewDataset: () => void;
  onOpenSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  profile,
  onNewDataset,
  onOpenSettings
}) => {
  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Layers },
    { id: 'chat' as const, label: 'Analyst', icon: MessageSquareText },
    { id: 'explorer' as const, label: 'Explorer', icon: Table },
    { id: 'profile' as const, label: 'Profile', icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-white/90 dark:bg-stone-950/90 backdrop-blur-lg"
      style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        
        {/* Brand */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none" 
          onClick={() => profile ? setActiveTab('overview') : onNewDataset()}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--primary)' }}>
            <BarChart3 className="w-4 h-4" style={{ color: 'var(--primary-foreground)' }} />
          </div>
          <span className="hidden sm:inline text-[15px] font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
            DataPilot
          </span>
        </div>

        {/* Tab Navigation */}
        {profile && (
          <nav className="flex items-center gap-0.5 rounded-lg p-0.5" 
            style={{ background: 'var(--accent)' }}>
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-white dark:bg-stone-900 shadow-sm'
                      : 'hover:bg-white/60 dark:hover:bg-stone-800/60'
                  }`}
                  style={{ color: isActive ? 'var(--primary)' : 'var(--muted)' }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {profile && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--muted)' }}>
              <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--success)' }} />
              <span className="max-w-[120px] truncate">{profile.fileName}</span>
              <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {profile.rowCount.toLocaleString()}
              </span>
              <span>rows</span>
            </div>
          )}

          <button
            onClick={onNewDataset}
            className="flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-md transition-colors"
            style={{ background: 'var(--accent)', color: 'var(--foreground)' }}
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

      </div>
    </header>
  );
};
