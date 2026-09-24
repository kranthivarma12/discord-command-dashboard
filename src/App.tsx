import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, NavView } from './components/Sidebar.tsx';
import { Header } from './components/Header.tsx';
import { LoginView } from './components/LoginView.tsx';
import { OverviewView } from './views/OverviewView.tsx';
import { CommandLogsView } from './views/CommandLogsView.tsx';
import { FailuresView } from './views/FailuresView.tsx';
import { DiscordConfigView } from './views/DiscordConfigView.tsx';
import { CommandBehaviorView } from './views/CommandBehaviorView.tsx';
import { SimulatorView } from './views/SimulatorView.tsx';
import { AuditLogsView } from './views/AuditLogsView.tsx';
import { api, getAuthToken } from './api.ts';
import {
  User,
  OverviewMetrics,
  InteractionLog,
  MirrorAttempt,
  DiscordConfig,
  CommandConfig,
  ActionLog,
} from './types.ts';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentView, setCurrentView] = useState<NavView>('overview');

  // Shared state
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [recentLogs, setRecentLogs] = useState<InteractionLog[]>([]);
  const [failures, setFailures] = useState<MirrorAttempt[]>([]);
  const [discordConfig, setDiscordConfig] = useState<DiscordConfig | null>(null);
  const [commandConfigs, setCommandConfigs] = useState<CommandConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActionLog[]>([]);

  // Logs view specific state
  const [logsList, setLogsList] = useState<InteractionLog[]>([]);
  const [logsPagination, setLogsPagination] = useState({ total: 0, page: 1, limit: 15, pages: 1 });
  const [logsSearch, setLogsSearch] = useState('');
  const [logsCommandFilter, setLogsCommandFilter] = useState('');
  const [logsStatusFilter, setLogsStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<InteractionLog | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check auth session
  const checkAuth = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    const handleLogoutEvent = () => {
      setUser(null);
    };
    window.addEventListener('auth_logout', handleLogoutEvent);
    return () => window.removeEventListener('auth_logout', handleLogoutEvent);
  }, [checkAuth]);

  // Data fetching
  const refreshAllData = useCallback(async () => {
    if (!user) return;
    try {
      setIsRefreshing(true);
      const [overviewData, failuresData, configData, cmdConfigsData] = await Promise.all([
        api.getOverview().catch(() => null),
        api.getFailures().catch(() => ({ failures: [] })),
        api.getDiscordConfig().catch(() => null),
        api.getCommandConfigs().catch(() => ({ configs: [] })),
      ]);

      if (overviewData) {
        setMetrics(overviewData.metrics);
        setRecentLogs(overviewData.recentInteractions);
      }
      if (failuresData) {
        setFailures(failuresData.failures);
      }
      if (configData) {
        setDiscordConfig(configData);
      }
      if (cmdConfigsData) {
        setCommandConfigs(cmdConfigsData.configs);
      }
    } catch (err) {
      console.error('Failed to refresh data', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  // Fetch logs when parameters change
  const fetchLogs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getInteractionLogs({
        page: logsPagination.page,
        limit: logsPagination.limit,
        command: logsCommandFilter || undefined,
        status: logsStatusFilter || undefined,
        search: logsSearch || undefined,
      });
      setLogsList(res.logs);
      setLogsPagination(res.pagination);
    } catch (err) {
      console.error('Failed to fetch interaction logs', err);
    }
  }, [user, logsPagination.page, logsPagination.limit, logsCommandFilter, logsStatusFilter, logsSearch]);

  // Fetch audit logs
  const fetchAuditLogs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.getActionLogs();
      setAuditLogs(res.logs);
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    }
  }, [user]);

  // Refresh on view change
  useEffect(() => {
    if (!user) return;
    refreshAllData();

    if (currentView === 'logs') {
      fetchLogs();
    } else if (currentView === 'audit') {
      fetchAuditLogs();
    }
  }, [user, currentView, refreshAllData, fetchLogs, fetchAuditLogs]);

  // Auto-polling interval for live telemetry (every 10 seconds)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refreshAllData();
      if (currentView === 'logs') {
        fetchLogs();
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [user, currentView, refreshAllData, fetchLogs]);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-400">Loading Discord InterOps Console...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={setCurrentView}
        user={user}
        onLogout={handleLogout}
        failureCount={failures.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          currentView={currentView}
          onRefresh={() => {
            refreshAllData();
            if (currentView === 'logs') fetchLogs();
            if (currentView === 'audit') fetchAuditLogs();
          }}
          isRefreshing={isRefreshing}
          onOpenSimulator={() => setCurrentView('simulator')}
          failureCount={failures.length}
        />

        <main className="flex-1 overflow-y-auto p-6">
          {currentView === 'overview' && (
            <OverviewView
              metrics={metrics}
              recentLogs={recentLogs}
              recentFailures={failures}
              onNavigate={setCurrentView}
              onSelectInteraction={(log) => {
                setSelectedLog(log);
                setCurrentView('logs');
              }}
            />
          )}

          {currentView === 'logs' && (
            <CommandLogsView
              logs={logsList}
              totalLogs={logsPagination.total}
              currentPage={logsPagination.page}
              totalPages={logsPagination.pages}
              onPageChange={(page) => setLogsPagination((prev) => ({ ...prev, page }))}
              searchTerm={logsSearch}
              onSearchChange={(search) => {
                setLogsSearch(search);
                setLogsPagination((prev) => ({ ...prev, page: 1 }));
              }}
              filterCommand={logsCommandFilter}
              onFilterCommandChange={(cmd) => {
                setLogsCommandFilter(cmd);
                setLogsPagination((prev) => ({ ...prev, page: 1 }));
              }}
              filterStatus={logsStatusFilter}
              onFilterStatusChange={(status) => {
                setLogsStatusFilter(status);
                setLogsPagination((prev) => ({ ...prev, page: 1 }));
              }}
              selectedLog={selectedLog}
              onSelectLog={setSelectedLog}
            />
          )}

          {currentView === 'failures' && (
            <FailuresView
              failures={failures}
              onRefresh={() => {
                refreshAllData();
              }}
            />
          )}

          {currentView === 'simulator' && (
            <SimulatorView
              onNavigate={setCurrentView}
              onRefreshAll={refreshAllData}
            />
          )}

          {currentView === 'discord_config' && (
            <DiscordConfigView
              config={discordConfig}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'command_behavior' && (
            <CommandBehaviorView
              configs={commandConfigs}
              onRefresh={refreshAllData}
            />
          )}

          {currentView === 'audit' && (
            <AuditLogsView
              logs={auditLogs}
              onRefresh={fetchAuditLogs}
            />
          )}
        </main>
      </div>
    </div>
  );
}
