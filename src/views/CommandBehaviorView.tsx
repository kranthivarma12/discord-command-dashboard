import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertCircle,
  Save,
  MessageSquare,
  Terminal,
  Send,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { CommandConfig } from '../types.ts';
import { api } from '../api.ts';

interface CommandBehaviorViewProps {
  configs: CommandConfig[];
  onRefresh: () => void;
}

export const CommandBehaviorView: React.FC<CommandBehaviorViewProps> = ({ configs, onRefresh }) => {
  const [statusConfig, setStatusConfig] = useState<Partial<CommandConfig>>({
    enabled: true,
    statusMessageTemplate: '🛰️ **Discord InterOps Gateway** | System operational and healthy.',
    includeSystemMetrics: true,
  });

  const [reportConfig, setReportConfig] = useState<Partial<CommandConfig>>({
    enabled: true,
    reportMinLength: 3,
    reportMaxLength: 2000,
    reportAckTemplate: '✅ **Report Received & Mirrored** | Tracking reference: `{interactionId}`',
    mirrorFormattingTemplate: '🚨 **New Incident/Report Mirrored**\n**From User:** {user} (<@{userId}>)\n**Channel:** <#{channel}>\n**Report Details:**\n> {content}\n\n*Recorded at: {timestamp}*',
  });

  const [savingStatus, setSavingStatus] = useState(false);
  const [savingReport, setSavingReport] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const sc = configs.find((c) => c.commandName === 'status');
    if (sc) {
      setStatusConfig(sc);
    }
    const rc = configs.find((c) => c.commandName === 'report');
    if (rc) {
      setReportConfig(rc);
    }
  }, [configs]);

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingStatus(true);
      setAlert(null);
      await api.updateCommandConfig('status', statusConfig);
      setAlert({ type: 'success', message: 'Successfully updated /status command behavior.' });
      onRefresh();
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to save /status settings.' });
    } finally {
      setSavingStatus(false);
    }
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingReport(true);
      setAlert(null);
      await api.updateCommandConfig('report', reportConfig);
      setAlert({ type: 'success', message: 'Successfully updated /report command behavior.' });
      onRefresh();
    } catch (err: any) {
      setAlert({ type: 'error', message: err.message || 'Failed to save /report settings.' });
    } finally {
      setSavingReport(false);
    }
  };

  // Preview computations
  const sampleContent = 'High packet loss observed on production cluster us-east-1';
  const sampleTimestamp = new Date().toUTCString();

  const reportMirrorPreview = (reportConfig.mirrorFormattingTemplate || '')
    .replace('{user}', 'alex_engineer')
    .replace('{userId}', '123456789012345678')
    .replace('{channel}', '112233445566778899')
    .replace('{server}', 'Enterprise Discord Operations')
    .replace('{timestamp}', sampleTimestamp)
    .replace('{content}', sampleContent);

  return (
    <div className="space-y-6">
      {alert && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
            alert.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {alert.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{alert.message}</span>
        </div>
      )}

      {/* Grid: 2 Columns for the 2 commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* /status Behavior */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <form onSubmit={handleSaveStatus} className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-sm text-slate-200">/status Command Policy</h3>
              </div>
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={statusConfig.enabled}
                  onChange={(e) => setStatusConfig({ ...statusConfig, enabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={statusConfig.enabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {statusConfig.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                  Status Message Header Template
                </label>
                <textarea
                  rows={3}
                  value={statusConfig.statusMessageTemplate || ''}
                  onChange={(e) => setStatusConfig({ ...statusConfig, statusMessageTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-medium">Append System Metrics</div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Includes Uptime, Node runtime, and Server Memory in response
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={statusConfig.includeSystemMetrics}
                  onChange={(e) => setStatusConfig({ ...statusConfig, includeSystemMetrics: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              {/* Live Discord Preview */}
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                  Discord Response Preview
                </div>
                <div className="bg-[#313338] rounded-lg p-3 text-slate-200 font-sans text-xs border border-slate-700/50 shadow-inner">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] text-white font-bold">
                      BOT
                    </div>
                    <span className="font-semibold text-white text-xs">InterOps Bot</span>
                    <span className="text-[10px] bg-[#5865F2] text-white px-1 rounded font-mono uppercase">
                      APP
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap font-mono text-xs text-slate-200 bg-[#2b2d31] p-2.5 rounded border border-slate-700/40">
                    {statusConfig.statusMessageTemplate}
                    {statusConfig.includeSystemMetrics && (
                      <div className="mt-2 text-slate-400 text-[11px] border-t border-slate-700 pt-1.5">
                        • Uptime: 4h 12m 30s | Environment: Production | DB: Connected
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingStatus}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingStatus ? 'Saving...' : 'Save /status Configuration'}</span>
            </button>
          </form>
        </div>

        {/* /report Behavior */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <form onSubmit={handleSaveReport} className="space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-sm text-slate-200">/report Command Policy</h3>
              </div>
              <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={reportConfig.enabled}
                  onChange={(e) => setReportConfig({ ...reportConfig, enabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className={reportConfig.enabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                  {reportConfig.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 uppercase tracking-wider font-semibold text-[11px]">
                    Min Input Length
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={reportConfig.reportMinLength || 3}
                    onChange={(e) => setReportConfig({ ...reportConfig, reportMinLength: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 uppercase tracking-wider font-semibold text-[11px]">
                    Max Input Length
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    value={reportConfig.reportMaxLength || 2000}
                    onChange={(e) => setReportConfig({ ...reportConfig, reportMaxLength: parseInt(e.target.value) || 2000 })}
                    className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 uppercase tracking-wider font-semibold text-[11px]">
                  Immediate Discord ACK Response Template
                </label>
                <input
                  type="text"
                  value={reportConfig.reportAckTemplate || ''}
                  onChange={(e) => setReportConfig({ ...reportConfig, reportAckTemplate: e.target.value })}
                  className="w-full px-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                    Mirror Webhook Template
                  </label>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    Placeholders: {'{user}'}, {'{content}'}, {'{timestamp}'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={reportConfig.mirrorFormattingTemplate || ''}
                  onChange={(e) => setReportConfig({ ...reportConfig, mirrorFormattingTemplate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs leading-relaxed"
                />
              </div>

              {/* Mirror Notification Live Preview */}
              <div>
                <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Downstream Webhook Live Preview</span>
                  <span className="text-purple-400">Secondary Channel</span>
                </div>
                <div className="bg-[#1e1f22] rounded-lg p-3 text-slate-200 font-mono text-xs border border-purple-500/20 whitespace-pre-wrap">
                  {reportMirrorPreview}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingReport}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingReport ? 'Saving...' : 'Save /report Configuration'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
