import React, { useState } from 'react';
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Radio,
  FileCode,
  ArrowRight,
  ShieldCheck,
  RotateCw,
} from 'lucide-react';
import { api } from '../api.ts';
import { NavView } from '../components/Sidebar.tsx';

interface SimulatorViewProps {
  onNavigate: (view: NavView) => void;
  onRefreshAll: () => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({ onNavigate, onRefreshAll }) => {
  const [command, setCommand] = useState<'status' | 'report'>('report');
  const [text, setText] = useState('High memory utilization detected on microservice pod worker-prod-04');
  const [username, setUsername] = useState('dev_sarah');
  const [userId, setUserId] = useState('987654321012345678');
  const [channelId, setChannelId] = useState('112233445566778899');
  const [guildId, setGuildId] = useState('998877665544332211');

  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      setError(null);
      setResult(null);

      const res = await api.simulateInteraction({
        command,
        text: command === 'report' ? text : undefined,
        username,
        userId,
        channelId,
        guildId,
      });

      setResult(res);
      onRefreshAll();
    } catch (err: any) {
      setError(err.message || 'Simulation encountered an unexpected error.');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Interactive Discord Command Simulator</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulate actual Discord slash command interactions with cryptographic Ed25519 signatures, idempotency checking, database logging, and mirror delivery.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h4 className="font-semibold text-sm text-slate-200 font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
            <Play className="w-4 h-4 text-indigo-400 fill-indigo-400" />
            Dispatch Mock Discord Interaction
          </h4>

          <form onSubmit={handleSimulate} className="space-y-4 text-xs font-mono">
            {/* Command selection */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase font-semibold">Slash Command</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCommand('report')}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    command === 'report'
                      ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm'
                      : 'bg-slate-950/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-mono text-sm">/report &lt;text&gt;</div>
                  <div className="text-[10px] opacity-80 mt-0.5">Mirrored notification</div>
                </button>

                <button
                  type="button"
                  onClick={() => setCommand('status')}
                  className={`py-2 px-3 rounded-lg border text-left transition-all ${
                    command === 'status'
                      ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-sm'
                      : 'bg-slate-950/80 text-slate-300 border-slate-700/80 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-mono text-sm">/status</div>
                  <div className="text-[10px] opacity-80 mt-0.5">System diagnostics</div>
                </button>
              </div>
            </div>

            {/* Input text for /report */}
            {command === 'report' && (
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase font-semibold">
                  Report Text Argument (<span className="text-indigo-400">required</span>)
                </label>
                <textarea
                  rows={3}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Enter problem description or incident details..."
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                  required
                />
              </div>
            )}

            {/* Simulated Discord User & Context */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 uppercase font-semibold text-[11px]">
                  Simulated Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 uppercase font-semibold text-[11px]">
                  Simulated User ID
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 uppercase font-semibold text-[11px]">
                  Discord Channel ID
                </label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 uppercase font-semibold text-[11px]">
                  Discord Server / Guild ID
                </label>
                <input
                  type="text"
                  value={guildId}
                  onChange={(e) => setGuildId(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
              >
                {simulating ? (
                  <>
                    <RotateCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Ed25519 & Executing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    <span>Send Simulated Interaction to /api/discord/interactions</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Real-time Execution Output */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-sm text-slate-200 font-mono uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-emerald-400" />
              Interaction Execution Diagnostics
            </h4>

            {error && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2.5 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {!result && !error && (
              <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
                <Radio className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p className="text-xs font-mono text-slate-400">Awaiting execution trigger</p>
                <p className="text-[11px] text-slate-400 font-sans mt-1">
                  Click the button on the left to dispatch a cryptographically valid interaction.
                </p>
              </div>
            )}

            {result && (
              <div className="space-y-3.5 text-xs font-mono">
                {/* Result Status Card */}
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold">Interaction Processed Successfully</span>
                  </div>
                  <span className="text-[11px] bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60">
                    {result.executionTimeMs}ms Latency
                  </span>
                </div>

                {/* Metrics Breakdown */}
                <div className="grid grid-cols-2 gap-2.5 bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-500 uppercase block">Interaction ID</span>
                    <span className="text-indigo-300 font-bold truncate block">{result.interactionId}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 uppercase block">Mirror Dispatched</span>
                    <span className={result.mirrorTriggered ? 'text-purple-400 font-bold' : 'text-slate-500'}>
                      {result.mirrorTriggered ? 'Yes (Async Forward)' : 'No (Diagnostics)'}
                    </span>
                  </div>
                </div>

                {/* Discord Response Preview */}
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-bold mb-1">
                    Discord Gateway Response (Type {result.response?.type})
                  </label>
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200 overflow-x-auto text-[11px] leading-relaxed max-h-60">
                    {JSON.stringify(result.response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="pt-4 border-t border-slate-800 mt-4 flex justify-end">
              <button
                onClick={() => onNavigate('logs')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
              >
                <span>View Interaction in Audit Logs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
