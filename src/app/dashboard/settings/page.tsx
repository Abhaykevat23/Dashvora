'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardStore } from '../../../store/dashboardStore';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  AlertCircle,
  ArrowLeft,
  Save,
  ShieldCheck,
  KeyRound,
  Bot,
  Globe,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();

  // ============ Profile Fields ============
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // ============ Password Fields ============
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ============ AI Key Fields ============
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4o');
  const [aiEndpoint, setAiEndpoint] = useState('https://api.openai.com/v1');
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasAiKey, setHasAiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState('');
  const [showAiKey, setShowAiKey] = useState(false);

  // ============ UI State ============
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [aiKeyLoading, setAiKeyLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiKeyMessage, setAiKeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ============ Fetch user data on mount ============
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/auth/ai-key').then(r => r.json()).catch(() => ({ success: false })),
    ])
      .then(([userData, aiKeyData]) => {
        if (userData.success && userData.user) {
          setUser(userData.user);
          setName(userData.user.name || '');
          setEmail(userData.user.email || '');
        }
        if (aiKeyData.success && aiKeyData.config) {
          setAiProvider(aiKeyData.config.provider || 'openai');
          setAiModel(aiKeyData.config.model || 'gpt-4o');
          setAiEndpoint(aiKeyData.config.endpoint || 'https://api.openai.com/v1');
          setHasAiKey(aiKeyData.config.hasKey || false);
          setKeyPreview(aiKeyData.config.keyPreview || '');

          // Sync the full key into the store so AI prompts work immediately
          if (aiKeyData.config.fullKey) {
            useDashboardStore.getState().setAiConfig({
              provider: aiKeyData.config.provider || 'openai',
              model: aiKeyData.config.model || 'gpt-4o',
              endpoint: (aiKeyData.config.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, ''),
              apiKey: aiKeyData.config.fullKey,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ============ Submit Profile Update ============
  const handleProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMessage(null);

    // Validate
    if (!name.trim()) {
      setProfileMessage({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }
    if (!email.trim()) {
      setProfileMessage({ type: 'error', text: 'Email cannot be empty.' });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setProfileMessage({ type: 'error', text: 'Please provide a valid email address.' });
      return;
    }

    setProfileLoading(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });

      const data = await res.json();

      if (!data.success) {
        setProfileMessage({ type: 'error', text: data.error || 'Failed to update profile.' });
        setProfileLoading(false);
        return;
      }

      setUser(data.user);
      setName(data.user.name);
      setEmail(data.user.email);
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
      setProfileLoading(false);

      // Auto-clear success message
      setTimeout(() => setProfileMessage(null), 3000);
    } catch {
      setProfileMessage({ type: 'error', text: 'Network error. Please try again.' });
      setProfileLoading(false);
    }
  };

  // ============ Submit AI Key ============
  const handleAiKeySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAiKeyMessage(null);

    if (!aiApiKey.trim() && !hasAiKey) {
      setAiKeyMessage({ type: 'error', text: 'Please enter an API key.' });
      return;
    }

    setAiKeyLoading(true);

    try {
      const body: Record<string, string> = {
        provider: aiProvider,
        model: aiModel,
        endpoint: aiEndpoint.replace(/\/+$/, ''),
      };

      if (aiApiKey.trim()) {
        body.apiKey = aiApiKey.trim();
      }

      const res = await fetch('/api/auth/ai-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setAiKeyMessage({ type: 'error', text: data.error || 'Failed to save AI configuration.' });
        setAiKeyLoading(false);
        return;
      }

      setHasAiKey(true);
      setKeyPreview(aiApiKey.slice(0, 8) + '...' + aiApiKey.slice(-4));

      // Sync the API key into the dashboard store so it's available for AI prompts
      useDashboardStore.getState().setAiConfig({
        provider: aiProvider,
        model: aiModel,
        endpoint: aiEndpoint.replace(/\/+$/, ''),
        apiKey: aiApiKey.trim(),
      });

      setAiApiKey('');
      setAiKeyMessage({ type: 'success', text: 'AI key configuration saved and encrypted.' });
      setAiKeyLoading(false);

      setTimeout(() => setAiKeyMessage(null), 3000);
    } catch {
      setAiKeyMessage({ type: 'error', text: 'Network error. Please try again.' });
      setAiKeyLoading(false);
    }
  };

  // ============ Submit Password Change ============
  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Current password is required.' });
      return;
    }
    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: 'New password is required.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!data.success) {
        setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password.' });
        setPasswordLoading(false);
        return;
      }

      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordLoading(false);

      setTimeout(() => setPasswordMessage(null), 3000);
    } catch {
      setPasswordMessage({ type: 'error', text: 'Network error. Please try again.' });
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b]">
      {/* Background grid */}
      <div className="absolute inset-0 tech-grid opacity-20 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-[#09090b]/40 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">Settings</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-8 animate-pulse">
            <div className="glass-panel rounded-xl border border-white/10 p-8">
              <div className="h-5 w-36 bg-zinc-800 rounded mb-4" />
              <div className="h-3 w-56 bg-zinc-800/60 rounded mb-6" />
              <div className="space-y-4 max-w-lg">
                <div className="h-10 bg-zinc-800/40 rounded-xl" />
                <div className="h-10 bg-zinc-800/40 rounded-xl" />
                <div className="h-10 w-32 bg-zinc-800/40 rounded-xl" />
              </div>
            </div>
            <div className="glass-panel rounded-xl border border-white/10 p-8">
              <div className="h-5 w-36 bg-zinc-800 rounded mb-4" />
              <div className="h-3 w-56 bg-zinc-800/60 rounded mb-6" />
              <div className="space-y-4 max-w-lg">
                <div className="h-10 bg-zinc-800/40 rounded-xl" />
                <div className="h-10 bg-zinc-800/40 rounded-xl" />
                <div className="h-10 bg-zinc-800/40 rounded-xl" />
                <div className="h-10 w-40 bg-zinc-800/40 rounded-xl" />
              </div>
            </div>
          </div>
        )}


        {!loading && (
          <>
            {/* ============ Profile Section ============ */}
            <section className="glass-panel rounded-xl border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Profile Information</h2>
                  <p className="text-xs text-zinc-500">Update your name and email address</p>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-5 max-w-lg">
                {/* Name */}
                <div>
                  <label htmlFor="settings-name" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your full name"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="settings-email" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Message */}
                {profileMessage && (
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                      profileMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {profileMessage.type === 'success' ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {profileMessage.text}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 transition-all"
                >
                  {profileLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* ============ Password Section ============ */}
            <section className="glass-panel rounded-xl border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Change Password</h2>
                  <p className="text-xs text-zinc-500">Enter your current password and a new one</p>
                </div>
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-lg">
                {/* Current Password */}
                <div>
                  <label htmlFor="settings-current-pw" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-current-pw"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent(!showCurrent)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div>
                  <label htmlFor="settings-new-pw" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-new-pw"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div>
                  <label htmlFor="settings-confirm-pw" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-confirm-pw"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Message */}
                {passwordMessage && (
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                      passwordMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {passwordMessage.type === 'success' ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {passwordMessage.text}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-amber-500/20 transition-all"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      Change Password
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* ============ AI Key Configuration Section ============ */}
            <section className="glass-panel rounded-xl border border-white/10 p-8">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-600 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">AI Dashboard Generator</h2>
                  <p className="text-xs text-zinc-500">Configure your AI provider to automatically generate dashboards from natural language</p>
                </div>
              </div>

              <form onSubmit={handleAiKeySubmit} className="space-y-5 max-w-lg">
                {/* Provider */}
                <div>
                  <label htmlFor="settings-ai-provider" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    AI Provider
                  </label>
                  <div className="relative">
                    <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <select
                      id="settings-ai-provider"
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="openai" className="bg-zinc-950">OpenAI</option>
                      <option value="anthropic" className="bg-zinc-950">Anthropic Claude</option>
                      <option value="groq" className="bg-zinc-950">Groq</option>
                      <option value="together" className="bg-zinc-950">Together AI</option>
                      <option value="custom" className="bg-zinc-950">Custom (OpenAI-compatible)</option>
                    </select>
                  </div>
                </div>

                {/* Model */}
                <div>
                  <label htmlFor="settings-ai-model" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    Model Name
                  </label>
                  <div className="relative">
                    <Bot className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-ai-model"
                      type="text"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="gpt-4o"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Examples: gpt-4o, claude-sonnet-4-20250514, llama-3.3-70b-versatile
                  </p>
                </div>

                {/* API Endpoint */}
                <div>
                  <label htmlFor="settings-ai-endpoint" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    API Endpoint
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-ai-endpoint"
                      type="text"
                      value={aiEndpoint}
                      onChange={(e) => setAiEndpoint(e.target.value)}
                      placeholder="https://api.openai.com/v1"
                      className="w-full pl-10 pr-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* API Key */}
                <div>
                  <label htmlFor="settings-ai-key" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                    API Key
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      id="settings-ai-key"
                      type={showAiKey ? 'text' : 'password'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder={hasAiKey ? '•••••••••• (key saved — enter new one to replace)' : 'sk-proj-...'}
                      className="w-full pl-10 pr-10 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAiKey(!showAiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {hasAiKey && !aiApiKey && (
                    <p className="text-[10px] text-emerald-500/80 mt-1 flex items-center gap-1">
                      <Check className="w-2.5 h-2.5" />
                      Key saved: {keyPreview}
                    </p>
                  )}
                </div>

                {/* Message */}
                {aiKeyMessage && (
                  <div
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold ${
                      aiKeyMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/10 border border-red-500/20 text-red-400'
                    }`}
                  >
                    {aiKeyMessage.type === 'success' ? (
                      <Check className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {aiKeyMessage.text}
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={aiKeyLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 transition-all"
                >
                  {aiKeyLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      {hasAiKey ? 'Update AI Configuration' : 'Save AI Key'}
                    </>
                  )}
                </button>
              </form>
            </section>

            {/* Account Info Footer */}
            {user && (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-600">
                  Logged in as <span className="text-zinc-400 font-semibold">{user.email}</span>
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
