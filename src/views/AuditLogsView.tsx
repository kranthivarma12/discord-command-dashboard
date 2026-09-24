import React from 'react';
import { ShieldCheck, UserCheck, Settings, Send, RotateCw, Terminal, Activity } from 'lucide-react';
import { ActionLog } from '../types.ts';

interface AuditLogsViewProps {
  logs: ActionLog[];
  onRefresh: () => void;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs, onRefresh }) => {
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'login':
        return <UserCheck className="w-4 h-4 text-emerald-400" />;
      case 'update_discord_config':
      case 'update_command_config':
        return <Settings className="w-4 h-4 text-indigo-400" />;
      case 'test_mirror_webhook':
        return <Send className="w-4 h-4 text-purple-400" />;
      case 'register_commands':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case 'retry_mirror_delivery':
        return <RotateCw className="w-4 h-4 text-cyan-400" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Administrative Security Audit Trail</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Append-only audit trail logging credential changes, configuration edits, webhook triggers, and administrative actions.
            </p>
          </div>
        </div>

        <button
          onClick={onRefresh}
          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
        >
          Refresh Logs
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Actor</th>
                <th className="py-3 px-4 font-semibold">Details</th>
                <th className="py-3 px-4 font-semibold">IP Address</th>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No administrative audit events recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(item.actionType)}
                        <span className="font-semibold text-slate-200">{item.actionType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-indigo-300 font-bold">{item.actor}</td>
                    <td className="py-3 px-4 max-w-md truncate text-slate-400">
                      {item.details ? (
                        <span title={item.details}>{item.details}</span>
                      ) : (
                        <span className="text-slate-600 italic">No payload</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{item.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
