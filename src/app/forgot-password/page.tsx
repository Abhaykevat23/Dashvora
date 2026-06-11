'use client';

import React, { useState } from 'react';
import { BarChart3, Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Something went wrong. Please try again.');
        setIsLoading(false);
        return;
      }

      // If the API returned a direct reset link (dev mode), store it
      if (data.resetUrl) {
        setResetUrl(data.resetUrl);
      }

      setSent(true);
      setIsLoading(false);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 tech-grid opacity-20" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Back to login */}
      <a
        href="/login"
        className="absolute top-6 left-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors z-10"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Login
      </a>

      {/* Logo */}
      <a href="/" className="flex items-center gap-2.5 mb-8 z-10">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">
          Dash<span className="text-cyan-400">vora</span>
        </span>
      </a>

      {/* Card */}
      <div className="w-full max-w-md glass-panel rounded-2xl p-8 border border-white/10 z-10">
        {!sent ? (
          <>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
              <p className="text-sm text-zinc-400">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="reset-email" className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full px-4 py-2.5 bg-zinc-950/60 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                  autoComplete="email"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </>
        ) : (
          /* Success state */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              {resetUrl ? 'Reset Link Ready' : 'Check Your Inbox'}
            </h2>
            {resetUrl ? (
              <>
                <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
                  Email service is not configured yet. Click the button below to reset your password directly (dev mode):
                </p>
                <a
                  href={resetUrl}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 shadow-lg shadow-cyan-500/20 transition-all mb-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  Reset Password
                </a>
                <p className="text-[10px] text-zinc-600 break-all font-mono bg-zinc-900/50 rounded-lg p-2 mb-4">
                  {resetUrl}
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
                If an account exists with <strong className="text-zinc-300">{email}</strong>, we&apos;ve sent a password reset link. It will expire in 1 hour.
              </p>
            )}
            <p className="text-xs text-zinc-600">
              {resetUrl ? 'Need to resend?' : "Didn't receive the email?"}{' '}
              <button
                onClick={() => { setSent(false); setEmail(''); setResetUrl(null); }}
                className="text-cyan-400 hover:text-cyan-300 transition-colors font-semibold"
              >
                Try again
              </button>
            </p>
          </div>
        )}

        {/* Back to login link */}
        <div className="mt-6 text-center">
          <a
            href="/login"
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Remember your password? <span className="text-cyan-400 font-semibold">Sign in</span>
          </a>
        </div>
      </div>
    </div>
  );
}
