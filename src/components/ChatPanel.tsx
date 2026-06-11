'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDashboardStore, ChatMessage } from '../store/dashboardStore';
import { 
  Send, 
  Sparkles, 
  Trash2, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  Check, 
  AlertCircle,
  Copy,
  Info,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';

export default function ChatPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const {
    chatHistory,
    sendChatMessage,
    clearChatHistory,
    suggestedKPIs,
    isProcessing,
    activeDatasetId,
    datasets,
    aiConfig
  } = useDashboardStore();

  const hasAiKey = !!aiConfig.apiKey;
  const aiProviderLabel = aiConfig.provider === 'anthropic' ? 'Claude' 
    : aiConfig.provider === 'groq' ? 'Groq'
    : aiConfig.provider === 'together' ? 'Together'
    : 'OpenAI';

  const [input, setInput] = useState('');
  const [openSqlId, setOpenSqlId] = useState<string | null>(null);
  const [openStepsId, setOpenStepsId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const activeDataset = datasets.find(d => d.id === activeDatasetId);

  // Auto Scroll to bottom on new chat message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isProcessing]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    const text = input.trim();
    setInput('');
    await sendChatMessage(text);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isProcessing) return;
    await sendChatMessage(suggestion);
  };

  const copySqlToClipboard = (sql: string) => {
    navigator.clipboard.writeText(sql);
    alert("SQL query successfully copied! Verify in your safe database console.");
  };

  return (
    <div className={`${collapsed ? 'w-14' : 'w-96'} border-r border-white/5 bg-[#09090b]/65 backdrop-blur-lg flex flex-col h-[calc(100vh-4rem)] z-10 transition-all duration-300 ease-in-out`}>
      {/* Collapse toggle header */}
      <div className={`${collapsed ? 'flex flex-col items-center pt-4 px-2' : 'hidden'}`}>
        <button
          onClick={() => setCollapsed(false)}
          className="p-2 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] transition-all"
          title="Expand chat panel"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <span className="text-[8px] text-zinc-600 font-semibold uppercase tracking-wider mt-2 [writing-mode:vertical-lr] select-none">
          Chat
        </span>
      </div>
      {/* Active Dataset Banner Indicator */}
      {activeDataset && !collapsed && (
        <div className="px-4 py-3 bg-gradient-to-r from-cyan-950/20 to-zinc-950/60 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-400 block font-semibold uppercase tracking-wider">Active Schema Context</span>
              <span className="text-xs text-zinc-300 font-mono truncate block">
                {activeDataset.tableName} ({activeDataset.rowCount} records)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className={`${collapsed ? 'hidden' : 'flex-1 overflow-y-auto p-4 space-y-4'}`}>
        {chatHistory.map((msg) => {
          const isUser = msg.sender === 'user';
          
          return (
            <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase">
                  {isUser ? 'You' : 'Dashvora AI'}
                </span>
                <span className="text-[9px] text-zinc-600 font-mono">
                  {msg.timestamp}
                </span>
              </div>

              {/* Message speech bubble */}
              <div className={`p-3.5 rounded-xl max-w-[90%] text-sm leading-relaxed ${
                isUser
                  ? 'bg-gradient-to-tr from-cyan-500/10 to-cyan-500/20 text-cyan-100 rounded-tr-none border border-cyan-500/25'
                  : 'bg-zinc-900/60 text-zinc-200 border border-white/5 rounded-tl-none glass-panel'
              }`}>
                {/* Text render */}
                <div 
                  className="whitespace-pre-line prose prose-invert max-w-none text-zinc-200"
                  dangerouslySetInnerHTML={{ 
                    __html: msg.text
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')
                      .replace(/`([^`]+)`/g, '<code class="bg-zinc-950/50 px-1 py-0.5 rounded text-violet-400 text-xs font-mono font-normal">$1</code>')
                  }}
                />

                {/* Show Step-by-Step AI execution progress if loading/done */}
                {msg.steps && (
                  <div className="mt-3.5 border-t border-white/5 pt-3">
                    <button
                      onClick={() => setOpenStepsId(openStepsId === msg.id ? null : msg.id)}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 uppercase tracking-wider focus:outline-none"
                    >
                      {openStepsId === msg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {msg.status === 'thinking' ? 'Running Orchestration Steps...' : 'View Reasoning Steps Log'}
                    </button>

                    {(openStepsId === msg.id || msg.status === 'thinking') && (
                      <div className="mt-2.5 pl-2 space-y-2.5 border-l border-white/5 relative">
                        {msg.steps.map((step, idx) => (
                          <div key={idx} className="relative pl-4 flex flex-col">
                            {/* Bullet icon representing step status */}
                            <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${
                              step.status === 'completed' 
                                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                                : step.status === 'running'
                                  ? 'bg-cyan-500 animate-thinking shadow-[0_0_8px_rgba(6,182,212,0.5)]'
                                  : step.status === 'failed'
                                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                                    : 'bg-zinc-700'
                            }`} />
                            
                            <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                              step.status === 'completed' ? 'text-zinc-200' : step.status === 'running' ? 'text-cyan-400' : 'text-zinc-500'
                            }`}>
                              {step.name}
                              {step.status === 'running' && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                            </span>
                            
                            {step.details && (
                              <span className="text-[10px] text-zinc-400 mt-0.5 leading-normal font-mono bg-zinc-950/40 p-1 rounded border border-white/5">
                                {step.details}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Collapsible Collated SQL Queries block */}
                {msg.generatedSql && msg.generatedSql.length > 0 && (
                  <div className="mt-3.5 border-t border-white/5 pt-3">
                    <button
                      onClick={() => setOpenSqlId(openSqlId === msg.id ? null : msg.id)}
                      className="text-[10px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-1 uppercase tracking-wider focus:outline-none"
                    >
                      {openSqlId === msg.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      Show SQL Command Manifest ({msg.generatedSql.length})
                    </button>

                    {openSqlId === msg.id && (
                      <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto">
                        {msg.generatedSql.map((sql, idx) => (
                          <div key={idx} className="bg-zinc-950/80 rounded-lg p-2.5 border border-white/5 relative group">
                            <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
                              <span className="text-[9px] font-bold text-zinc-500 font-mono uppercase tracking-wider flex items-center gap-1">
                                <Terminal className="w-3 h-3 text-violet-400" />
                                query_{idx+1}.sql (Safe SELECT)
                              </span>
                              <button
                                onClick={() => copySqlToClipboard(sql)}
                                className="text-zinc-500 hover:text-cyan-400 p-0.5"
                                title="Copy SQL Query"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            <pre className="text-[10px] text-violet-300 font-mono whitespace-pre-wrap select-all leading-normal">
                              {sql}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Suggested Prompt Recommendations Chips */}
      {suggestedKPIs.length > 0 && !isProcessing && !collapsed && (
        <div className="px-4 py-2 border-t border-white/5 space-y-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block px-1">
            Suggested Prompts
          </span>
          <div                    className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pb-1">
              {/* AI Provider Status Badge */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                hasAiKey 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${hasAiKey ? 'bg-emerald-400' : 'bg-amber-400'} shadow-sm`} />
                {hasAiKey ? `${aiProviderLabel} AI` : 'Local AI'}
              </div>
            {suggestedKPIs.map((kpi, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(kpi)}
                className="text-[10px] text-zinc-300 hover:text-cyan-400 hover:border-cyan-500/30 bg-white/5 hover:bg-cyan-950/20 border border-white/5 rounded-full px-2.5 py-1 text-left transition-all font-semibold select-none cursor-pointer leading-tight truncate max-w-full"
              >
                {kpi}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapse toggle for expanded state */}
      <div className={`${collapsed ? 'hidden' : 'flex'} items-center justify-end px-3 pt-1`}>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] transition-all"
          title="Collapse chat panel"
        >
          <PanelRightClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input Chat bar Form */}
      <div className={`${collapsed ? 'hidden' : ''} p-4 border-t border-white/5`}>
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            required
            disabled={isProcessing}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isProcessing 
                ? "AI Orchestrator executing queries..." 
                : "Ask AI to generate charts or metrics..."
            }
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-3.5 pr-10 py-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400 mr-2" />
            ) : (
              <>
                {chatHistory.length > 1 && (
                  <button
                    type="button"
                    onClick={clearChatHistory}
                    className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-white/5 transition-all"
                    title="Clear Conversation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-1.5 bg-gradient-to-tr from-cyan-500 to-violet-600 hover:from-cyan-600 hover:to-violet-700 disabled:opacity-30 text-white rounded-lg transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
