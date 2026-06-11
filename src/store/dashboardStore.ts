import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { defaultDatasets, Dataset, DatasetColumn } from '../lib/mockData';
import { SQLEngine } from '../lib/sqlEngine';
import { AIOrchestrator, WidgetConfig, DashboardConfig, OrchestratorStep } from '../lib/aiOrchestrator';
import { QueryResultData, DbApiResponse } from '../lib/database-types';
import { indexedDBStorage } from '../lib/storage';

// Define structures for Database Connectors
export interface DBConnector {
  id: string;
  name: string;
  type: 'PostgreSQL' | 'MySQL' | 'Snowflake' | 'BigQuery' | 'MongoDB' | 'SQL Server' | 'Redshift' | 'Oracle';
  host: string;
  port: string;
  database: string;
  username: string;
  ssl: boolean;
  status: 'connected' | 'disconnected';
  lastSyncedAt?: string;
  schema?: Record<string, string[]>; // table -> columns mapping
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  status?: 'thinking' | 'done' | 'error';
  steps?: OrchestratorStep[];
  generatedSql?: string[];
  dashboardGenerated?: boolean;
}

export interface DashboardStore {
  // Workspaces
  workspaces: string[];
  activeWorkspace: string;
  setWorkspace: (ws: string) => void;

  // Datasets
  datasets: Dataset[];
  activeDatasetId: string;
  setActiveDatasetId: (id: string) => void;
  uploadDataset: (name: string, fileContent: string | ArrayBuffer, fileName: string) => Promise<boolean>;
  deleteDataset: (id: string) => void;
  renameDatasetTable: (id: string, newTableName: string) => void;

  // Connectors
  connectors: DBConnector[];
  activeConnectorId: string | null;
  setActiveConnector: (id: string | null) => void;
  addConnector: (connector: Omit<DBConnector, 'id' | 'status'>) => Promise<boolean>;
  testConnector: (connector: Omit<DBConnector, 'id' | 'status'>) => Promise<{ success: boolean; error?: string }>;
  deleteConnector: (id: string) => void;
  syncConnectorSchema: (id: string) => Promise<void>;
  executeConnectorQuery: (sql: string) => Promise<QueryResultData | null>;
  executeServerDatasetQuery: (sql: string, tableName: string) => Promise<QueryResultData | null>;
  getActiveConnector: () => DBConnector | undefined;

  // Active Dashboard
  activeDashboard: DashboardConfig | null;
  setActiveDashboard: (dash: DashboardConfig | null) => void;
  updateWidgetPosition: (id: string, x: number, y: number, w: number, h: number) => void;
  deleteWidget: (id: string) => void;
  addWidget: (widget: Omit<WidgetConfig, 'id' | 'x' | 'y'>) => void;
  saveDashboard: () => Promise<void>;
  deleteDashboard: (id: string) => Promise<void>;
  fetchSavedDashboards: () => Promise<void>;
  createNewDashboard: () => void;
  savedDashboards: { id: string; workspace: string; title: string; datasetId: string; config: DashboardConfig }[];
  importTableAsDataset: (connectorId: string, tableName: string, schema: { name: string; type: string }[]) => Promise<Dataset>;

  // Chat Interface
  chatHistory: ChatMessage[];
  sendChatMessage: (text: string) => Promise<void>;
  clearChatHistory: () => void;
  suggestedKPIs: string[];

  // Filters
  globalFilters: {
    dateFrom: string;
    dateTo: string;
    region: string;
    platform: string;
    plan_type: string;
  };
  setGlobalFilter: (key: string, value: string) => void;
  clearGlobalFilters: () => void;

  // Theme
  activeTheme: 'slate-obsidian' | 'cyberpunk-neon' | 'emerald-glass' | 'light-clean';
  setTheme: (theme: 'slate-obsidian' | 'cyberpunk-neon' | 'emerald-glass' | 'light-clean') => void;

  // System status
  sqlEngine: SQLEngine;
  aiOrchestrator: AIOrchestrator;
  isProcessing: boolean;

  // Reinitialize engines after hydration
  reinitializeEngines: () => void;

  // Restore saved connectors from server (auto-reconnect)
  restoreSavedConnectors: () => Promise<void>;

  // AI Configuration (from user profile settings)
  aiConfig: {
    apiKey: string;
    provider: string;
    model: string;
    endpoint: string;
  };
  fetchAiConfig: () => Promise<void>;
  setAiConfig: (config: Partial<DashboardStore['aiConfig']>) => void;
}

/**
 * Helper: call the server-side DB API endpoint.
 * Defined outside the store to avoid adding it to the store interface.
 */
