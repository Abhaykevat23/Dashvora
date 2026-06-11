'use client';

import React, { useState, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { 
  Save, 
  Share2, 
  Download, 
  Palette, 
  Bell, 
  Layers, 
  Check, 
  Copy,
  TrendingUp,
  FileText,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';

export default function Navbar() {
  const {
    activeDashboard,
    saveDashboard,
    activeTheme,
    setTheme,
    activeWorkspace,
    createNewDashboard
  } = useDashboardStore();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  // Generate share URL only on the client to avoid hydration mismatch with Math.random()
  useEffect(() => {
    setShareUrl(`https://app.dashvora.io/shared/dashboard-${Math.random().toString(36).substring(2, 9)}`);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSave = async () => {
    if (!activeDashboard) {
      triggerToast("No active dashboard generated to save.");
      return;
    }
    try {
      await saveDashboard();
      triggerToast(`"${activeDashboard.dashboardTitle}" successfully saved to database repository!`);
    } catch (err: any) {
      triggerToast(`Failed to save: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`https://app.dashvora.io/shared/dashboard-${Math.random().toString(36).substring(2, 9)}`);
    setCopiedLink(true);
    triggerToast("Dashboard URL link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const sanitizeFilename = (title: string) => title.toLowerCase().replace(/[^a-z0-9]/g, '_');

  const handleExport = async (type: 'pdf' | 'png' | 'csv') => {
    setShowExportMenu(false);
    if (!activeDashboard) {
      triggerToast('No data to export. Please generate a dashboard first.');
      return;
    }

    if (type === 'csv') {
      const headers = ['Widget Title', 'SQL Query', 'Status'];
      const rows = activeDashboard.widgets.map(w => `"${w.title}","${w.query.replace(/"/g, '""')}","Executed Successfully"`);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${sanitizeFilename(activeDashboard.dashboardTitle)}_manifest.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      triggerToast('CSV manifest exported successfully!');
      return;
    }

    // PDF/PNG — use html2canvas + jsPDF for real canvas capture
    setIsExporting(true);
    triggerToast(`Capturing dashboard canvas for ${type.toUpperCase()}...`);

    // Small delay to let the toast render
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const { default: html2canvas } = await import('html2canvas-pro');

      const element = document.getElementById('dashboard-widget-grid') || 
                      document.getElementById('dashboard-canvas');

      if (!element) {
        throw new Error('Could not locate the dashboard canvas element in the DOM.');
      }

      // Capture the dashboard widget grid with higher pixel ratio for retina quality
      const canvas = await html2canvas(element, {
        backgroundColor: '#09090b',
        scale: 2.5,
        useCORS: true,
        logging: false,
        allowTaint: true,
      });

      if (type === 'png') {
        // Download as PNG directly
        const link = document.createElement('a');
        link.download = `${sanitizeFilename(activeDashboard.dashboardTitle)}_dashboard.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast('Dashboard exported as high-resolution PNG!');
      } else if (type === 'pdf') {
        const { default: jsPDF } = await import('jspdf');

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 190; // mm (A4 width minus margins)
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        const pdf = new jsPDF('l', 'mm', 'a4');
        let heightLeft = imgHeight;
        let position = 0;

        // Add first page
        pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
        heightLeft -= pdf.internal.pageSize.getHeight() - 20;

        // Add additional pages if content overflows
        while (heightLeft > 0) {
          position = heightLeft - imgHeight + 20;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, position + 10, imgWidth, imgHeight);
          heightLeft -= pdf.internal.pageSize.getHeight() - 20;
        }

        pdf.save(`${sanitizeFilename(activeDashboard.dashboardTitle)}_dashboard.pdf`);
        triggerToast('Dashboard exported as PDF with embedded vector layers!');
      }
    } catch (err: any) {
      console.error('Export error:', err);
      triggerToast(`Export failed: ${err.message || 'Unknown error during canvas capture.'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="h-16 border-b border-white/5 bg-[#09090b]/40 backdrop-blur-md px-6 flex items-center justify-between z-10 w-full relative">
      {/* Page Title & Scope */}
      <div className="flex items-center gap-3">
        <span className="text-zinc-500 font-medium text-sm">
          {activeWorkspace}
        </span>
        <span className="text-zinc-600">/</span>
        <h1 className="font-bold text-sm text-zinc-100 tracking-wide truncate max-w-[280px]">
          {activeDashboard ? activeDashboard.dashboardTitle : "AI Dashboard Sandbox"}
        </h1>
        {activeDashboard && (
          <button
            onClick={createNewDashboard}
            className="text-[10px] bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/10 rounded px-2 py-1 transition-all cursor-pointer font-semibold"
            title="Start New Dashboard Sandbox"
          >
            New Sandbox
          </button>
        )}
      </div>

      {/* Primary Navigation Actions */}
      <div className="flex items-center gap-4">
        {/* Theme Controller Selector */}
        <div className="flex items-center gap-1.5 border border-white/5 rounded-lg p-1 bg-zinc-950/40">
          <Palette className="w-3.5 h-3.5 text-zinc-500 ml-1.5" />
          <button
            onClick={() => setTheme('slate-obsidian')}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${
              activeTheme === 'slate-obsidian' 
                ? 'bg-zinc-800 text-cyan-400' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Obsidian
          </button>
          <button
            onClick={() => setTheme('cyberpunk-neon')}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${
              activeTheme === 'cyberpunk-neon' 
                ? 'bg-zinc-800 text-fuchsia-400' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Cyberpunk
          </button>
          <button
            onClick={() => setTheme('emerald-glass')}
            className={`text-[10px] font-bold px-2 py-1 rounded transition-all ${
              activeTheme === 'emerald-glass' 
                ? 'bg-zinc-800 text-emerald-400' 
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Emerald
          </button>
        </div>

        {/* Global persistence and share controls */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-4">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!activeDashboard}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-zinc-200 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            title="Save Dashboard"
          >
            <Save className="w-3.5 h-3.5 text-cyan-400" />
            Save
          </button>

          {/* Share Button */}
          <button
            onClick={() => activeDashboard ? setShowShareModal(true) : triggerToast("Generate a dashboard first to share.")}
            disabled={!activeDashboard}
            className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-zinc-200 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            title="Share Dashboard"
          >
            <Share2 className="w-3.5 h-3.5 text-violet-400" />
            Share
          </button>

          {/* Export Menu Anchor */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={!activeDashboard}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-zinc-200 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              Export
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-40 glass-panel border border-white/10 rounded-lg shadow-xl py-1 z-50">
                {isExporting ? (
                  <div className="px-3 py-3 text-xs text-cyan-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Capturing canvas...
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-400" />
                      Export to PDF
                    </button>
                    <button
                      onClick={() => handleExport('png')}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                      Export to PNG
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-white/5 flex items-center gap-2"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      Export SQL Schema
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Global Notifications Alert indicator */}
        <div className="relative cursor-pointer text-zinc-400 hover:text-zinc-200 transition-colors ml-2">
          <Bell className="w-4 h-4" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping" />
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-500 rounded-full" />
        </div>
      </div>

      {/* Floating Status Toast notification */}
      {toastMessage && (
        <div className="absolute top-20 right-6 bg-zinc-950/90 border border-cyan-500/20 text-cyan-200 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xl z-50 flex items-center gap-2 animate-fade-in backdrop-blur-md">
          <TrendingUp className="w-4 h-4 text-cyan-400 animate-bounce" />
          {toastMessage}
        </div>
      )}

      {/* Share Dashboard URL Modal popup */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Share2 className="w-5 h-5 text-violet-400" />
              Distribute AI Dashboard
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Generate a shareable, encrypted link to embed the dashboard or send directly to team collaborators. Anyone with the URL can view interactive aggregations securely.
            </p>

            <div className="bg-zinc-950/80 p-3 rounded-lg border border-white/5 flex items-center justify-between mb-4">
              <span className="text-xs text-zinc-400 font-mono select-all truncate flex-1 pr-4">
                {shareUrl || 'https://app.dashvora.io/shared/dashboard-...'}
              </span>
              <button
                onClick={handleCopyLink}
                className="text-zinc-400 hover:text-cyan-400 p-1 rounded-md bg-white/5 transition-colors"
                title="Copy Link to Clipboard"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
