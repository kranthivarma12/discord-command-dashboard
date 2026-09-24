import {
  User,
  OverviewMetrics,
  InteractionLog,
  MirrorAttempt,
  DiscordConfig,
  CommandConfig,
  ActionLog,
} from './types.ts';

const TOKEN_KEY = 'discord_interops_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // If not on login endpoint, remove invalid token
    if (!endpoint.startsWith('/auth/login')) {
      removeAuthToken();
      window.dispatchEvent(new Event('auth_logout'));
    }
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || 'Unauthorized: Please log in.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Authentication
  async getMe(): Promise<{ authenticated: boolean; user?: User }> {
    return request('/auth/me');
  },

  async login(credentials: { username: string; password: string }): Promise<{ success: boolean; user: User; token: string }> {
    const res = await request<{ success: boolean; user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    if (res.token) {
      setAuthToken(res.token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      removeAuthToken();
      window.dispatchEvent(new Event('auth_logout'));
    }
  },

  // Overview & Metrics
  async getOverview(): Promise<{
    metrics: OverviewMetrics;
    recentInteractions: InteractionLog[];
    recentFailures: MirrorAttempt[];
  }> {
    return request('/overview');
  },

  // Interaction Logs
  async getInteractionLogs(params: {
    page?: number;
    limit?: number;
    command?: string;
    status?: string;
    search?: string;
  } = {}): Promise<{
    logs: InteractionLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.command) query.set('command', params.command);
    if (params.status) query.set('status', params.status);
    if (params.search) query.set('search', params.search);

    return request(`/logs/interactions?${query.toString()}`);
  },

  // Failures & Dead-letter Queue
  async getFailures(): Promise<{ failures: MirrorAttempt[] }> {
    return request('/logs/failures');
  },

  async retryMirrorAttempt(attemptId: number): Promise<{ success: boolean; message: string; attempt: MirrorAttempt }> {
    return request(`/logs/failures/${attemptId}/retry`, {
      method: 'POST',
    });
  },

  // Discord Configuration
  async getDiscordConfig(): Promise<DiscordConfig> {
    return request('/config/discord');
  },

  async updateDiscordConfig(config: Partial<DiscordConfig> & { botToken?: string; mirrorDestinationUrl?: string }): Promise<{ success: boolean; message: string }> {
    return request('/config/discord', {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  async testMirrorWebhook(): Promise<{ success: boolean; message: string; status?: number; preview?: string }> {
    return request('/config/discord/test-mirror', {
      method: 'POST',
    });
  },

  async registerDiscordCommands(): Promise<{ success: boolean; message: string; data?: any }> {
    return request('/config/discord/register-commands', {
      method: 'POST',
    });
  },

  // Command Behavior Configuration
  async getCommandConfigs(): Promise<{ configs: CommandConfig[] }> {
    return request('/config/commands');
  },

  async updateCommandConfig(commandName: string, updates: Partial<CommandConfig>): Promise<{ success: boolean; config: CommandConfig }> {
    return request(`/config/commands/${commandName}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Security Audit Logs
  async getActionLogs(): Promise<{ logs: ActionLog[] }> {
    return request('/audit/actions');
  },

  // Interactive Simulator Endpoint
  async simulateInteraction(payload: {
    command: 'status' | 'report';
    text?: string;
    username?: string;
    userId?: string;
    channelId?: string;
    guildId?: string;
  }): Promise<{
    success: boolean;
    interactionId: string;
    response: any;
    executionTimeMs: number;
    mirrorTriggered: boolean;
  }> {
    return request('/discord/simulate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
