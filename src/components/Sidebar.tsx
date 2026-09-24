import React from 'react';
import {
  LayoutDashboard,
  ScrollText,
  AlertTriangle,
  Settings,
  Terminal,
  Sliders,
  ShieldCheck,
  LogOut,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { User } from '../types.ts';

export type NavView =
  | 'overview'
  | 'logs'
  | 'failures'
  | 'discord_config'
  | 'command_behavior'
  | 'simulator'
  | 'audit';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  user: User | null;
  onLogout: () => void;
  failureCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  user,
  onLogout,
  failureCount,
}) => {
  const navItems = [
    { id: 'overview' as NavView, label: 'Overview & Metrics', icon: LayoutDashboard },
    { id: 'logs' as NavView, label: 'Command Audit Log', icon: ScrollText },
    {
      id: 'failures' as NavView,
      label: 'Failures & Dead-Letter',
      icon: AlertTriangle,
      badge: failureCount > 0 ? failureCount : undefined,
    },
    { id: 'simulator' as NavView, label: 'Command Simulator', icon: Terminal, highlight: true },
    { id: 'discord_config' as NavView, label: 'Discord & Mirror Settings', icon: Settings },
    { id: 'command_behavior' as NavView, label: 'Command Behavior (/status & /report)', icon: Sliders },
    { id: 'audit' as NavView, label: 'Admin Security Trail', icon: ShieldCheck },
  ];

  return (
    <aside className="w-68 bg-slate-900 border-r border-slate-800 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <Radio className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-slate-100 text-sm tracking-tight">Discord InterOps</h1>
            <span className="text-[10px] font-mono uppercase bg-indigo-950 text-indigo-400 border border-indigo-800/60 px-1.5 py-0.5 rounded font-bold">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono">Gateway & Mirror Admin</p>
        </div>
      </div>

      {/* Connection Status Pill */}
      <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Interactions Endpoint</span>
        </div>
        <span className="text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded text-[11px]">POST /api</span>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-mono tracking-wider text-slate-400 uppercase px-3 mb-2 font-semibold">
          Console Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              } ${item.highlight && !isActive ? 'border border-indigo-500/30 bg-indigo-950/30 text-indigo-300' : ''}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                  isActive ? 'bg-rose-500 text-white' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Discord Quick Bot Reference */}
      <div className="p-3 mx-3 mb-3 rounded-lg bg-slate-950/70 border border-slate-800/80 text-xs">
        <div className="flex items-center justify-between text-slate-400 font-mono text-[11px] mb-1.5">
          <span>Active Slash Commands</span>
          <span className="text-emerald-400 font-bold">2/2 Registered</span>
        </div>
        <div className="space-y-1 font-mono text-[11px] text-slate-300">
          <div className="bg-slate-900 px-2 py-1 rounded border border-slate-800/60 flex items-center justify-between">
            <span className="text-indigo-300 font-semibold">/status</span>
            <span className="text-slate-400 text-[10px]">Diagnostics</span>
          </div>
          <div className="bg-slate-900 px-2 py-1 rounded border border-slate-800/60 flex items-center justify-between">
            <span className="text-indigo-300 font-semibold">/report &lt;text&gt;</span>
            <span className="text-emerald-400 text-[10px]">Mirrored</span>
          </div>
        </div>
      </div>

      {/* User Session Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-xs text-white uppercase tracking-wider">
            {user?.username?.[0] || 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.username || 'Administrator'}</p>
            <p className="text-[11px] text-slate-400 font-mono truncate uppercase">{user?.role || 'Admin'}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          title="Sign out of Admin Console"
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
