'use client';

import React from 'react';
import {
  BarChart3,
  Database,
  Shield,
  Zap,
  Upload,
  MessageSquare,
  Move,
  Filter,
  Share2,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Server,
  GitBranch,
  Bot,
  Workflow,
  Palette,
  PieChart,
} from 'lucide-react';
import LandingNavbar from '../components/LandingNavbar';

// ─────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────
const features = [
  {
    icon: Upload,
    title: 'Multi-Format Ingestion',
    description: 'Upload CSV, XLSX datasets or connect to live databases. Auto-detect schemas, types, and relationships in seconds.',
    gradient: 'from-cyan-500 to-blue-600',
  },
  {
    icon: Bot,
    title: 'AI-Powered Generation',
    description: 'Describe your dashboard in plain English. Our orchestrator understands intent, generates SQL, and compiles visualizations.',
    gradient: 'from-violet-500 to-fuchsia-600',
  },
  {
    icon: Database,
    title: 'SQL Query Engine',
    description: 'Built-in in-memory SQL engine with full SELECT, GROUP BY, ORDER BY, aggregate functions, and global filter injection.',
    gradient: 'from-emerald-500 to-teal-600',
  },
  {
    icon: PieChart,
    title: '7 Chart Types',
    description: 'KPI cards, bar, line, area, pie, donut charts, and data tables — all interactive and drag-repositionable.',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    icon: Move,
    title: 'Drag & Drop Canvas',
    description: '12-column responsive grid. Drag to reposition, resize horizontally, expand, or delete widgets in real time.',
    gradient: 'from-rose-500 to-pink-600',
  },
  {
    icon: Filter,
    title: 'Global Dynamic Filters',
    description: 'Apply region, platform, plan, and date-range filters that cascade across all widgets with live re-execution.',
    gradient: 'from-sky-500 to-indigo-600',
  },
  {
    icon: Share2,
    title: 'Share & Export',
    description: 'Generate shareable links, export to high-res PNG, multi-page PDF, or CSV manifest for stakeholder collaboration.',
    gradient: 'from-green-500 to-lime-600',
  },
  {
    icon: Palette,
    title: 'Premium Themes',
    description: 'Switch between Obsidian, Cyberpunk Neon, and Emerald Glass themes — each with unique accent palettes and glow effects.',
    gradient: 'from-purple-500 to-pink-600',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Built-in SQL injection prevention, read-only query validation, and SSL-secured database connections.',
    gradient: 'from-red-500 to-rose-600',
  },
];

const pipelineSteps = [
  {
    step: '01',
    title: 'Understand Prompt',
    desc: 'Parse natural language and extract analytical intent.',
    icon: MessageSquare,
  },
  {
    step: '02',
    title: 'Analyze Schema',
    desc: 'Map column types, detect measures and dimensions.',
    icon: Server,
  },
  {
    step: '03',
    title: 'Generate Plan',
    desc: 'Design optimal widget layout and chart selection.',
    icon: Workflow,
  },
  {
    step: '04',
    title: 'Generate SQL',
    desc: 'Create safe, optimized queries with aggregations.',
    icon: GitBranch,
  },
  {
    step: '05',
    title: 'Execute Queries',
    desc: 'Run against the in-memory engine or live database.',
    icon: Zap,
  },
  {
    step: '06',
    title: 'Synthesize Insights',
    desc: 'Wrap results in natural-language business analysis.',
    icon: Sparkles,
  },
];

