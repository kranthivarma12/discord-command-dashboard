import React, { useState } from 'react';
import {
  Search,
  Filter,
  Download,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Code,
  X,
  Radio,
  FileText,
} from 'lucide-react';
import { InteractionLog } from '../types.ts';

interface CommandLogsViewProps {
  logs: InteractionLog[];
  totalLogs: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  filterCommand: string;
  onFilterCommandChange: (val: string) => void;
  filterStatus: string;
  onFilterStatusChange: (val: string) => void;
  selectedLog: InteractionLog | null;
  onSelectLog: (log: InteractionLog | null) => void;
}

export const CommandLogsView: React.FC<CommandLogsViewProps> = ({
  logs,
  totalLogs,
  currentPage,
  totalPages,
  onPageChange,
  searchTerm,
  onSearchChange,
  filterCommand,
  onFilterCommandChange,
  filterStatus,
  onFilterStatusChange,
  selectedLog,
  onSelectLog,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `discord-interaction-logs-${new Date().toISOString()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search user, ID, or command content..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          />
        </div>

        {/* Filters and Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {/* Command filter */}
          <select
            value={filterCommand}
            onChange={(e) => onFilterCommandChange(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          >
            <option value="">All Commands</option>
            <option value="status">/status</option>
            <option value="report">/report</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="duplicate">Duplicate (Idempotent)</option>
            <option value="failed">Failed</option>
            <option value="received">Received</option>
          </select>

          {/* Export JSON button */}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Interaction ID</th>
                <th className="py-3 px-4 font-semibold">Command</th>
                <th className="py-3 px-4 font-semibold">Discord User</th>
                <th className="py-3 px-4 font-semibold">Raw Input</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No interaction logs matching the current criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => onSelectLog(log)}
                    className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-indigo-300 font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[110px]">{log.interactionId}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(log.interactionId);
                          }}
                          className="text-slate-500 hover:text-slate-300 transition-colors"
                          title="Copy Interaction ID"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-semibold">
                        /{log.commandName || 'cmd'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      <div>
                        <div>{log.username || 'Anonymous'}</div>
                        <div className="text-[10px] text-slate-500">{log.userId || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-400">
                      {log.rawInput || <span className="text-slate-600 italic">None</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          log.processingStatus === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : log.processingStatus === 'duplicate'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : log.processingStatus === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {log.processingStatus === 'completed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {log.processingStatus === 'failed' && <XCircle className="w-2.5 h-2.5" />}
                        {log.processingStatus === 'duplicate' && <Copy className="w-2.5 h-2.5" />}
                        {log.processingStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLog(log);
                        }}
                        className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700/80 transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Showing {logs.length} of {totalLogs} total interactions
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-slate-200">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Inspector Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-100 font-mono">
                    Interaction {selectedLog.interactionId}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Recorded {new Date(selectedLog.createdAt).toUTCString()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onSelectLog(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs font-mono">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <div className="text-[10px] uppercase text-slate-500">Command</div>
                  <div className="font-semibold text-indigo-300 mt-0.5">/{selectedLog.commandName}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500">Status</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">{selectedLog.processingStatus}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500">User</div>
                  <div className="text-slate-200 mt-0.5 truncate">{selectedLog.username || selectedLog.userId}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-slate-500">Channel ID</div>
                  <div className="text-slate-300 mt-0.5 truncate">{selectedLog.channelId || 'N/A'}</div>
                </div>
              </div>

              {/* Raw Input */}
              {selectedLog.rawInput && (
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-bold mb-1.5">
                    Command Input Text
                  </label>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-slate-200">
                    {selectedLog.rawInput}
                  </div>
                </div>
              )}

              {/* Response Payload */}
              <div>
                <label className="block text-[11px] uppercase text-slate-400 font-bold mb-1.5">
                  Discord Response Payload (Type {selectedLog.interactionType})
                </label>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-emerald-400 overflow-x-auto text-[11px] leading-relaxed">
                  {selectedLog.responsePayload
                    ? (() => {
                        try {
                          return JSON.stringify(JSON.parse(selectedLog.responsePayload), null, 2);
                        } catch {
                          return selectedLog.responsePayload;
                        }
                      })()
                    : 'No response payload recorded.'}
                </pre>
              </div>

              {/* Actions Performed JSON */}
              {selectedLog.actionsPerformed && (
                <div>
                  <label className="block text-[11px] uppercase text-slate-400 font-bold mb-1.5">
                    Actions Performed Log
                  </label>
                  <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-indigo-300 overflow-x-auto text-[11px] leading-relaxed">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedLog.actionsPerformed), null, 2);
                      } catch {
                        return selectedLog.actionsPerformed;
                      }
                    })()}
                  </pre>
                </div>
              )}

              {/* Error Message */}
              {selectedLog.errorMessage && (
                <div>
                  <label className="block text-[11px] uppercase text-rose-400 font-bold mb-1.5">
                    Execution Error
                  </label>
                  <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded-lg text-rose-300">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
              <button
                onClick={() => onSelectLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
