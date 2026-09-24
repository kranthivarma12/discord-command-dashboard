import React from 'react';
import { RefreshCw, Play, ShieldAlert } from 'lucide-react';
import { NavView } from './Sidebar.tsx';

interface HeaderProps {
  currentView: NavView;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenSimulator: () => void;
  failureCount: number;
}

const VIEW_TITLES: Record<NavView, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operations Overview & Telemetry',
    subtitle: 'Real-time metrics, command throughput, and mirror destination latency.',
  },
  logs: {
    title: 'Command Audit & Interaction Log',
    subtitle: 'Immutable record of every Discord interaction, parameters, user, and execution state.',
  },
  failures: {
    title: 'Dead-Letter Queue & Mirror Failures',
    subtitle: 'Diagnose downstream delivery issues, inspect HTTP errors, and manually retry notifications.',
  },
  simulator: {
    title: 'Interactive Discord Interactions Simulator',
    subtitle: 'Test Ed25519 signature verification, command execution, and mirror delivery in real-time.',
  },
  discord_config: {
    title: 'Discord Server & Mirror Configuration',
    subtitle: 'Manage Application ID, public keys, bot token, target channels, and webhook destinations.',
  },
  command_behavior: {
    title: 'Command Behavior & Formatting Policies',
    subtitle: 'Customize templates for /status responses and /report downstream webhook notifications.',
  },
  audit: {
    title: 'Security & Administrative Audit Trail',
    subtitle: 'Tamper-evident log of administrative actions, config updates, and credentials changes.',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onRefresh,
  isRefreshing,
  onOpenSimulator,
  failureCount,
}) => {
  const info = VIEW_TITLES[currentView] || { title: 'Dashboard', subtitle: '' };

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
      <div className="flex flex-col justify-center">
        <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2.5">
          {info.title}
          {failureCount > 0 && currentView === 'failures' && (
            <span className="flex items-center gap-1 text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full">
              <ShieldAlert className="w-3 h-3" />
              {failureCount} Unresolved
            </span>
          )}
        </h2>
        <p className="text-xs text-slate-400 font-normal">{info.subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {currentView !== 'simulator' && (
          <button
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-indigo-400" />
            <span>Simulate Command</span>
          </button>
        )}

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
};
