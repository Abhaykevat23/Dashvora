'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import ChatPanel from '../../components/ChatPanel';
import DashboardCanvas from '../../components/DashboardCanvas';

export default function DashboardPage() {
  // Hydration guard: only render the full app after client-side mount
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);

  if (!hydrated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090b]">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-bounce" />
          <span className="text-zinc-500 text-sm font-mono">Initializing Dashvora...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#09090b] font-sans selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* 1. LEFT PANEL: Controls, Datasets, and DB Connectors */}
      <Sidebar />

      {/* RIGHT CONTAINER: Topbar, Chat & Canvas Layout */}
      <div className="flex flex-col flex-1 h-screen overflow-hidden min-w-0">
        {/* Navbar */}
        <Navbar />

        {/* Split interface for Dialogue and Charts Canvas */}
        <div className="flex flex-1 overflow-hidden min-w-0">
          {/* 2. MIDDLE PANEL: AI Chat Interface & SQL Timelines */}
          <ChatPanel />

          {/* 3. RIGHT PANEL: Draggable grid dashboard canvas */}
          <DashboardCanvas />
        </div>
      </div>
    </div>
  );
}