async function callDbApi(body: any): Promise<DbApiResponse> {
  try {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({
      success: false,
      error: `Server returned ${res.status}: invalid response`,
    }));
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

// Instantiate internal engines with default datasets
const createEngine = () => new SQLEngine(defaultDatasets);
const createOrchestrator = (engine: SQLEngine) => new AIOrchestrator(engine);

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => {
      const engine = createEngine();
      const orchestrator = createOrchestrator(engine);

      return {
        // System status
        sqlEngine: engine,
        aiOrchestrator: orchestrator,

        // AI Configuration — loaded from user profile settings on page load
        aiConfig: {
          apiKey: '',
          provider: '',
          model: '',
          endpoint: '',
        },

        fetchAiConfig: async () => {
          try {
            const res = await fetch('/api/auth/ai-key');
            const data = await res.json();
            if (data.success && data.config) {
              set(state => ({
                aiConfig: {
                  apiKey: data.config.fullKey || '',
                  provider: data.config.provider || '',
                  model: data.config.model || '',
                  endpoint: data.config.endpoint || '',
                }
              }));
            }
          } catch {
            // Not authenticated or server unavailable — use defaults
          }
        },

        setAiConfig: (config) => {
          set(state => ({ aiConfig: { ...state.aiConfig, ...config } }));
        },

        reinitializeEngines: () => {
          const newEngine = createEngine();
          const newOrchestrator = createOrchestrator(newEngine);
          // Re-register ALL persisted datasets into the SQL engine.
          const datasets = get().datasets;
          datasets.forEach(ds => {
            if (ds.rows && ds.rows.length > 0) {
              newEngine.registerDataset(ds);
            } else if (ds.sourceType !== 'connection' && ds.sourceType !== 'server_upload') {
              newEngine.registerDataset(ds);
            }
          });
          set({ sqlEngine: newEngine, aiOrchestrator: newOrchestrator });

          // Fetch AI config on rehydration
          get().fetchAiConfig();
        },

        restoreSavedConnectors: async () => {
          try {
            const res = await fetch('/api/connectors');
            const data = await res.json();
            if (data.success && data.connectors && data.connectors.length > 0) {
              const savedConnectors = data.connectors;
              
              // Reconnect each saved connector
              for (const saved of savedConnectors) {
                const dbConfig = {
                  host: saved.host,
                  port: saved.port,
                  database: saved.database,
                  username: saved.username,
                  password: saved.password || '',
                  ssl: saved.ssl,
                };
                
                try {
                  const result = await callDbApi({
                    action: 'connect',
                    config: dbConfig,
                    type: saved.type,
                  });

                  if (result.success) {
                    const restoredConn: DBConnector = {
                      id: saved.id,
                      name: saved.name,
                      type: saved.type || 'PostgreSQL',
                      host: saved.host,
                      port: saved.port,
                      database: saved.database,
                      username: saved.username,
                      ssl: saved.ssl,
                      status: 'connected',
                      lastSyncedAt: result.lastSyncedAt,
                      schema: result.schema,
                    };
                    
                    set(state => ({
                      connectors: [...state.connectors.filter(c => c.id !== saved.id), restoredConn],
                    }));
                  }
                } catch (err: any) {
                  console.warn(`[DashboardStore] Auto-reconnect failed for ${saved.name}:`, err.message);
                }
              }
            }
          } catch {
            // User may not be authenticated — skip
          }
        },

        // Workspaces
        workspaces: ['Personal Dev Sandbox', 'Marketing Core Analytics', 'Enterprise Finance Ops'],
        activeWorkspace: 'Personal Dev Sandbox',
        setWorkspace: (ws) => set({ activeWorkspace: ws, activeDashboard: null, chatHistory: [] }),

        // Datasets — start empty, user adds via upload or DB connection
        datasets: defaultDatasets,
        activeDatasetId: '',
        setActiveDatasetId: (id) => {
          set({ activeDatasetId: id });
          // Pull simple suggestions based on active table
          const dataset = get().datasets.find(d => d.id === id);
          if (dataset) {
            if (dataset.tableName === 'sales_performance') {
              set({ suggestedKPIs: ['Show total revenue and profits', 'Sales breakdown by region in a pie chart', 'Show sales and profit daily trend', 'Table of top performing products'] });
            } else if (dataset.tableName === 'marketing_campaigns') {
              set({ suggestedKPIs: ['Analyze ad platform spend allocation', 'Show conversions vs spend over time', 'Generate campaign efficiency table', 'Show overall CTR and clicks'] });
            } else if (dataset.tableName === 'saas_analytics') {
              set({ suggestedKPIs: ['Show active users by plan as a bar chart', 'MRR growth and Active users trend', 'Blended CAC and total signups', 'SaaS plan metrics comparison table'] });
            } else {
              set({ suggestedKPIs: [`Generate summary for ${dataset.name}`, `Analyze metrics in ${dataset.tableName}`, `Daily trends inside ${dataset.name}`] });
            }
          }
        },

        // Connectors
        connectors: [],
        activeConnectorId: null,
        setActiveConnector: (id) => set({ activeConnectorId: id }),

        addConnector: async (conn) => {
          const id = `conn_${Math.random().toString(36).substring(2, 9)}`;
          
          let status: 'connected' | 'disconnected' = 'disconnected';
          let schema: Record<string, string[]> | undefined;
          let lastSyncedAt: string | undefined;

          // Build config with password from the form
          const password = (conn as any).password || '';
          const dbConfig = {
            host: conn.host,
            port: conn.port,
            database: conn.database,
            username: conn.username,
            password,
            ssl: conn.ssl,
          };

          try {
            const apiResult = await callDbApi({
              action: 'connect',
              config: dbConfig,
            });

            if (apiResult.success) {
              status = 'connected';
              lastSyncedAt = apiResult.lastSyncedAt;
              schema = apiResult.schema;
            }
          } catch (err: any) {
            console.warn('[DashboardStore] Connection failed:', err.message);
          }

          const newConn: DBConnector = {
            name: conn.name,
            type: conn.type,
            host: conn.host,
            port: conn.port,
            database: conn.database,
            username: conn.username,
            ssl: conn.ssl,
            id,
            status,
            lastSyncedAt,
            schema,
          };

          set(state => ({ connectors: [...state.connectors, newConn] }));

          // Save credentials encrypted in the database for auto-reconnect
          if (status === 'connected' && password) {
            try {
              await fetch('/api/connectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: conn.name,
                  type: conn.type,
                  host: conn.host,
                  port: conn.port,
                  database: conn.database,
                  username: conn.username,
                  password: password,
                  ssl: conn.ssl,
                }),
              });
            } catch (err: any) {
              console.warn('[DashboardStore] Failed to save connector credentials:', err.message);
            }
          }

          return status === 'connected';
        },
        testConnector: async (conn) => {
          const dbConfig = {
            host: conn.host,
            port: conn.port,
            database: conn.database,
            username: conn.username,
            password: (conn as any).password || '',
            ssl: conn.ssl,
          };

          const result = await callDbApi({
            action: 'test',
            config: dbConfig,
          });

          return { success: result.success, error: result.error };
        },
        deleteConnector: async (id) => {
          // Disconnect from database if connected
          const connector = get().connectors.find(c => c.id === id);
          if (connector && connector.status === 'connected') {
            const connectionId = `${connector.host}:${connector.port}/${connector.database}`;
            await callDbApi({
              action: 'disconnect',
              connectionId,
            });
          }

          // Clear active connector if deleting the active one
          if (get().activeConnectorId === id) {
            set({ activeConnectorId: null });
          }

          set(state => ({ connectors: state.connectors.filter(c => c.id !== id) }));

          // Also delete from server-side saved credentials
          try {
            await fetch(`/api/connectors?id=${id}`, {
              method: 'DELETE',
            });
          } catch {
            // non-critical
          }
        },
        syncConnectorSchema: async (id) => {
          const connector = get().connectors.find(c => c.id === id);
          if (!connector || connector.status !== 'connected') return;

          const connectionId = `${connector.host}:${connector.port}/${connector.database}`;

          try {
            const apiResult = await callDbApi({
              action: 'schema',
              connectionId,
            });

            if (apiResult.success && apiResult.schema) {
              set(state => ({
                connectors: state.connectors.map(c => {
                  if (c.id === id) {
                    return {
                      ...c,
                      schema: apiResult.schema,
                      lastSyncedAt: apiResult.lastSyncedAt,
                    };
                  }
                  return c;
                })
              }));
            }
          } catch (err: any) {
            console.error('[DashboardStore] Schema sync failed:', err.message);
          }
        },
        executeConnectorQuery: async (sql: string) => {
          const connectorId = get().activeConnectorId;
          if (!connectorId) return null;

          const connector = get().connectors.find(c => c.id === connectorId);
          if (!connector || connector.status !== 'connected') return null;

          const connectionId = `${connector.host}:${connector.port}/${connector.database}`;
          
          try {
            const apiResult = await callDbApi({
              action: 'query',
              connectionId,
              sql,
            });

            if (apiResult.success && apiResult.data) {
              return apiResult.data as QueryResultData;
            }
            return null;
          } catch (err: any) {
            console.error('[DashboardStore] Connector query failed:', err.message);
            return null;
          }
        },
        getActiveConnector: () => {
          const { connectors, activeConnectorId } = get();
          if (!activeConnectorId) return undefined;
          return connectors.find(c => c.id === activeConnectorId);
        },

        executeServerDatasetQuery: async (sql, tableName) => {
          try {
            const res = await fetch('/api/datasets/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tableName, sql }),
            });
            const data = await res.json();
            if (data.success && data.data) {
              return data.data as QueryResultData;
            }
            return null;
          } catch (err: any) {
            console.error('[DashboardStore] Server dataset query failed:', err.message);
            return null;
          }
        },

        // Upload Custom Datasets with client-side parsing + server upload for large files
        uploadDataset: async (name, fileContent, fileName) => {
          try {
            set({ isProcessing: true });
            await new Promise(resolve => setTimeout(resolve, 800));

            let rows: Record<string, any>[] = [];
            let headers: string[] = [];
            const isCSV = fileName.toLowerCase().endsWith('.csv');
            const isXLSX = fileName.toLowerCase().endsWith('.xlsx') || fileName.toLowerCase().endsWith('.xls');

            if (isCSV && typeof fileContent === 'string') {
              // --- PapaParse CSV parsing ---
              const parsed = Papa.parse(fileContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: false,
                transformHeader: (h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
              });

              if (parsed.errors.length > 0) {
                console.warn('PapaParse parsing issues:', parsed.errors.slice(0, 5).map(e => e.message));
              }

              if (!parsed.data || parsed.data.length === 0) {
                throw new Error('CSV Upload Error: The file contains no data rows.');
              }

              headers = Object.keys(parsed.data[0] as Record<string, string>);
              rows = (parsed.data as Record<string, string>[]).map((row, idx) => {
                const cleanRow: Record<string, any> = { id: idx + 1 };
                headers.forEach(h => {
                  cleanRow[h] = row[h] !== undefined ? String(row[h]).trim() : '';
                });
                return cleanRow;
              });

            } else if (isXLSX && fileContent instanceof ArrayBuffer) {
              // --- SheetJS XLSX parsing ---
              const workbook = XLSX.read(fileContent, { type: 'array' });
              const firstSheetName = workbook.SheetNames[0];
              if (!firstSheetName) {
                throw new Error('XLSX Parse Error: No sheets found in the workbook.');
              }
              const sheet = workbook.Sheets[firstSheetName];
              const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

              if (!jsonData || jsonData.length === 0) {
                throw new Error('XLSX Upload Error: The selected sheet contains no data.');
              }

              headers = Object.keys(jsonData[0]).map(h =>
                String(h).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
              );

              rows = jsonData.map((row, idx) => {
                const cleanRow: Record<string, any> = { id: idx + 1 };
                headers.forEach(h => {
                  const originalKey = Object.keys(row).find(
                    k => k.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_') === h
                  );
                  cleanRow[h] = originalKey ? String(row[originalKey]).trim() : '';
                });
                return cleanRow;
              });

            } else {
              throw new Error('Unsupported file format. Please upload a .csv or .xlsx file.');
            }

            if (rows.length === 0) {
              throw new Error('Parse Error: Could not extract any valid records from the file.');
            }

            // 2. Type Detection (heuristic over up to 50 rows)
            const columns: DatasetColumn[] = headers.map(header => {
              let isNumber = true;
              let isDate = true;
              const sampleSize = Math.min(rows.length, 50);
              const sampleRows = rows.slice(0, sampleSize);

              sampleRows.forEach(row => {
                const val = String(row[header]).trim();
                if (val === '' || isNaN(Number(val)) || val.includes(',')) {
                  isNumber = false;
                }
                const isDateString = /^\d{4}-\d{2}-\d{2}$/.test(val) ||
                  /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val) ||
                  (!isNaN(Date.parse(val)) && isNaN(Number(val)) && val.length > 5);
                if (!isDateString) {
                  isDate = false;
                }
              });

              let finalType: 'number' | 'string' | 'date' = 'string';
              if (isNumber) {
                finalType = 'number';
                rows.forEach(row => {
                  const val = String(row[header]).trim();
                  row[header] = val === '' ? 0 : Number(val.replace(/[$,]/g, ''));
                });
              } else if (isDate) {
                finalType = 'date';
                rows.forEach(row => {
                  try {
                    const d = new Date(row[header]);
                    row[header] = d.toISOString().split('T')[0];
                  } catch {
                    // fallback
                  }
                });
              }

              return { name: header, type: finalType };
            });

            // 3a. For LARGE files (>5MB), upload to server-side PostgreSQL table
            const fileSizeMB = (typeof fileContent === 'string' 
              ? new Blob([fileContent]).size 
              : (fileContent as ArrayBuffer).byteLength) / (1024 * 1024);
            const tblName = name.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');

            if (fileSizeMB > 5) {
              const uploadRes = await fetch('/api/datasets/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tableName: tblName,
                  displayName: name,
                  columns,
                  rows,
                }),
              });

              const uploadData = await uploadRes.json();

              if (!uploadData.success || !uploadData.dataset) {
                throw new Error(uploadData.error || 'Failed to upload dataset to server.');
              }

              const serverDataset: Dataset = {
                id: uploadData.dataset.id,
                name: uploadData.dataset.name,
                tableName: uploadData.dataset.tableName,
                columns: uploadData.dataset.columns || columns,
                rowCount: uploadData.dataset.rowCount || rows.length,
                rows: [], // Don't store rows locally for server-stored datasets
                description: uploadData.dataset.description || `Large dataset stored in PostgreSQL (${rows.length} rows)`,
                sourceType: 'server_upload' as const,
              };

              // Register with SQL Engine (schema only, no rows)
              get().sqlEngine.registerDataset(serverDataset);

              set(state => ({
                datasets: [...state.datasets, serverDataset],
                activeDatasetId: serverDataset.id,
                isProcessing: false,
              }));

              set({ suggestedKPIs: [
                `Show summary of ${columns.find(c => c.type === 'number')?.name || 'metrics'}`,
                `Generate a dashboard from ${rows.length.toLocaleString()} records`,
              ]});

              return true;
            }

            // 3b. For SMALL files (<=5MB), store locally as before
            const newDataset: Dataset = {
              id: `custom_${tblName}_${Date.now()}`,
              name,
              tableName: tblName,
              columns,
              rowCount: rows.length,
              rows,
              description: `Custom dataset imported from ${fileName}.`
            };

            // Register with the SQL Engine
            get().sqlEngine.registerDataset(newDataset);

            set(state => ({
              datasets: [...state.datasets, newDataset],
              activeDatasetId: newDataset.id,
              isProcessing: false
            }));

            // Trigger suggested KPIs
            const suggested = columns.filter(c => c.type === 'number').map(c => `Show sum of ${c.name}`);
            if (columns.some(c => c.type === 'string')) {
              const strCol = columns.find(c => c.type === 'string')!.name;
              const numCol = columns.find(c => c.type === 'number')?.name || 'id';
              suggested.push(`Show total ${numCol} breakdown by ${strCol}`);
            }
            if (columns.some(c => c.type === 'date')) {
              const dateCol = columns.find(c => c.type === 'date')!.name;
              suggested.push(`Show daily trend of ${suggested[0]?.replace('Show sum of ', '') || 'metrics'}`);
            }
            set({ suggestedKPIs: suggested.slice(0, 4) });

            return true;
          } catch (err: any) {
            console.error(err);
            set({ isProcessing: false });
            alert(err.message);
            return false;
          }
        },
        deleteDataset: (id) => set(state => ({ datasets: state.datasets.filter(d => d.id !== id) })),
        renameDatasetTable: (id, newTableName) => set(state => ({
          datasets: state.datasets.map(d => {
            if (d.id === id) {
              const updated = { ...d, tableName: newTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_') };
              get().sqlEngine.registerDataset(updated);
              return updated;
            }
            return d;
          })
        })),

        // Saved Dashboards Registry
        savedDashboards: [],
        fetchSavedDashboards: async () => {
          try {
            const res = await fetch('/api/dashboards');
            const data = await res.json();
            if (data.success && data.dashboards) {
              set({ savedDashboards: data.dashboards });
            }
          } catch (err: any) {
            console.error('[DashboardStore] Failed to fetch saved dashboards:', err.message);
          }
        },
        saveDashboard: async () => {
          const active = get().activeDashboard;
          if (!active) return;
          const activeDatasetId = get().activeDatasetId;
          const activeWorkspace = get().activeWorkspace;

          // Find if there is an existing dashboard with the same title in this workspace to update
          const existing = get().savedDashboards.find(
            d => d.title === active.dashboardTitle && d.workspace === activeWorkspace
          );

          const id = existing?.id || `dash_${Math.random().toString(36).substring(2, 9)}`;

          // Update local state first for instant UI response
          set(state => ({
            savedDashboards: [
              ...state.savedDashboards.filter(d => d.id !== id),
              { id, workspace: activeWorkspace, title: active.dashboardTitle, datasetId: activeDatasetId, config: active }
            ]
          }));

          // Send to DB
          try {
            await fetch('/api/dashboards', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id,
                workspace: activeWorkspace,
                title: active.dashboardTitle,
                datasetId: activeDatasetId,
                config: active
              })
            });
            // Re-fetch to sync
            await get().fetchSavedDashboards();
          } catch (err: any) {
            console.error('[DashboardStore] Failed to save dashboard to backend:', err.message);
          }
        },
        deleteDashboard: async (id) => {
          // Update local state
          set(state => ({
            savedDashboards: state.savedDashboards.filter(d => d.id !== id)
          }));

          // Delete from DB
          try {
            await fetch(`/api/dashboards?id=${id}`, {
              method: 'DELETE'
            });
            // Re-fetch to sync
            await get().fetchSavedDashboards();
          } catch (err: any) {
            console.error('[DashboardStore] Failed to delete dashboard on backend:', err.message);
          }
        },
        createNewDashboard: () => {
          set({
            activeDashboard: null,
            chatHistory: [
              {
                id: 'init_welcome',
                sender: 'assistant',
                text: "Started a new dashboard sandbox! Select a dataset and type a message in the AI Chat Panel on the left to compile visualizations.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
            ]
          });
        },

        importTableAsDataset: async (connectorId: string, tableName: string, schema: { name: string; type: string }[]) => {
          const tableId = `conn_table_${connectorId}_${tableName}_${Date.now()}`;
          
          // Fetch actual row count from the live database
          let actualRowCount = 0;
          let sampleRows: Record<string, any>[] = [];
          const connector = get().connectors.find(c => c.id === connectorId);
          
          if (connector && connector.status === 'connected') {
            // Temporarily set this connector as active to use executeConnectorQuery
            const prevActiveId = get().activeConnectorId;
            set({ activeConnectorId: connectorId });
            
            try {
              // Get row count
              const countResult = await get().executeConnectorQuery(`SELECT COUNT(*) as cnt FROM "${tableName}"`);
              if (countResult && countResult.rows.length > 0) {
                actualRowCount = parseInt(countResult.rows[0].cnt || '0', 10);
              }
              
              // Fetch sample rows (up to 50) for local SQL engine hydration
              const sampleResult = await get().executeConnectorQuery(`SELECT * FROM "${tableName}" LIMIT 50`);
              if (sampleResult) {
                sampleRows = sampleResult.rows;
              }
              
              // Keep this connector active for subsequent dashboard queries
            } catch (err: any) {
              console.warn('[DashboardStore] Failed to fetch DB table data:', err.message);
              set({ activeConnectorId: prevActiveId });
            }
          }

          const columns = schema.map(c => ({
            name: c.name,
            type: (c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'string') as 'number' | 'string' | 'date',
          }));

          const newDataset: Dataset = {
            id: tableId,
            name: `${tableName} (from ${connector?.name || 'DB'})`,
            tableName,
            columns,
            rowCount: actualRowCount,
            rows: sampleRows,
            description: `Imported from database table: ${tableName} (${actualRowCount} rows)`,
            sourceType: 'connection',
            sourceConnectorId: connectorId,
          };

          // Register with SQL Engine (with sample rows)
          get().sqlEngine.registerDataset(newDataset);

          set(state => ({
            datasets: [...state.datasets, newDataset],
            activeDatasetId: tableId,
          }));

          // Set suggested KPIs
          const numericCols = columns.filter(c => c.type === 'number');
          const stringCols = columns.filter(c => c.type === 'string');
          const suggestions: string[] = [];
          if (numericCols.length > 0) {
            suggestions.push(`Show summary of all ${numericCols[0].name}`);
          }
          if (stringCols.length > 0 && numericCols.length > 0) {
            suggestions.push(`Show ${numericCols[0].name} breakdown by ${stringCols[0].name}`);
          }
          if (actualRowCount > 0) {
            suggestions.push(`Generate a full analytics dashboard using ${actualRowCount.toLocaleString()} records`);
          } else {
            suggestions.push('Generate a full analytics dashboard');
          }
          set({ suggestedKPIs: suggestions });

          return newDataset;
        },

        // Active Dashboard Controllers
        activeDashboard: null,
        setActiveDashboard: (dash) => set({ activeDashboard: dash }),

        updateWidgetPosition: (id, x, y, w, h) => {
          const active = get().activeDashboard;
          if (!active) return;

          set({
            activeDashboard: {
              ...active,
              widgets: active.widgets.map(wgt => {
                if (wgt.id === id) {
                  return { ...wgt, x, y, w, h };
                }
                return wgt;
              })
            }
          });
        },

        deleteWidget: (id) => {
          const active = get().activeDashboard;
          if (!active) return;

          set({
            activeDashboard: {
              ...active,
              widgets: active.widgets.filter(wgt => wgt.id !== id)
            }
          });
        },

        addWidget: (widget) => {
          const active = get().activeDashboard;
          if (!active) return;

          const id = `widget_${Math.random().toString(36).substring(2, 9)}`;
          const newWidget: WidgetConfig = {
            ...widget,
            id,
            x: 0,
            y: active.widgets.reduce((maxY, w) => Math.max(maxY, w.y + w.h), 0)
          };

          // Execute query to hydrate data
          try {
            const res = get().sqlEngine.execute(newWidget.query, get().globalFilters);
            newWidget.data = res.rows;
            newWidget.metricsSummary = `Added manually. Executed query in ${res.queryTimeMs}ms.`;
          } catch (err: any) {
            newWidget.data = [];
            newWidget.metricsSummary = `Query error: ${err.message}`;
          }

          set({
            activeDashboard: {
              ...active,
              widgets: [...active.widgets, newWidget]
            }
          });
        },

        // Chat History & AI Interactions
        chatHistory: [
          {
            id: 'init_welcome',
            sender: 'assistant',
            text: "Welcome to **Dashvora**! I am your AI Dashboard Orchestrator.\n\nTo get started:\n1. **Connect a database** — Add a MySQL or PostgreSQL connection from the sidebar\n2. **Upload a file** — Import CSV or Excel files to visualize your data\n3. **Select tables** — Choose which tables to analyze from your connected database\n\nOnce you have data loaded, chat with me to generate interactive dashboards!",
            timestamp: ''
          }
        ],
        suggestedKPIs: [],
        isProcessing: false,

        sendChatMessage: async (text) => {
          const userMessage: ChatMessage = {
            id: `msg_user_${Math.random().toString(36).substring(2, 9)}`,
            sender: 'user',
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };

          set(state => ({
            chatHistory: [...state.chatHistory, userMessage],
            isProcessing: true
          }));

          const assistantMsgId = `msg_ai_${Math.random().toString(36).substring(2, 9)}`;
          const thinkingMessage: ChatMessage = {
            id: assistantMsgId,
            sender: 'assistant',
            text: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: 'thinking',
            steps: [
              { name: 'Understand User Prompt', status: 'pending' },
              { name: 'Analyze Dataset Schema', status: 'pending' },
              { name: 'Generate Dashboard Plan', status: 'pending' },
              { name: 'Generate Safe SQL Queries', status: 'pending' },
              { name: 'Execute Database Queries', status: 'pending' },
              { name: 'Synthesize AI Business Insights', status: 'pending' }
            ]
          };

          set(state => ({
            chatHistory: [...state.chatHistory, thinkingMessage]
          }));

          try {
            // ─────────────────────────────────────────────────────────────────
            // STEP 0: Dashboard Modification Intent Detection
            // Intercept commands that mutate the EXISTING dashboard without
            // needing to regenerate it entirely via the AI orchestrator.
            // ─────────────────────────────────────────────────────────────────
            const lower = text.toLowerCase().trim();
            const currentDashboard = get().activeDashboard;

            // Helper: fuzzy score between two strings (0–100)
            const fuzzyScore = (a: string, b: string): number => {
              const al = a.toLowerCase();
              const bl = b.toLowerCase();
              if (al === bl) return 100;
              if (al.includes(bl) || bl.includes(al)) return 80;
              const aWords = al.split(/[\s_\-]+/);
              const bWords = bl.split(/[\s_\-]+/);
              const shared = aWords.filter(w => w.length > 2 && bWords.some(bw => bw.includes(w) || w.includes(bw)));
              return Math.round((shared.length / Math.max(aWords.length, bWords.length)) * 70);
            };

            // Helper: find the best matching widget from the prompt text
            const findBestWidget = (prompt: string): WidgetConfig | null => {
              if (!currentDashboard) return null;
              let best: { widget: WidgetConfig; score: number } | null = null;
              for (const w of currentDashboard.widgets) {
                const score = Math.max(
                  fuzzyScore(prompt, w.title),
                  fuzzyScore(prompt, w.type),
                );
                if (!best || score > best.score) best = { widget: w, score };
              }
              return best && best.score >= 30 ? best.widget : null;
            };

            // ── REMOVE / DELETE a specific widget ────────────────────────────
            const isRemoveIntent =
              /\b(remove|delete|hide|close|drop|dismiss|get rid of|eliminate)\b/.test(lower);
            if (isRemoveIntent && currentDashboard) {
              const targetWidget = findBestWidget(lower);
              if (targetWidget) {
                const remaining = currentDashboard.widgets.filter(w => w.id !== targetWidget.id);
                set(state => ({
                  activeDashboard: { ...currentDashboard, widgets: remaining },
                  chatHistory: state.chatHistory.map(msg =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          status: 'done' as const,
                          text: `✅ Removed the **${targetWidget.title}** widget from your dashboard.\n\nYou now have **${remaining.length}** widget${remaining.length !== 1 ? 's' : ''} remaining.`,
                        }
                      : msg
                  ),
                  isProcessing: false,
                }));
                return;
              }
              // Matched remove intent but couldn't pinpoint a widget — fall through to give a helpful message
              if (currentDashboard.widgets.length > 0) {
                const widgetList = currentDashboard.widgets.map(w => `- **${w.title}** (${w.type})`).join('\n');
                set(state => ({
                  chatHistory: state.chatHistory.map(msg =>
                    msg.id === assistantMsgId
                      ? {
                          ...msg,
                          status: 'done' as const,
                          text: `I couldn't identify which widget to remove. Your current widgets are:\n\n${widgetList}\n\nTry being more specific, e.g. *"Remove the Revenue Trend chart"*.`,
                        }
                      : msg
                  ),
                  isProcessing: false,
                }));
                return;
              }
            }

            // ── CLEAR / RESET the entire dashboard ───────────────────────────
            const isClearDashboard =
              /\b(clear|reset|wipe|start over|start fresh|empty)\b.*\b(dashboard|all|everything|charts|widgets)\b/.test(lower) ||
              /\b(clear|reset)\s+(the\s+)?(whole\s+|entire\s+)?(dashboard|canvas)\b/.test(lower);
            if (isClearDashboard && currentDashboard) {
              set(state => ({
                activeDashboard: null,
                chatHistory: state.chatHistory.map(msg =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        status: 'done' as const,
                        text: `🧹 Dashboard cleared! The canvas is now blank.\n\nType a new prompt to generate a fresh dashboard from your data.`,
                      }
                    : msg
                ),
                isProcessing: false,
              }));
              return;
            }

            // ── CHANGE CHART TYPE ─────────────────────────────────────────────
            const chartTypeMap: Record<string, WidgetConfig['type']> = {
              'bar chart': 'bar', 'bar graph': 'bar', 'bar': 'bar',
              'line chart': 'line', 'line graph': 'line', 'line': 'line',
              'area chart': 'area', 'area graph': 'area', 'area': 'area',
              'pie chart': 'pie', 'pie': 'pie',
              'donut chart': 'donut', 'donut': 'donut', 'doughnut': 'donut',
              'table': 'table', 'data table': 'table', 'grid': 'table',
            };
            const isChangeTypeIntent =
              /\b(change|convert|switch|turn|make|transform)\b.*(chart|graph|viz|visualization|widget)/.test(lower) ||
              /\b(to|into|as)\s+(a\s+)?(bar|line|area|pie|donut|table)\b/.test(lower);
            if (isChangeTypeIntent && currentDashboard) {
              let newType: WidgetConfig['type'] | null = null;
              // Longest match first (so "bar chart" beats "bar")
              const sortedKeys = Object.keys(chartTypeMap).sort((a, b) => b.length - a.length);
              for (const key of sortedKeys) {
                if (lower.includes(key)) { newType = chartTypeMap[key]; break; }
              }
              if (newType) {
                const targetWidget = findBestWidget(lower);
                if (targetWidget) {
                  const updatedWidgets = currentDashboard.widgets.map(w =>
                    w.id === targetWidget.id ? { ...w, type: newType! } : w
                  );
                  set(state => ({
                    activeDashboard: { ...currentDashboard, widgets: updatedWidgets },
                    chatHistory: state.chatHistory.map(msg =>
                      msg.id === assistantMsgId
                        ? {
                            ...msg,
                            status: 'done' as const,
                            text: `✅ Changed **${targetWidget.title}** from \`${targetWidget.type}\` → \`${newType}\`.\n\nThe widget is now rendered as a ${newType} chart.`,
                          }
                        : msg
                    ),
                    isProcessing: false,
                  }));
                  return;
                }
              }
            }

            // ── ADD / APPEND a new widget to existing dashboard ───────────────
            const isAddIntent =
              /\b(add|append|insert|include|also show|and show|give me|generate)\b.*(chart|graph|widget|kpi|card|table|pie|bar|line|area|donut|trend|breakdown|metric)/.test(lower);
            if (isAddIntent && currentDashboard) {
              const activeDataset = get().datasets.find(d => d.id === get().activeDatasetId);
              if (activeDataset) {
                try {
                  const filterState = get().globalFilters;
                  const miniResult = get().aiOrchestrator.processPrompt(text, activeDataset, filterState);
                  // Pick the most relevant non-KPI widgets (up to 2) from the mini result
                  const newWidgets = miniResult.dashboard.widgets.filter(w => w.type !== 'kpi').slice(0, 2);

                  if (newWidgets.length > 0) {
                    const maxY = currentDashboard.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0);
                    const positioned = newWidgets.map((w, i) => ({
                      ...w,
                      id: `widget_add_${Math.random().toString(36).substring(2, 8)}`,
                      y: maxY + i * (w.h || 4),
                      x: 0,
                    }));

                    set(state => ({
                      activeDashboard: {
                        ...currentDashboard,
                        widgets: [...currentDashboard.widgets, ...positioned],
                      },
                      chatHistory: state.chatHistory.map(msg =>
                        msg.id === assistantMsgId
                          ? {
                              ...msg,
                              status: 'done' as const,
                              text: `➕ Added **${positioned.length}** new widget${positioned.length > 1 ? 's' : ''} to your dashboard:\n${positioned.map(w => `- **${w.title}** (${w.type})`).join('\n')}`,
                              generatedSql: newWidgets.map(w => w.query),
                            }
                          : msg
                      ),
                      isProcessing: false,
                    }));
                    return;
                  }
                } catch {
                  // Fall through to full dashboard generation
                }
              }
            }

            // ─────────────────────────────────────────────────────────────────
            // STEP 1+: Full dashboard generation (original flow)
            // Reached when no modification intent matched above.
            // ─────────────────────────────────────────────────────────────────
            const activeDataset = get().datasets.find(d => d.id === get().activeDatasetId);
            if (!activeDataset) {
              throw new Error("No active dataset loaded to query. Please upload a CSV/Excel file or connect a database first.");
            }

            // Simulate a small typing latency for realistic chat agent
            await new Promise(resolve => setTimeout(resolve, 1000));

            const filterState = get().globalFilters;

            // Try using the server-side AI API first (if user has configured an AI key)
            let dashboard: any = null;
            let steps: OrchestratorStep[] | undefined;
            let sqlQueries: string[] | undefined;
            let usedLocalAI = true;

            try {
              // Fetch the latest AI config from the server (ensures settings from DB are used)
              await get().fetchAiConfig();
              const aiConfig = get().aiConfig;

              const body: any = {
                prompt: text,
                dataset: {
                  name: activeDataset.name,
                  tableName: activeDataset.tableName,
                  columns: activeDataset.columns,
                  rowCount: activeDataset.rowCount,
                  description: activeDataset.description,
                },
              };

              // Pass the API key directly if we have it from the user's profile settings
              if (aiConfig.apiKey) {
                body.apiKey = aiConfig.apiKey;
                body.apiProvider = aiConfig.provider;
                body.apiModel = aiConfig.model;
                body.apiEndpoint = aiConfig.endpoint;
              }

              const aiResponse = await fetch('/api/ai/generate-dashboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              const aiData = await aiResponse.json();

              if (aiData.success && aiData.dashboard) {
                dashboard = aiData.dashboard;
                usedLocalAI = false;
              } else if (aiData.useLocalAI) {
                // Server told us to use local AI (no API key configured)
                console.warn('[DashboardStore] No AI API key configured, using local AI engine');
              }
            } catch (err: any) {
              console.warn('[DashboardStore] Server-side AI unavailable, falling back to local AI:', err.message);
            }

            if (usedLocalAI) {
              // Fall back to local AI orchestrator
              const res = get().aiOrchestrator.processPrompt(text, activeDataset, filterState);
              dashboard = res.dashboard;
              steps = res.steps;
              sqlQueries = res.sqlQueries;
            }

            // Try query execution paths in priority order:
            // 1. Active database connector (customer's live DB)
            // 2. Server dataset query (Dashvora's PG for uploaded datasets)
            // 3. Local SQL engine (in-memory mock data)
            const activeConnector = get().getActiveConnector();
            const currentDataset = get().datasets.find(d => d.id === get().activeDatasetId);
            const isServerDataset = currentDataset?.sourceType === 'server_upload';

            if (dashboard.widgets) {
              for (const widget of dashboard.widgets) {
                // Path 1: Active database connector (customer's live DB)
                if (activeConnector && !isServerDataset) {
                  try {
                    const result = await get().executeConnectorQuery(widget.query);
                    if (result) {
                      widget.data = result.rows;
                      widget.metricsSummary = `Query executed on ${activeConnector.name} in ${result.queryTimeMs}ms. Returned ${result.rowCount} rows.`;
                      continue;
                    }
                  } catch (err: any) {
                    console.warn(`[DashboardStore] DB query failed for widget "${widget.title}":`, err.message);
                  }
                }

                // Path 2: Server-stored dataset (data in Dashvora's own PostgreSQL)
                if (isServerDataset && currentDataset?.tableName) {
                  try {
                    const result = await get().executeServerDatasetQuery(widget.query, currentDataset.tableName);
                    if (result) {
                      widget.data = result.rows;
                      widget.metricsSummary = `Query executed on server dataset in ${result.queryTimeMs}ms. Returned ${result.rowCount} rows.`;
                      continue;
                    }
                  } catch (err: any) {
                    console.warn(`[DashboardStore] Server query failed for widget "${widget.title}":`, err.message);
                  }
                }

                // Path 3: Local SQL engine (in-memory datasets)
                if (!widget.data || widget.data.length === 0) {
                  try {
                    const res = get().sqlEngine.execute(widget.query, get().globalFilters);
                    widget.data = res.rows;
                    widget.metricsSummary = `Query completed in ${res.queryTimeMs}ms. Returned ${res.rows.length} rows.`;
                  } catch (err: any) {
                    console.warn(`[DashboardStore] SQL engine query failed for widget "${widget.title}":`, err.message);
                    widget.data = [];
                    widget.metricsSummary = `Query error: ${err.message}`;
                  }
                }
              }
            }

            // Ensure all widgets have unique IDs (server-side AI responses may not include them)
            if (dashboard.widgets) {
              dashboard.widgets = dashboard.widgets.map((w: WidgetConfig) => ({
                ...w,
                id: w.id || `widget_ai_${Math.random().toString(36).substring(2, 9)}`,
              }));
            }

            // Successfully processed
            set(state => ({
              activeDashboard: dashboard,
              chatHistory: state.chatHistory.map(msg => {
                if (msg.id === assistantMsgId) {
                  return {
                    ...msg,
                    status: 'done',
                    text: `I have compiled the **${dashboard.dashboardTitle}**! I successfully created **${dashboard.widgets.length}** custom visualizations matching your data schema.${activeConnector ? `\n\n*Queries executed against **${activeConnector.name}** (${activeConnector.type}).*` : ''}\n              \n### Generated Business Insights:\n${(dashboard.insights || []).map((i: string) => `- ${i}`).join('\n')}\n${usedLocalAI ? '\n> *🤖 Using local AI engine (configure an AI key in Settings for AI-generated dashboards)*' : '> *🧠 Using your AI provider (' + get().aiConfig.provider + ')*'}\n`,
                    steps: steps || [],
                    generatedSql: sqlQueries || [],
                    dashboardGenerated: true
                  };
                }
                return msg;
              }),
              isProcessing: false
            }));
          } catch (err: any) {
            console.error(err);
            set(state => ({
              chatHistory: state.chatHistory.map(msg => {
                if (msg.id === assistantMsgId) {
                  return {
                    ...msg,
                    status: 'error',
                    text: `I encountered an issue: **${err.message}**\n\nPlease verify the correct dataset is selected and your prompt matches column keywords!`,
                    steps: msg.steps?.map(s => s.status === 'running' ? { ...s, status: 'failed', details: err.message } : s)
                  };
                }
                return msg;
              }),
              isProcessing: false
            }));
          }
        },

        clearChatHistory: () => set({
          chatHistory: [
            {
              id: 'init_welcome',
              sender: 'assistant',
              text: "Chat cleared! How can I help you visualize your active dataset today?",
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]
        }),

        // Global Filters Bar state
        globalFilters: {
          dateFrom: '',
          dateTo: '',
          region: '',
          platform: '',
          plan_type: ''
        },

        setGlobalFilter: (key, value) => {
          set(state => ({
            globalFilters: {
              ...state.globalFilters,
              [key]: value
            }
          }));

          // Instantly refresh queries for all widgets on active dashboard
          const active = get().activeDashboard;
          if (active) {
            const refreshedWidgets = active.widgets.map(widget => {
              try {
                const res = get().sqlEngine.execute(widget.query, get().globalFilters);
                return {
                  ...widget,
                  data: res.rows,
                  metricsSummary: `Refreshed with global filters. Query executed in ${res.queryTimeMs}ms.`
                };
              } catch (err: any) {
                return {
                  ...widget,
                  data: [],
                  metricsSummary: `Filter error: ${err.message}`
                };
              }
            });

            set({
              activeDashboard: {
                ...active,
                widgets: refreshedWidgets
              }
            });
          }
        },

        clearGlobalFilters: () => {
          set({
            globalFilters: {
              dateFrom: '',
              dateTo: '',
              region: '',
              platform: '',
              plan_type: ''
            }
          });

          // Refresh charts
          const active = get().activeDashboard;
          if (active) {
            const refreshedWidgets = active.widgets.map(widget => {
              try {
                const res = get().sqlEngine.execute(widget.query, get().globalFilters);
                return {
                  ...widget,
                  data: res.rows,
                  metricsSummary: `Refreshed. Query executed in ${res.queryTimeMs}ms.`
                };
              } catch (err: any) {
                return {
                  ...widget,
                  data: [],
                  metricsSummary: `Query error: ${err.message}`
                };
              }
            });

            set({
              activeDashboard: {
                ...active,
                widgets: refreshedWidgets
              }
            });
          }
        },

        // Premium themes
        activeTheme: 'slate-obsidian',
        setTheme: (theme) => set({ activeTheme: theme })
      };
    },
    {
      name: 'dashvora-storage',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspace: state.activeWorkspace,
        datasets: state.datasets,
        activeDatasetId: state.activeDatasetId,
        connectors: state.connectors,
        activeConnectorId: state.activeConnectorId,
        activeDashboard: state.activeDashboard,
        savedDashboards: state.savedDashboards,
        chatHistory: state.chatHistory,
        globalFilters: state.globalFilters,
        activeTheme: state.activeTheme,
        suggestedKPIs: state.suggestedKPIs,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Clean up old localStorage key — data is now in IndexedDB
            try {
              localStorage.removeItem('dashvora-storage');
            } catch {
              // non-critical
            }

            state.reinitializeEngines();
            // Mark all connectors as disconnected on page load
            // because server-side connection pools are lost on refresh
            if (state.connectors.length > 0) {
              state.connectors = state.connectors.map(c => ({
                ...c,
                status: 'disconnected' as const,
              }));
              state.activeConnectorId = null;
            }
            // Wait a tick then try to auto-reconnect saved connectors
            setTimeout(() => {
              state.restoreSavedConnectors();
              state.fetchSavedDashboards();
            }, 500);
          }
        };
      },
    }
  )
);
