'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDashboardStore, DBConnector } from '../store/dashboardStore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Database, 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Edit3, 
  Link2, 
  Cpu, 
  Check, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  User, 
  Layers,
  ChevronRight,
  ShieldCheck,
  LogOut,
  HelpCircle,
  Settings,
  Table2,
  ArrowRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid
} from 'lucide-react';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const {
    workspaces,
    activeWorkspace,
    setWorkspace,
    datasets,
    activeDatasetId,
    setActiveDatasetId,
    uploadDataset,
    deleteDataset,
    renameDatasetTable,
    connectors,
    activeConnectorId,
    setActiveConnector,
    addConnector,
    testConnector,
    deleteConnector,
    syncConnectorSchema,
    isProcessing,
    savedDashboards,
    setActiveDashboard,
    deleteDashboard,
    activeDashboard,
    createNewDashboard
  } = useDashboardStore();

  // Delete confirmation state
  const [deletingDatasetId, setDeletingDatasetId] = useState<string | null>(null);
  
  // Auth state
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);

  // Fetch authenticated user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  // Local state for UI toggles
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [editingTableName, setEditingTableName] = useState('');

  // Connector Form fields
  const [connName, setConnName] = useState('');
  const [connType, setConnType] = useState<any>('PostgreSQL');
  const [connHost, setConnHost] = useState('');
  const [connPort, setConnPort] = useState('');
  const [connDB, setConnDB] = useState('');
  const [connUser, setConnUser] = useState('');
  const [connPass, setConnPass] = useState('');
  const [connSSL, setConnSSL] = useState(true);

  // Table import state
  const [importingTable, setImportingTable] = useState<string | null>(null);
  const [showTablesForConnector, setShowTablesForConnector] = useState<string | null>(null);

  // Get the importTableAsDataset function from the store
  const importTableAsDataset = useDashboardStore((state) => (state as any).importTableAsDataset);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle importing a table from a connected DB
  const handleImportTable = async (connectorId: string, tableName: string, columns: string[]) => {
    setImportingTable(tableName);
    try {
      if (importTableAsDataset) {
        await importTableAsDataset(
          connectorId,
          tableName,
          columns.map(name => ({ name, type: 'string' }))
        );
      }
    } catch (err: any) {
      console.error('Failed to import table:', err);
    } finally {
      setImportingTable(null);
      setShowTablesForConnector(null);
    }
  };

  // Handle file selection (CSV or XLSX)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      // Auto-populate dataset name from file name
      const defaultName = file.name.split('.')[0]
        .replace(/[_\-]/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      setUploadName(defaultName);
    }
  };

  // Perform File Upload Parsing (CSV via PapaParse, XLSX via SheetJS)
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadName.trim()) return;

    const isXLSX = uploadFile.name.toLowerCase().endsWith('.xlsx') || uploadFile.name.toLowerCase().endsWith('.xls');

    if (isXLSX) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;
        const success = await uploadDataset(uploadName, buffer, uploadFile.name);
        if (success) {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadName('');
        }
      };
      reader.readAsArrayBuffer(uploadFile);
    } else {
      // CSV: read as text and pass to PapaParse in the store
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        const success = await uploadDataset(uploadName, text, uploadFile.name);
        if (success) {
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadName('');
        }
      };
      reader.readAsText(uploadFile);
    }
  };

  // Test database connection
  const handleTestConnection = async () => {
    setIsTestingConn(true);
    setTestResult(null);
    const mockConn: any = {
      name: connName || 'Test DB',
      type: connType,
      host: connHost,
      port: connPort,
      database: connDB,
      username: connUser,
      password: connPass,
      ssl: connSSL
    };
    const result = await testConnector(mockConn);
    setIsTestingConn(false);
    setTestResult(result.success ? 'success' : 'failed');
  };

  // Save database connection
  const handleSaveConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connName || !connHost || !connDB) return;

    const mockConn: any = {
      name: connName,
      type: connType,
      host: connHost,
      port: connPort || (connType === 'PostgreSQL' ? '5432' : '3306'),
      database: connDB,
      username: connUser,
      password: connPass,
      ssl: connSSL
    };

    const success = await addConnector(mockConn);
    if (success) {
      setShowAddConnector(false);
      // Reset form
      setConnName('');
      setConnHost('');
      setConnPort('');
      setConnDB('');
      setConnUser('');
      setConnPass('');
      setTestResult(null);
    } else {
      // Show failure message
      setTestResult('failed');
    }
  };

  // Start editing table name
  const startRenameDataset = (id: string, currentTable: string) => {
    setEditingDatasetId(id);
    setEditingTableName(currentTable);
  };

  const submitRenameDataset = (id: string) => {
    if (editingTableName.trim()) {
      renameDatasetTable(id, editingTableName.trim());
    }
    setEditingDatasetId(null);
  };

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-80'} h-screen border-r border-white/5 bg-[#09090b]/80 backdrop-blur-md flex flex-col z-20 transition-all duration-300 ease-in-out`}>
      {/* Brand Header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-3 min-h-[73px]">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
          <Cpu className="w-5 h-5 text-white animate-pulse" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0 flex items-center justify-between">
            <div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent block">
                Dashvora
              </span>
              <span className="text-[10px] block font-mono text-cyan-400/80 font-bold tracking-widest uppercase">
                AI Analytics Engine
              </span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Scrollable controls */}
      <div className={`flex-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-4'} space-y-6`}>
        {/* Collapsed icon-only shortcuts */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              onClick={() => setShowUploadModal(true)}
              className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
              title="Upload Dataset"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAddConnector(true)}
              className="p-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
              title="Add DB Connection"
            >
              <Database className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            {/* Workspace Switcher */}
            <div>
              <div className="flex items-center justify-between mb-2 px-2">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Workspace
                </label>
                <div className="group relative">
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 cursor-help transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 bg-zinc-900 border border-white/10 rounded-lg p-2.5 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      Switch between different analytics workspaces to organize dashboards, datasets, and database connections by project or team.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative">
                <select
                  value={activeWorkspace}
                  onChange={(e) => setWorkspace(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
                >
                  {workspaces.map((ws) => (
                    <option key={ws} value={ws} className="bg-zinc-950 text-zinc-200">
                      {ws}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-3 pointer-events-none text-zinc-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Dataset selector section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Active Datasets
                </span>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="p-1 rounded-md bg-white/5 text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
                  title="Upload CSV / JSON Dataset"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {datasets.map((ds) => {
                  const isActive = ds.id === activeDatasetId;
                  const isEditing = ds.id === editingDatasetId;

                  return (
                    <div
                      key={ds.id}
                      className={`group relative rounded-lg p-2.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-cyan-950/40 to-violet-950/20 border border-cyan-500/20'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                      onClick={() => !isEditing && setActiveDatasetId(ds.id)}
                    >
                      <div className="flex items-start gap-2.5">
                        <FileSpreadsheet className={`w-5 h-5 mt-0.5 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingTableName}
                                onChange={(e) => setEditingTableName(e.target.value)}
                                onBlur={() => submitRenameDataset(ds.id)}
                                onKeyDown={(e) => e.key === 'Enter' && submitRenameDataset(ds.id)}
                                autoFocus
                                className="bg-zinc-900 border border-cyan-500 rounded px-1 text-xs text-zinc-200 focus:outline-none w-28"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className={`font-semibold text-sm truncate block ${isActive ? 'text-cyan-200' : 'text-zinc-300'}`}>
                                {ds.name}
                              </span>
                            )}
                            <div className="hidden group-hover:flex items-center gap-1.5 ml-2" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => startRenameDataset(ds.id, ds.tableName)}
                                className="text-zinc-500 hover:text-cyan-400 p-0.5"
                                title="Rename SQL Table"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingDatasetId(ds.id);
                                }}
                                className="text-zinc-500 hover:text-red-400 p-0.5"
                                title="Delete Dataset"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono block text-zinc-500 mt-0.5">
                            table: <strong className="text-zinc-400 font-normal">{ds.tableName}</strong> &bull; {ds.rowCount} rows
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Saved Dashboards Section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Saved Dashboards
                </span>
                <button
                  onClick={createNewDashboard}
                  className="p-1 rounded-md bg-white/5 text-zinc-400 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
                  title="Create New Dashboard Sandbox"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {savedDashboards && savedDashboards.filter(d => d.workspace === activeWorkspace).length > 0 ? (
                <div className="space-y-1">
                  {savedDashboards
                    .filter(d => d.workspace === activeWorkspace)
                    .map((d) => {
                      const isActive = activeDashboard?.dashboardTitle === d.title;

                      return (
                        <div
                          key={d.id}
                          className={`group relative rounded-lg p-2.5 transition-all cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-cyan-950/40 to-violet-950/20 border border-cyan-500/20'
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                          onClick={() => {
                            setActiveDashboard(d.config);
                            setActiveDatasetId(d.datasetId);
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <LayoutGrid className={`w-5 h-5 mt-0.5 ${isActive ? 'text-cyan-400' : 'text-zinc-500'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className={`font-semibold text-xs truncate block ${isActive ? 'text-cyan-200' : 'text-zinc-300'}`}>
                                  {d.title}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteDashboard(d.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-0.5"
                                  title="Delete Saved Dashboard"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className="text-[10px] font-mono block text-zinc-500 mt-0.5">
                                dataset: <strong className="text-zinc-400 font-normal">{datasets.find(ds => ds.id === d.datasetId)?.name || 'Unknown'}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="text-center py-4 border border-dashed border-white/5 rounded-lg">
                  <span className="text-zinc-600 text-xs font-semibold">No saved dashboards</span>
                </div>
              )}
            </div>

            {/* Secure Database Connectors section */}
            <div>
              <div className="flex items-center justify-between mb-3 px-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  Database Connections
                </span>
                <button
                  onClick={() => setShowAddConnector(true)}
                  className="p-1 rounded-md bg-white/5 text-zinc-400 hover:bg-violet-500/10 hover:text-violet-400 transition-colors"
                  title="Add DB Connection"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-2">
                {connectors.map((c) => {
                  const isActive = c.id === activeConnectorId;
                  return (
                    <div
                      key={c.id}
                      className={`glass-panel rounded-lg p-3 hover:border-white/10 transition-colors relative group cursor-pointer ${
                        isActive ? 'ring-1 ring-violet-500/30 border-violet-500/20' : ''
                      }`}
                      onClick={() => {
                        if (c.status === 'connected') {
                          setActiveConnector(
                            isActive ? null : c.id
                          );
                        }
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <Database className={`w-5 h-5 mt-0.5 ${isActive ? 'text-violet-300' : 'text-violet-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-zinc-200 truncate block">
                              {c.name}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConnector(c.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity p-0.5"
                              title="Disconnect Database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 block mt-0.5">
                            {c.type.toLowerCase()}://{c.host.substring(0, 15)}...
                          </span>

                          <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                              {c.status === 'connected' ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest font-bold">
                                    {isActive ? 'Active' : 'Connected'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                                    Disconnected
                                  </span>
                                </>
                              )}
                              {c.schema && (
                                <span className="text-[9px] text-zinc-600 ml-1">
                                  {Object.keys(c.schema).length} tables
                                </span>
                              )}
                            </div>
                            {c.status === 'connected' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  syncConnectorSchema(c.id);
                                }}
                                className="text-[9px] bg-white/5 hover:bg-violet-500/15 hover:text-violet-300 border border-white/10 text-zinc-400 px-2 py-0.5 rounded transition-all"
                              >
                                Sync Schema
                              </button>
                            )}
                          </div>

                          {c.status === 'connected' && c.schema && Object.keys(c.schema).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowTablesForConnector(
                                    showTablesForConnector === c.id ? null : c.id
                                  );
                                }}
                                className="w-full flex items-center justify-between text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Table2 className="w-3 h-3" />
                                  <span>Available Tables</span>
                                </div>
                                <ChevronDown
                                  className={`w-3 h-3 transition-transform ${
                                    showTablesForConnector === c.id ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {showTablesForConnector === c.id && (
                                <div className="mt-1 space-y-0.5">
                                  {Object.entries(c.schema).map(([tableName, columns]) => (
                                    <div
                                      key={tableName}
                                      className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Table2 className="w-3 h-3 text-violet-400 shrink-0" />
                                        <span className="text-[11px] text-zinc-400 truncate font-mono">
                                          {tableName}
                                        </span>
                                        <span className="text-[9px] text-zinc-600">
                                          ({columns.length} cols)
                                        </span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleImportTable(c.id, tableName, columns);
                                        }}
                                        disabled={importingTable === tableName}
                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[9px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded transition-all disabled:opacity-50"
                                        title="Import this table as a dataset"
                                      >
                                        {importingTable === tableName ? (
                                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        ) : (
                                          <>
                                            <ArrowRight className="w-2.5 h-2.5" />
                                            Import
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Dataset Confirmation Modal */}
      {deletingDatasetId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-xl p-6 border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Delete Dataset
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              Are you sure you want to delete <strong className="text-zinc-200">{datasets.find(d => d.id === deletingDatasetId)?.name || 'this dataset'}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeletingDatasetId(null)}
                className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteDataset(deletingDatasetId);
                  setDeletingDatasetId(null);
                }}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload CSV Modal overlay */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-white/10 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-400" />
              Upload Structured Dataset
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Upload a CSV or Excel (.xlsx) file. The platform uses <strong className="text-cyan-300">PapaParse</strong> for CSV and <strong className="text-cyan-300">SheetJS</strong> for Excel files &mdash; automatically parsing columns, detecting numerical/categorical data types, and registering the schema securely.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Dataset Visual Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Q1 Revenue Projections"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Select File (.csv)</label>
                <input
                  type="file"
                  required
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-white/15 rounded-lg p-6 text-center cursor-pointer hover:border-cyan-500/50 hover:bg-white/5 transition-all"
                >
                  <FileSpreadsheet className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                  {uploadFile ? (
                    <span className="text-sm font-semibold text-cyan-300 truncate block">
                      {uploadFile.name}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-zinc-300 block">Click to select CSV or Excel file</span>
                      <span className="text-[10px] text-zinc-500">Supports .csv, .xlsx, .xls (max 10MB)</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!uploadFile || !uploadName.trim()}
                  className="bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-black px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
                >
                  Import Dataset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Database Connectors setup modal */}
      {showAddConnector && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-xl p-6 border border-white/10 shadow-2xl relative my-8">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Database className="w-5 h-5 text-violet-400" />
              Establish Secure DB Connector
            </h3>
            <p className="text-xs text-zinc-400 mb-4">
              Store credentials with production-grade encryption keys. Dashvora uses SSL Tunnel encryption to query database schemas, keeping data fully read-only.
            </p>

            <form onSubmit={handleSaveConnector} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Connector Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sales Replica"
                    value={connName}
                    onChange={(e) => setConnName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Database Type</label>
                  <select
                    value={connType}
                    onChange={(e) => setConnType(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                  >
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="Snowflake">Snowflake</option>
                    <option value="BigQuery">Google BigQuery</option>
                    <option value="MongoDB">MongoDB</option>
                    <option value="SQL Server">Microsoft SQL Server</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 block mb-1">Host/Endpoint</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. database-1.cluster.rds.amazonaws.com"
                    value={connHost}
                    onChange={(e) => setConnHost(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Port</label>
                  <input
                    type="text"
                    placeholder={connType === 'PostgreSQL' ? '5432' : '3306'}
                    value={connPort}
                    onChange={(e) => setConnPort(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Database Name</label>
                  <input
                    type="text"
                    required
                    placeholder="sales_records"
                    value={connDB}
                    onChange={(e) => setConnDB(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Username</label>
                  <input
                    type="text"
                    placeholder="read_user"
                    value={connUser}
                    onChange={(e) => setConnUser(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Secret Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••••"
                  value={connPass}
                  onChange={(e) => setConnPass(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-zinc-950/60 rounded-lg border border-white/5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">Row-Level Security / TLS</span>
                    <span className="text-[10px] text-zinc-500">Enable SSL connection mode</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={connSSL}
                  onChange={(e) => setConnSSL(e.target.checked)}
                  className="w-4 h-4 rounded text-violet-500 bg-zinc-950 border-white/10 focus:ring-0 cursor-pointer"
                />
              </div>

              {testResult === 'success' && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-lg p-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Database schema handshake successful! Enriched metadata tunnels verified.
                </div>
              )}

              {testResult === 'failed' && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Handshake failed. Host unreachable or missing read privileges on the schema.
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn || !connHost || !connDB}
                  className="border border-white/10 text-zinc-300 hover:bg-white/5 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5"
                >
                  {isTestingConn && <Loader2 className="w-4 h-4 animate-spin text-violet-400" />}
                  Test Connection
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddConnector(false);
                      setTestResult(null);
                    }}
                    className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-white/5 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={!connName || !connHost || !connDB}
                    className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-violet-500/20 transition-all"
                  >
                    Save Connector
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User profile footer */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => setProfileExpanded(!profileExpanded)}
          className="w-full flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {user ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <span className="font-semibold text-sm text-zinc-200 block truncate">
                  {user?.name || 'Loading...'}
                </span>
                <span className="text-[10px] text-zinc-500 block truncate">
                  {user?.email || ''}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-zinc-500 transition-transform duration-300 ${
                  profileExpanded ? 'rotate-180' : ''
                }`}
              />
            </>
          )}
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            profileExpanded && !collapsed ? 'max-h-48 opacity-100 mt-3' : 'max-h-0 opacity-0'
          }`}
        >
          <Link
            href="/dashboard/settings"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-cyan-400 bg-white/5 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/20 transition-all"
            onClick={() => setProfileExpanded(false)}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </aside>
  );
}