import React, { useState } from 'react';
import {
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  ShieldCheck,
  Send,
  HelpCircle,
} from 'lucide-react';
import { MirrorAttempt } from '../types.ts';
import { api } from '../api.ts';

interface FailuresViewProps {
  failures: MirrorAttempt[];
  onRefresh: () => void;
}

export const FailuresView: React.FC<FailuresViewProps> = ({ failures, onRefresh }) => {
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryResult, setRetryResult] = useState<{ id: number; message: string; success: boolean } | null>(null);

  const handleRetry = async (attempt: MirrorAttempt) => {
    try {
      setRetryingId(attempt.id);
      setRetryResult(null);
      const res = await api.retryMirrorAttempt(attempt.id);
      setRetryResult({
        id: attempt.id,
        message: res.message,
        success: res.success,
      });
      onRefresh();
    } catch (err: any) {
      setRetryResult({
        id: attempt.id,
        message: err.message || 'Retry attempt failed.',
        success: false,
      });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${failures.length > 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {failures.length === 0 ? 'Dead-Letter Queue is Clear' : `${failures.length} Mirror Notification Delivery Failures`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Downstream webhook delivery uses bounded exponential backoff. Failed attempts are persisted rather than silently dropped.
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 self-start md:self-auto transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Retry Result Alert */}
      {retryResult && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
            retryResult.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {retryResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
            <span>Attempt #{retryResult.id}: {retryResult.message}</span>
          </div>
          <button
            onClick={() => setRetryResult(null)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Failures Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-slate-200 font-mono uppercase tracking-wider">
              Mirror Attempts & Dead-Letter Records
            </span>
            <span className="text-[11px] font-mono text-slate-400">({failures.length} total)</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Interaction ID</th>
                <th className="py-3 px-4 font-semibold">Destination</th>
                <th className="py-3 px-4 font-semibold">Attempt</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">HTTP Code / Error</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                    <p className="text-xs font-medium text-slate-300 font-sans">No failed mirror deliveries recorded</p>
                    <p className="text-[11px] text-slate-400 font-sans mt-1">
                      All /report interactions have either mirrored successfully or mirror notifications are functioning normally.
                    </p>
                  </td>
                </tr>
              ) : (
                failures.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-bold text-indigo-300">
                      <span className="truncate block max-w-[120px]">{item.interactionId}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {item.destinationType}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-200">Attempt {item.attemptNumber}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          item.status === 'delivered'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : item.status === 'exhausted'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : item.status === 'retrying'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div>
                        {item.httpStatusCode && (
                          <span className="text-rose-400 font-bold mr-1.5">[HTTP {item.httpStatusCode}]</span>
                        )}
                        <span className="text-slate-300 truncate">{item.errorMessage || 'Unknown error'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRetry(item)}
                        disabled={retryingId === item.id || item.status === 'delivered'}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition-colors disabled:opacity-40 inline-flex items-center gap-1 shadow-sm"
                      >
                        <RotateCw className={`w-3 h-3 ${retryingId === item.id ? 'animate-spin' : ''}`} />
                        <span>{retryingId === item.id ? 'Retrying...' : 'Retry Now'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architectural Reliability Explainer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h4 className="font-semibold text-xs text-slate-300 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          Reliability & Failure Recovery Architecture
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-400 font-mono">
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <h5 className="font-bold text-slate-200 mb-1">Non-Blocking Queue</h5>
            <p className="text-[11px] leading-relaxed">
              Mirror notifications are dispatched asynchronously after the primary Discord interaction is acknowledged, safeguarding the 3-second SLA.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <h5 className="font-bold text-slate-200 mb-1">Bounded Exponential Retries</h5>
            <p className="text-[11px] leading-relaxed">
              Configured retry attempts (default: 3) execute with exponential jitter (1s, 2s, 4s). Webhook destination failures do not corrupt interaction state.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
            <h5 className="font-bold text-slate-200 mb-1">Manual Operator Recovery</h5>
            <p className="text-[11px] leading-relaxed">
              Administrators can manually trigger an immediate re-delivery of any failed message directly from this dashboard once upstream webhook outages resolve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
