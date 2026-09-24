import React from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Copy,
  Send,
  AlertTriangle,
  Clock,
  ExternalLink,
  Play,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Zap,
} from 'lucide-react';
import { OverviewMetrics, InteractionLog, MirrorAttempt } from '../types.ts';
import { NavView } from '../components/Sidebar.tsx';

interface OverviewViewProps {
  metrics: OverviewMetrics | null;
  recentLogs: InteractionLog[];
  recentFailures: MirrorAttempt[];
  onNavigate: (view: NavView) => void;
  onSelectInteraction: (log: InteractionLog) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  metrics,
  recentLogs,
  recentFailures,
  onNavigate,
  onSelectInteraction,
}) => {
  const successRate = metrics?.totalCommands
    ? Math.round((metrics.completedCommands / metrics.totalCommands) * 100)
    : 100;

  const mirrorSuccessRate = metrics?.mirrorAttemptsCount
    ? Math.round(
        ((metrics.mirrorAttemptsCount - metrics.failedMirrorAttempts) /
          metrics.mirrorAttemptsCount) *
          100
      )
    : 100;

  return (
    <div className="space-y-6">
      {/* Alert banner if failures exist */}
      {recentFailures.length > 0 && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-rose-200">
                {recentFailures.length} Downstream Notification Failures Detected
              </h4>
              <p className="text-xs text-rose-300/80">
                Mirror destinations returned error codes or were unreachable. Dead-letter queue is actively tracking retries.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('failures')}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>Inspect Dead-Letter Queue</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Commands */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Total Commands</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {metrics?.totalCommands ?? 0}
            </span>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {successRate}% Success
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Verified via Ed25519 interactions</p>
        </div>

        {/* Completed Commands */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Completed</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {metrics?.completedCommands ?? 0}
            </span>
            <span className="text-xs font-mono text-slate-400">ACK &lt;3000ms</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Slash command ACKs executed</p>
        </div>

        {/* Deduplicated / Idempotent */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Idempotency Saves</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Copy className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {metrics?.duplicateInteractions ?? 0}
            </span>
            <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              Deduplicated
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Prevented duplicate Discord dispatches</p>
        </div>

        {/* Mirror Delivery Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono font-medium uppercase tracking-wider">Mirror Rate</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {metrics?.mirrorAttemptsCount ?? 0}
            </span>
            <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
              metrics?.failedMirrorAttempts
                ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            }`}>
              {metrics?.failedMirrorAttempts ?? 0} Failures
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Forwarded to secondary channels</p>
        </div>
      </div>

      {/* Two Column Layout: Command Stream & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Interactions Activity Stream */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-slate-200">Live Interactions Stream</h3>
              <span className="text-[11px] font-mono text-slate-400">Latest 10 commands</span>
            </div>
            <button
              onClick={() => onNavigate('logs')}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>View Full Log</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentLogs.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-lg">
              <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs font-mono text-slate-400">No interaction events recorded yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Execute a command in Discord or use the Command Simulator to trigger interactions.
              </p>
              <button
                onClick={() => onNavigate('simulator')}
                className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Launch Command Simulator</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentLogs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => onSelectInteraction(log)}
                  className="py-3 flex items-center justify-between hover:bg-slate-800/40 px-2 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-mono text-xs font-bold text-indigo-300 border border-slate-700/60 shrink-0">
                      /{log.commandName || 'cmd'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-slate-200 truncate">
                          {log.username || log.userId || 'Discord User'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          id: {log.interactionId.slice(0, 12)}...
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-md">
                        {log.rawInput ? `"${log.rawInput}"` : 'Diagnostics /status requested'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded-full border ${
                        log.processingStatus === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : log.processingStatus === 'duplicate'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                          : log.processingStatus === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {log.processingStatus}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Architecture Status & Quick Controls */}
        <div className="space-y-4">
          {/* Architecture Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Gateway Infrastructure
            </h3>
            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Ed25519 Signatures</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enforced
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Response Window</span>
                <span className="text-emerald-400 font-bold">&lt; 3.00s Bound</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Idempotency Key</span>
                <span className="text-indigo-400 font-bold">interaction_id</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                <span className="text-slate-400">Mirror Backoff</span>
                <span className="text-purple-400 font-bold">Exponential</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Administrative Actions
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('simulator')}
                className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center justify-between transition-colors shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Test Slash Command Execution</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate('discord_config')}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between transition-colors border border-slate-700/80"
              >
                <span>Discord & Webhook Configuration</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate('command_behavior')}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-between transition-colors border border-slate-700/80"
              >
                <span>Customize /report Formatting</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
