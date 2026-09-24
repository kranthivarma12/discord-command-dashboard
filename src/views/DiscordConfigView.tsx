import React, { useState, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Radio,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  ExternalLink,
  Copy,
  Terminal,
  Eye,
  EyeOff,
  Link,
  Key,
} from 'lucide-react';
import { DiscordConfig } from '../types.ts';
import { api } from '../api.ts';

interface DiscordConfigViewProps {
  config: DiscordConfig | null;
  onRefresh: () => void;
}

export const DiscordConfigView: React.FC<DiscordConfigViewProps> = ({ config, onRefresh }) => {
  const [formData, setFormData] = useState({
    guildId: '',
    applicationId: '',
    publicKey: '',
    botToken: '',
    targetChannelId: '',
    mirrorDestinationUrl: '',
    mirrorDestinationType: 'discord_webhook' as 'discord_webhook' | 'slack_webhook',
    mirrorEnabled: true,
    maxMirrorRetries: 3,
    retryBackoffMs: 1000,
  });

  const [saving, setSaving] = useState(false);
  const [testingMirror, setTestingMirror] = useState(false);
  const [registeringCommands, setRegisteringCommands] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBotToken, setShowBotToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        guildId: config.guildId || '',
        applicationId: config.applicationId || '',
        publicKey: config.publicKey || '',
        botToken: '', // Keep blank unless updating
        targetChannelId: config.targetChannelId || '',
        mirrorDestinationUrl: '', // Keep blank unless updating
        mirrorDestinationType: config.mirrorDestinationType || 'discord_webhook',
        mirrorEnabled: config.mirrorEnabled ?? true,
        maxMirrorRetries: config.maxMirrorRetries || 3,
        retryBackoffMs: config.retryBackoffMs || 1000,
      });
    }
  }, [config]);

  const endpointUrl = `${window.location.origin}/api/discord/interactions`;

  const inviteUrl = formData.applicationId
    ? `https://discord.com/oauth2/authorize?client_id=${formData.applicationId}&scope=bot%20applications.commands&permissions=2147483648`
    : null;

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setStatusMessage(null);

      const payload: any = {
        guildId: formData.guildId.trim(),
        applicationId: formData.applicationId.trim(),
        publicKey: formData.publicKey.trim(),
        targetChannelId: formData.targetChannelId.trim(),
        mirrorDestinationType: formData.mirrorDestinationType,
        mirrorEnabled: formData.mirrorEnabled,
        maxMirrorRetries: Number(formData.maxMirrorRetries),
        retryBackoffMs: Number(formData.retryBackoffMs),
      };

      if (formData.botToken.trim()) {
        payload.botToken = formData.botToken.trim();
      }
      if (formData.mirrorDestinationUrl.trim()) {
        payload.mirrorDestinationUrl = formData.mirrorDestinationUrl.trim();
      }

      const res = await api.updateDiscordConfig(payload);
      setStatusMessage({ type: 'success', text: res.message });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update configuration.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestMirror = async () => {
    try {
      setTestingMirror(true);
      setStatusMessage(null);
      const res = await api.testMirrorWebhook();
      setStatusMessage({
        type: res.success ? 'success' : 'error',
        text: `Mirror Test: ${res.message} ${res.status ? `(HTTP ${res.status})` : ''}`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Mirror Test Failed: ${err.message}` });
    } finally {
      setTestingMirror(false);
    }
  };

  const handleRegisterCommands = async () => {
    try {
      setRegisteringCommands(true);
      setStatusMessage(null);
      const res = await api.registerDiscordCommands();
      setStatusMessage({
        type: res.success ? 'success' : 'error',
        text: `Command Registration: ${res.message}`,
      });
      onRefresh();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `Failed to register commands: ${err.message}` });
    } finally {
      setRegisteringCommands(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Endpoint Callout Banner */}
      <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-5 text-xs font-mono">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm mb-1">
              <Radio className="w-4 h-4 text-indigo-400" />
              <span>Public Discord Interactions Endpoint</span>
            </div>
            <p className="text-slate-400 text-xs font-sans">
              Enter this HTTPS URL into your Discord Developer Portal under{' '}
              <strong className="text-slate-200">"Interactions Endpoint URL"</strong>:
            </p>
          </div>
          <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800">
            <code className="text-emerald-400 px-2 select-all font-mono text-xs truncate max-w-sm">
              {endpointUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyEndpoint}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedUrl ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Discord Bot Credentials */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-400" />
              <h3 className="font-semibold text-sm text-slate-200">1. Discord Application & Server Credentials</h3>
            </div>
            {inviteUrl && (
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>Add Bot to Discord Server</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Application ID */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Discord Application ID
              </label>
              <input
                type="text"
                value={formData.applicationId}
                onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
                placeholder="e.g. 134567890123456789"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Public Key (Ed25519) */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Public Key (Ed25519 64-Hex)
              </label>
              <input
                type="text"
                value={formData.publicKey}
                onChange={(e) => setFormData({ ...formData, publicKey: e.target.value })}
                placeholder="64-character hex public key"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Guild ID */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Discord Server (Guild) ID
              </label>
              <input
                type="text"
                value={formData.guildId}
                onChange={(e) => setFormData({ ...formData, guildId: e.target.value })}
                placeholder="e.g. 987654321098765432 (Blank for Global)"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                Guild commands register instantly; global commands can take up to 1 hour to propagate.
              </p>
            </div>

            {/* Bot Token */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-400 uppercase tracking-wider font-semibold">
                  Discord Bot Token
                </label>
                {config?.hasBotToken && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    Configured ({config.botTokenMasked})
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showBotToken ? 'text' : 'password'}
                  value={formData.botToken}
                  onChange={(e) => setFormData({ ...formData, botToken: e.target.value })}
                  placeholder={config?.hasBotToken ? 'Leave blank to keep existing token' : 'Enter Bot Token (from Discord Dev Portal)'}
                  className="w-full px-3 py-2 pr-10 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                Stored securely and never returned in plaintext to the browser.
              </p>
            </div>
          </div>

          {/* Register Slash Commands Button */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleRegisterCommands}
              disabled={registeringCommands || (!formData.applicationId && !config?.applicationId)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <Terminal className={`w-3.5 h-3.5 ${registeringCommands ? 'animate-spin' : ''}`} />
              <span>{registeringCommands ? 'Registering with Discord API...' : 'Register Slash Commands (/status & /report)'}</span>
            </button>
          </div>
        </div>

        {/* Section 2: Channel Restrictions & Mirror Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-400" />
              <h3 className="font-semibold text-sm text-slate-200">2. Channel & Downstream Mirror Settings</h3>
            </div>
            <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
              <input
                type="checkbox"
                checked={formData.mirrorEnabled}
                onChange={(e) => setFormData({ ...formData, mirrorEnabled: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className={formData.mirrorEnabled ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {formData.mirrorEnabled ? 'Mirroring Enabled' : 'Mirroring Disabled'}
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {/* Target Channel ID */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Designated Command Channel ID
              </label>
              <input
                type="text"
                value={formData.targetChannelId}
                onChange={(e) => setFormData({ ...formData, targetChannelId: e.target.value })}
                placeholder="Leave blank to permit commands in all channels"
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1 font-sans">
                If specified, interactions invoked in other channels will be politely guided to this channel.
              </p>
            </div>

            {/* Mirror Destination Type */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Mirror Destination Webhook Protocol
              </label>
              <select
                value={formData.mirrorDestinationType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    mirrorDestinationType: e.target.value as 'discord_webhook' | 'slack_webhook',
                  })
                }
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="discord_webhook">Discord Webhook (https://discord.com/api/webhooks/...)</option>
                <option value="slack_webhook">Slack Incoming Webhook (https://hooks.slack.com/services/...)</option>
              </select>
            </div>

            {/* Mirror Destination URL */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-slate-400 uppercase tracking-wider font-semibold">
                  Mirror Destination Webhook URL
                </label>
                {config?.hasMirrorUrl && (
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                    Configured ({config.mirrorDestinationUrlMasked})
                  </span>
                )}
              </div>
              <input
                type="text"
                value={formData.mirrorDestinationUrl}
                onChange={(e) => setFormData({ ...formData, mirrorDestinationUrl: e.target.value })}
                placeholder={config?.hasMirrorUrl ? 'Leave blank to keep existing webhook URL' : 'https://discord.com/api/webhooks/12345/abcdef...'}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            {/* Max Retries */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Max Mirror Retries
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.maxMirrorRetries}
                onChange={(e) => setFormData({ ...formData, maxMirrorRetries: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Retry Backoff MS */}
            <div>
              <label className="block text-slate-400 mb-1.5 uppercase tracking-wider font-semibold">
                Initial Retry Backoff (ms)
              </label>
              <input
                type="number"
                min="100"
                max="10000"
                step="100"
                value={formData.retryBackoffMs}
                onChange={(e) => setFormData({ ...formData, retryBackoffMs: parseInt(e.target.value) || 1000 })}
                className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Test Mirror Button */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="button"
              onClick={handleTestMirror}
              disabled={testingMirror || (!formData.mirrorDestinationUrl && !config?.hasMirrorUrl)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-purple-300 text-xs font-semibold rounded-lg border border-purple-500/30 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <Send className={`w-3.5 h-3.5 ${testingMirror ? 'animate-spin' : ''}`} />
              <span>{testingMirror ? 'Sending Test Notification...' : 'Test Mirror Webhook Now'}</span>
            </button>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Configuration...' : 'Save All Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