// ─────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background Effects */}
      <div className="absolute inset-0 tech-grid opacity-30" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[800px] h-[800px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-3 h-3 bg-cyan-400 rounded-full blur-sm animate-pulse" style={{ animationDuration: '3s' }} />
      <div className="absolute top-40 right-20 w-2 h-2 bg-violet-400 rounded-full blur-sm animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-40 left-1/4 w-4 h-4 bg-emerald-400/50 rounded-full blur-sm animate-pulse" style={{ animationDuration: '5s' }} />

      <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400 font-medium mb-8 backdrop-blur-sm">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          AI-Powered Business Intelligence Platform
          <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight mb-6">
          Turn Data Into{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Actionable Dashboards
          </span>{' '}
          With AI
        </h1>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Dashvora is the AI-native BI platform. Upload datasets, connect databases, and chat with a
          schema-aware AI that automatically compiles interactive, drag-and-drop dashboard grids —
          no SQL required.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/signup"
            className="group relative px-8 py-3.5 text-base font-bold text-white rounded-xl transition-all duration-300 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-violet-600 group-hover:from-cyan-600 group-hover:to-violet-700 transition-all duration-300" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 blur-xl transition-opacity duration-300" />
            <span className="relative flex items-center gap-2">
              Get Started Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </span>
          </a>
          <a
            href="#features"
            className="px-8 py-3.5 text-base font-semibold text-zinc-300 border border-white/10 rounded-xl hover:bg-white/5 hover:text-white transition-all duration-300"
          >
            View Features
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
          {[
            { value: '10K+', label: 'Active Users' },
            { value: '50K+', label: 'Dashboards Created' },
            { value: '99.9%', label: 'Uptime SLA' },
            { value: '3.2M+', label: 'Queries Executed' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-600">
        <span className="text-xs font-mono">SCROLL</span>
        <div className="w-5 h-8 border border-zinc-700 rounded-full flex justify-center">
          <div className="w-1 h-2 bg-zinc-500 rounded-full mt-1.5 animate-bounce" />
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <div className="absolute inset-0 tech-grid opacity-20" />
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold tracking-widest text-cyan-400 uppercase">Features</span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-4">
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Visualize Data
            </span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            From raw uploads to polished dashboards — Dashvora&apos;s AI orchestrator handles the entire pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative glass-panel rounded-2xl p-6 hover:border-white/15 transition-all duration-500 cursor-default"
            >
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <feature.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{feature.description}</p>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent" />
      <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-xs font-bold tracking-widest text-violet-400 uppercase">Pipeline</span>
          <h2 className="text-3xl md:text-5xl font-bold text-white mt-3 mb-4">
            AI Orchestration{' '}
            <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              in 6 Steps
            </span>
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            From natural language to interactive dashboard — our orchestrator guides every stage with transparency.
          </p>
        </div>

        <div className="relative">
          {/* Connection line (desktop) */}
          <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/30 via-violet-500/30 to-fuchsia-500/30" />

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {pipelineSteps.map((step, idx) => (
              <div key={step.step} className="relative flex flex-col items-center text-center group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center mb-4 group-hover:border-cyan-500/50 group-hover:shadow-lg group-hover:shadow-cyan-500/10 transition-all duration-300">
                  <step.icon className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
                </div>
                <div className="text-xs font-bold text-cyan-400 mb-1.5">{step.step}</div>
                <h4 className="text-sm font-bold text-white mb-1">{step.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-24">
      <div className="absolute inset-0 tech-grid opacity-20" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight">
          Ready to Transform Your{' '}
          <span className="bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">
            Data Workflow
          </span>
          ?
        </h2>
        <p className="text-lg text-zinc-400 max-w-2xl mx-auto mb-10">
          Join thousands of analysts, data scientists, and business leaders who use Dashvora to turn data into decisions.
        </p>
        <a
          href="/signup"
          className="group inline-flex items-center gap-2 px-8 py-4 text-base font-bold text-white rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-300"
        >
          Start Building Free
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </a>
        <p className="text-xs text-zinc-600 mt-4">No credit card required · 14-day free trial · Cancel anytime</p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Dash<span className="text-cyan-400">vora</span></span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-xs">
              AI-powered dashboard generation platform for modern data teams.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Product</h4>
            <ul className="space-y-2.5">
              {['Features', 'Pricing', 'API Docs', 'Changelog'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Company</h4>
            <ul className="space-y-2.5">
              {['About', 'Blog', 'Careers', 'Contact'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {['Privacy', 'Terms', 'Security', 'GDPR'].map((link) => (
                <li key={link}>
                  <a href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">&copy; {new Date().getFullYear()} Dashvora. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4.01c-1 .49-1.98.689-3 .99-1.121-1.265-2.783-1.335-4.379-.737s-2.631 2.063-2.631 3.737v1.001c-3.245.083-6.135-1.395-8-4 0 0-5 10 2 16-1.994.665-2 .998-4 .998 3.007 3.008 6.974 3.741 10.298 2.268 2.066-1.004 3.7-2.967 4.257-5.592a10.18 10.18 0 0 0 .445-3.176c0-.158 1.399-1.667 2-3.499.392-1.012.392-2.438 0-3.499z"/></svg>
            </a>
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48A10.01 10.01 0 0 0 22 12c0-5.523-4.477-10-10-10z"/></svg>
            </a>
            <a href="#" className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────
// Main Landing Page
// ─────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
      <Footer />
    </main>
  );
}
