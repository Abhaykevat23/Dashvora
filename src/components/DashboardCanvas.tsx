'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { WidgetConfig } from '../lib/aiOrchestrator';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  Brush,
  LabelList,
  ReferenceLine
} from 'recharts';
import { 
  Trash2, 
  GripVertical,
  Sparkles, 
  Calendar,
  Filter,
  X,
  LayoutGrid,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Activity,
  Database,
  Lightbulb,
  ArrowUpRight,
  ChevronDown,
  Clock
} from 'lucide-react';

// Color palette for pie/donut charts
const SECTOR_COLORS = [
  '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b',
  '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
  '#6366f1', '#84cc16', '#d946ef', '#0ea5e9',
];

export default function DashboardCanvas() {
  const {
    activeDashboard,
    updateWidgetPosition,
    deleteWidget,
    globalFilters,
    setGlobalFilter,
    clearGlobalFilters,
    activeTheme,
    datasets,
    activeDatasetId,
    sendChatMessage,
    aiConfig,
    isProcessing,
  } = useDashboardStore();

  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null);
  const [visibleWidgets, setVisibleWidgets] = useState<Set<string>>(new Set());
  const [chartZoom, setChartZoom] = useState<Record<string, { left?: number; right?: number }>>({});
  const [activePieIndex, setActivePieIndex] = useState<Record<string, number | null>>({});
  const [crossFilter, setCrossFilter] = useState<{ column: string; value: string; label: string } | null>(null);
  const originalDataRef = useRef<Record<string, any[]>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const prevWidgetCount = useRef(0);

  // Click-to-filter: when user clicks a chart element, filter ALL charts by that category
  const handleChartClick = (column: string, value: string | number | undefined) => {
    if (!activeDashboard || value === undefined) return;
    const strVal = String(value);
    // Toggle off if clicking the same filter
    if (crossFilter && crossFilter.column === column && crossFilter.value === strVal) {
      setCrossFilter(null);
      return;
    }
    setCrossFilter({ column, value: strVal, label: `${column}: ${strVal}` });
  };

  // Compute filtered data for all widgets based on cross-filter
  const getFilteredWidgetData = (widgetId: string, originalData: any[]) => {
    if (!crossFilter || !originalData || originalData.length === 0) return originalData;
    return originalData.filter(row => {
      const cellVal = row[crossFilter.column];
      return String(cellVal ?? '').toLowerCase() === crossFilter.value.toLowerCase();
    });
  };

  // Shared tooltip style for all charts
  const tooltipStyle = {
    backgroundColor: 'rgba(9,9,11,0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    padding: '10px 14px',
    fontSize: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(12px)',
  };

  const tooltipItemStyle = {
    color: '#f4f4f5',
    fontSize: '12px',
  };

  const tooltipLabelStyle = {
    color: '#a1a1aa',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    marginBottom: '4px',
  };

  // Show all widgets when dashboard changes.
  // CSS transitionDelay (${index * 60}ms) on each widget card
  // already provides the staggered fade-in animation.
  useEffect(() => {
    if (!activeDashboard) {
      setVisibleWidgets(new Set());
      prevWidgetCount.current = 0;
      originalDataRef.current = {};
      return;
    }
    const widgetIds = new Set(activeDashboard.widgets.map(w => w.id));
    setVisibleWidgets(widgetIds);
    prevWidgetCount.current = activeDashboard.widgets.length;
    // Store original unfiltered data for each widget
    const dataMap: Record<string, any[]> = {};
    activeDashboard.widgets.forEach(w => {
      dataMap[w.id] = w.data ? [...w.data] : [];
    });
    originalDataRef.current = dataMap;
    // Reset cross-filter when dashboard changes
    setCrossFilter(null);
  }, [activeDashboard?.widgets.length]);

  // Also store original data when widgets update (new data arrives)
  useEffect(() => {
    if (!activeDashboard) return;
    const dataMap = { ...originalDataRef.current };
    let changed = false;
    activeDashboard.widgets.forEach(w => {
      if (w.data && (!dataMap[w.id] || dataMap[w.id].length !== w.data.length)) {
        dataMap[w.id] = [...w.data];
        changed = true;
      }
    });
    if (changed) {
      originalDataRef.current = dataMap;
    }
  });

  // Theme configuration
  const getThemeConfig = () => {
    switch (activeTheme) {
      case 'cyberpunk-neon':
        return { stroke1: '#f0abfc', stroke2: '#38bdf8', glowColor: 'rgba(240,171,252,0.15)' };
      case 'emerald-glass':
        return { stroke1: '#34d399', stroke2: '#60a5fa', glowColor: 'rgba(52,211,153,0.15)' };
      default:
        return { stroke1: '#06b6d4', stroke2: '#8b5cf6', glowColor: 'rgba(6,182,212,0.15)' };
    }
  };

  const colors = getThemeConfig();

  const formatValue = (val: any, label: string) => {
    if (val === null || val === undefined) return '-';
    const num = Number(val);
    if (isNaN(num)) return String(val);

    const lbl = label.toLowerCase();
    if (lbl.includes('sales') || lbl.includes('spend') || lbl.includes('mrr') || lbl.includes('cac') || lbl.includes('ltv') || lbl.includes('cost') || lbl.includes('profit') || lbl.includes('revenue') || lbl.includes('price')) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
    }
    if (lbl.includes('pct') || lbl.includes('rate') || lbl.includes('ctr') || lbl.includes('margin') || lbl.includes('ratio')) {
      return `${num.toFixed(1)}%`;
    }
    return new Intl.NumberFormat('en-US').format(num);
  };

  const handleDragStart = (e: React.MouseEvent, widget: WidgetConfig) => {
    e.preventDefault();
    setDragging({ id: widget.id, startX: e.clientX, startY: e.clientY, origX: widget.x, origY: widget.y });
  };

  const handleResizeStart = (e: React.MouseEvent, widget: WidgetConfig) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({ id: widget.id, startX: e.clientX, startY: e.clientY, origW: widget.w, origH: widget.h });
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const gridUnitX = rect.width / 12;
      const gridUnitY = 80;
      const newX = Math.max(0, Math.min(12 - 4, Math.round(dragging.origX + (e.clientX - dragging.startX) / gridUnitX)));
      const newY = Math.max(0, Math.round(dragging.origY + (e.clientY - dragging.startY) / gridUnitY));
      const widget = activeDashboard?.widgets.find(w => w.id === dragging.id);
      if (widget) updateWidgetPosition(dragging.id, newX, newY, widget.w, widget.h);
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, activeDashboard, updateWidgetPosition]);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newW = Math.max(3, Math.min(12, resizing.origW + Math.round(deltaX / 60)));
      const widget = activeDashboard?.widgets.find(w => w.id === resizing.id);
      if (widget) updateWidgetPosition(resizing.id, widget.x, widget.y, newW, widget.h);
    };
    const onUp = () => setResizing(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [resizing, activeDashboard, updateWidgetPosition]);

  const gradients = (
    <defs>
      <linearGradient id="glowCyan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="glowViolet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="glowFuchsia" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#f0abfc" stopOpacity={0.4}/>
        <stop offset="95%" stopColor="#f0abfc" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="glowSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4}/>
        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="glowEmerald" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#34d399" stopOpacity={0.35}/>
        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
      </linearGradient>
      <linearGradient id="glowBlue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35}/>
        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
      </linearGradient>
    </defs>
  );

  const renderWidget = (w: WidgetConfig) => {
    const rawData = w.data || [];
    const data = getFilteredWidgetData(w.id, rawData);

    // KPI Card
    if (w.type === 'kpi') {
      const metricCol = w.yAxis;
      const value = data[0]?.[metricCol] ?? 0;
      const trendUp = Math.random() > 0.4; // Simulated trend direction

      return (
        <div className="h-full flex flex-col justify-between px-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.15em] truncate pr-2">{w.title}</span>
            <div className={`w-2 h-2 rounded-full ${trendUp ? 'bg-emerald-400' : 'bg-rose-400'} shadow-sm shrink-0`} />
          </div>
          <div className="my-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white tracking-tight">
              {formatValue(value, w.title)}
            </span>
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
              <ArrowUpRight className={`w-3 h-3 ${!trendUp ? 'rotate-90' : ''}`} />
              {trendUp ? '+12.4%' : '-3.2%'}
            </span>
          </div>
          <div className="text-[9px] text-zinc-600 font-mono flex items-center justify-between border-t border-white/5 pt-2 mt-1">
            <span>{data.length > 0 ? `${data.length} aggregated` : 'no data'}</span>
            <span className="flex items-center gap-1 text-zinc-500">
              <Activity className="w-2.5 h-2.5" />
              live
            </span>
          </div>
        </div>
      );
    }

    // Table Widget
    if (w.type === 'table') {
      if (data.length === 0) {
        return (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Database className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-500">No data returned</p>
            </div>
          </div>
        );
      }
      const columns = Object.keys(data[0]);
      return (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {columns.map(col => (
                    <th key={col} className="px-2.5 py-2 text-[9px] font-bold text-zinc-500 uppercase tracking-[0.12em] font-mono whitespace-nowrap">
                      {col.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {data.slice(0, 8).map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.03] transition-colors duration-150">
                    {columns.map(col => (
                      <td key={col} className="px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 max-w-[140px] truncate">
                        {formatValue(row[col], col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[9px] text-zinc-600 font-mono text-right mt-auto pt-2 border-t border-white/[0.04] shrink-0">
            Showing top {Math.min(8, data.length)} of {data.length} rows
          </div>
        </div>
      );
    }

    // Area Chart — interactive with Brush zoom and clickable points
    if (w.type === 'area') {
      if (data.length === 0) return <EmptyChartPlaceholder />;
      const zoomState = chartZoom[w.id] || {};
      return (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data} 
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}              onClick={(e) => {
              if (e?.activeLabel) handleChartClick(w.xAxis, e.activeLabel);
            }}
          >
            {gradients}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey={w.xAxis} 
              stroke="rgba(255,255,255,0.25)" fontSize={9} 
              tickLine={false} axisLine={false} 
              domain={zoomState.left && zoomState.right ? [zoomState.left, zoomState.right] : ['auto', 'auto']}
              allowDuplicatedCategory={false}
            />
            <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend 
              verticalAlign="top" height={22} iconSize={8} 
              wrapperStyle={{ fontSize: '10px', opacity: 0.7, cursor: 'pointer' }}
              onClick={(e) => handleChartClick(w.xAxis, e.value)}
            />
            <Brush 
              dataKey={w.xAxis} 
              height={20} 
              stroke={colors.stroke1}
              fill="rgba(255,255,255,0.02)"
              travellerWidth={8}
              gap={1}
              padding={{ top: 4, right: 4, bottom: 4, left: 4 }}
              onChange={(e: any) => {
                if (e?.startIndex !== undefined && e?.endIndex !== undefined) {
                  setChartZoom(prev => ({
                    ...prev,
                    [w.id]: { left: e.startIndex, right: e.endIndex }
                  }));
                }
              }}
            />
            <Area 
              type="monotone" 
              dataKey={w.yAxis} 
              stroke={colors.stroke1} 
              fill={`url(#glow${activeTheme === 'cyberpunk-neon' ? 'Fuchsia' : activeTheme === 'emerald-glass' ? 'Emerald' : 'Cyan'})`} 
              strokeWidth={2.5} 
              dot={false} 
              activeDot={{ r: 5, strokeWidth: 0, fill: colors.stroke1, cursor: 'pointer', onClick: (data: any) => handleChartClick(w.xAxis, data?.payload?.[w.xAxis]) }} 
            />
            {w.yAxis2 && (
              <Area 
                type="monotone" 
                dataKey={w.yAxis2} 
                stroke={colors.stroke2} 
                fill={`url(#glow${activeTheme === 'cyberpunk-neon' ? 'Sky' : activeTheme === 'emerald-glass' ? 'Blue' : 'Violet'})`} 
                strokeWidth={2} 
                dot={false} 
                activeDot={{ r: 5, strokeWidth: 0, fill: colors.stroke2, cursor: 'pointer', onClick: (data: any) => handleChartClick(w.xAxis, data?.payload?.[w.xAxis]) }} 
              />
            )}
            {zoomState.left !== undefined && (
              <ReferenceLine 
                x={data[zoomState.left!]?.[w.xAxis]} 
                stroke={colors.stroke1} 
                strokeDasharray="4 4" 
                strokeWidth={1}
                opacity={0.3}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Line Chart — interactive with Brush zoom and clickable data points
    if (w.type === 'line') {
      if (data.length === 0) return <EmptyChartPlaceholder />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data} 
            margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            onClick={(e) => {
              if (e?.activeLabel) handleChartClick(w.xAxis, e.activeLabel);
            }}
          >
            {gradients}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey={w.xAxis} 
              stroke="rgba(255,255,255,0.25)" fontSize={9} 
              tickLine={false} axisLine={false} 
              domain={['auto', 'auto']}
              allowDuplicatedCategory={false}
            />
            <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
            />
            <Legend 
              verticalAlign="top" height={22} iconSize={8} 
              wrapperStyle={{ fontSize: '10px', opacity: 0.7, cursor: 'pointer' }}
              onClick={(e) => handleChartClick(w.xAxis, e.value)}
            />
            <Brush 
              dataKey={w.xAxis} 
              height={20} 
              stroke={colors.stroke1}
              fill="rgba(255,255,255,0.02)"
              travellerWidth={8}
              gap={1}
              padding={{ top: 4, right: 4, bottom: 4, left: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey={w.yAxis} 
              stroke={colors.stroke1} 
              strokeWidth={2.5} 
              dot={{ r: 2, fill: colors.stroke1, cursor: 'pointer' }} 
              activeDot={{ r: 6, strokeWidth: 0, fill: colors.stroke1, cursor: 'pointer', onClick: (data: any) => handleChartClick(w.xAxis, data?.payload?.[w.xAxis]) }} 
            />
            {w.yAxis2 && (
              <Line 
                type="monotone" 
                dataKey={w.yAxis2} 
                stroke={colors.stroke2} 
                strokeWidth={2} 
                dot={{ r: 2, fill: colors.stroke2, cursor: 'pointer' }} 
                activeDot={{ r: 6, strokeWidth: 0, fill: colors.stroke2, cursor: 'pointer', onClick: (data: any) => handleChartClick(w.xAxis, data?.payload?.[w.xAxis]) }} 
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // Bar Chart — interactive with clickable bars
    if (w.type === 'bar') {
      if (data.length === 0) return <EmptyChartPlaceholder />;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barCategoryGap="20%">
            {gradients}
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey={w.xAxis} 
              stroke="rgba(255,255,255,0.25)" fontSize={9} 
              tickLine={false} axisLine={false} 
              domain={['auto', 'auto']}
            />
            <YAxis stroke="rgba(255,255,255,0.25)" fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Legend 
              verticalAlign="top" height={22} iconSize={8} 
              wrapperStyle={{ fontSize: '10px', opacity: 0.7, cursor: 'pointer' }}
              onClick={(e) => handleChartClick(w.xAxis, e.value)}
            />
            <Bar 
              dataKey={w.yAxis} 
              fill={colors.stroke1} 
              radius={[4, 4, 0, 0]} 
              maxBarSize={42}
              cursor="pointer"
              onClick={(e: any) => handleChartClick(w.xAxis, e?.payload?.[w.xAxis])}
            >
              <LabelList 
                dataKey={w.yAxis} 
                position="top" 
                style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.5)', fontWeight: 600 }}
              />
            </Bar>
            {w.yAxis2 && (
              <Bar 
                dataKey={w.yAxis2} 
                fill={colors.stroke2} 
                radius={[4, 4, 0, 0]} 
                maxBarSize={42}
                cursor="pointer"
                onClick={(e: any) => handleChartClick(w.xAxis, e?.payload?.[w.xAxis])}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    // Pie / Donut Chart — interactive with clickable segments
    if (w.type === 'pie' || w.type === 'donut') {
      if (data.length === 0) return <EmptyChartPlaceholder />;
      const isDonut = w.type === 'donut';
      const activeIdx = activePieIndex[w.id] ?? null;
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <Pie
              data={data}
              cx="50%" cy="45%"
              labelLine={false}
              innerRadius={isDonut ? 42 : 0}
              outerRadius={activeIdx !== null ? 78 : 68}
              paddingAngle={isDonut ? 2 : 0}
              dataKey={w.yAxis}
              nameKey={w.xAxis}
              animationBegin={0}
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={SECTOR_COLORS[index % SECTOR_COLORS.length]}
                  stroke={activeIdx === index ? '#ffffff40' : 'transparent'}
                  strokeWidth={activeIdx === index ? 2 : 0}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                  onMouseEnter={() => setActivePieIndex(prev => ({ ...prev, [w.id]: index }))}
                  onMouseLeave={() => setActivePieIndex(prev => ({ ...prev, [w.id]: null }))}
                  onClick={() => handleChartClick(w.xAxis, entry[w.xAxis])}
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={tooltipStyle}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
            />
            <Legend 
              layout="horizontal" align="center" verticalAlign="bottom" 
              iconSize={8} 
              wrapperStyle={{ fontSize: '9px', opacity: 0.7, paddingTop: '4px', cursor: 'pointer' }}
              onClick={(e) => handleChartClick(w.xAxis, e.value)}
            />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    return null;
  };

  return (
    <main
      ref={canvasRef}
      id="dashboard-canvas"
      className="flex-1 h-[calc(100vh-4rem)] bg-[#09090b] overflow-y-auto p-6 tech-grid"
      style={dragging ? { cursor: 'grabbing', userSelect: 'none' } : resizing ? { cursor: 'ew-resize', userSelect: 'none' } : {}}
    >
      {isProcessing && !activeDashboard && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
          <div className="glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <p className="text-sm text-zinc-300 font-semibold">Generating your dashboard...</p>
            <p className="text-[10px] text-zinc-500">Analyzing schema & creating visualizations</p>
          </div>
        </div>
      )}

      {/* Global Filters Bar */}
      {activeDashboard && (
        <div className="glass-panel rounded-xl p-4 border border-white/[0.06] mb-6 flex flex-wrap items-center justify-between gap-4 animate-slide-down">            <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-[0.12em]">Filters</span>
            {crossFilter && (
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20 ml-1">
                {crossFilter.label}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {activeDashboard.filters.includes('region') && (
              <FilterSelect label="Region" value={globalFilters.region} onChange={(v) => setGlobalFilter('region', v)} options={[
                { value: '', label: 'All Regions' },
                { value: 'North America', label: 'North America' },
                { value: 'Europe', label: 'Europe' },
                { value: 'Asia-Pacific', label: 'Asia-Pacific' },
              ]} />
            )}
            {activeDashboard.filters.includes('platform') && (
              <FilterSelect label="Platform" value={globalFilters.platform} onChange={(v) => setGlobalFilter('platform', v)} options={[
                { value: '', label: 'All Channels' },
                { value: 'Google Ads', label: 'Google Ads' },
                { value: 'LinkedIn Ads', label: 'LinkedIn Ads' },
                { value: 'Meta Ads', label: 'Meta Ads' },
              ]} />
            )}
            {activeDashboard.filters.includes('plan_type') && (
              <FilterSelect label="Plan" value={globalFilters.plan_type} onChange={(v) => setGlobalFilter('plan_type', v)} options={[
                { value: '', label: 'All Plans' },
                { value: 'Developer Sandbox', label: 'Developer Sandbox' },
                { value: 'Team Core', label: 'Team Core' },
                { value: 'Enterprise Scale', label: 'Enterprise Scale' },
              ]} />
            )}

            <DateRangePicker
              dateFrom={globalFilters.dateFrom}
              dateTo={globalFilters.dateTo}
              onDateFromChange={(v) => setGlobalFilter('dateFrom', v)}
              onDateToChange={(v) => setGlobalFilter('dateTo', v)}
            />

            {(globalFilters.region || globalFilters.platform || globalFilters.plan_type || globalFilters.dateFrom || globalFilters.dateTo || crossFilter) && (
              <button
                onClick={() => {
                  clearGlobalFilters();
                  setCrossFilter(null);
                }}
                className="text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 font-semibold"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dashboard Widgets Grid */}
      {activeDashboard ? (
        <div className="grid grid-cols-12 gap-5 pb-20" id="dashboard-widget-grid">
          {activeDashboard.widgets.map((widget, index) => {
            const colWidth = widget.w >= 12 ? 'col-span-12' 
              : widget.w >= 8 ? 'col-span-12 lg:col-span-8' 
              : widget.w >= 6 ? 'col-span-12 md:col-span-6' 
              : widget.w >= 4 ? 'col-span-12 md:col-span-6 lg:col-span-4' 
              : 'col-span-12 md:col-span-3';

            const isVisible = visibleWidgets.has(widget.id);
            const isDraggingThis = dragging?.id === widget.id;

            const minCardH = widget.type === 'kpi' ? 200 : 280;
            return (
              <div
                key={widget.id}
                className={`glass-panel rounded-xl border border-white/[0.06] transition-all duration-500 relative group flex flex-col justify-between ${colWidth} ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                } ${
                  isDraggingThis 
                    ? 'shadow-2xl shadow-cyan-500/10 ring-1 ring-cyan-500/20 z-50 scale-[1.02]' 
                    : 'hover:border-white/[0.12] hover:shadow-lg hover:shadow-black/20'
                }`}
                style={isDraggingThis ? { transition: 'none', opacity: 0.92, minHeight: minCardH } : { transitionDelay: `${index * 60}ms`, minHeight: minCardH }}
              >
                {/* Drag Handle */}
                <button
                  onMouseDown={(e) => handleDragStart(e, widget)}
                  className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] rounded-lg transition-all duration-200 cursor-grab active:cursor-grabbing z-10"
                  title="Drag to reposition"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>

                {/* Controls */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-zinc-950/80 p-0.5 border border-white/[0.06] rounded-lg transition-opacity duration-200 z-10">
                  <button
                    onClick={() => {
                      const w = activeDashboard.widgets.find(wg => wg.id === widget.id);
                      if (w) updateWidgetPosition(widget.id, w.x, w.y, Math.min(12, w.w + 2), w.h);
                    }}
                    disabled={widget.w >= 12}
                    className="p-1 text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] rounded disabled:opacity-20"
                    title="Expand"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      const w = activeDashboard.widgets.find(wg => wg.id === widget.id);
                      if (w) updateWidgetPosition(widget.id, w.x, w.y, Math.max(3, w.w - 2), w.h);
                    }}
                    disabled={widget.w <= 3}
                    className="p-1 text-zinc-500 hover:text-cyan-400 hover:bg-white/[0.04] rounded disabled:opacity-20"
                    title="Shrink"
                  >
                    <Minimize2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteWidget(widget.id)}
                    className="p-1 text-zinc-500 hover:text-red-400 hover:bg-white/[0.04] rounded"
                    title="Remove Widget"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {/* Widget Title */}
                {widget.type !== 'kpi' && (
                  <div className="flex items-center gap-2 px-4 pt-4 pb-2 border-b border-white/[0.04]">
                    <WidgetIcon type={widget.type} />
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.12em] truncate">
                      {widget.title}
                    </h4>
                  </div>
                )}

                {/* Chart Body */}
                {widget.type === 'kpi' ? (
                  <div className="px-4 py-3 flex-1 flex items-center" style={{ minHeight: '120px' }}>
                    {renderWidget(widget)}
                  </div>
                ) : (
                  <div className="flex-1 w-full min-h-0 flex flex-col p-3">
                    <div style={{ width: '100%', height: Math.max(160, (widget.h || 4) * 60 - 48) }}>
                      {renderWidget(widget)}
                    </div>
                  </div>
                )}

                {/* Resize Handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, widget)}
                  className="absolute bottom-2 right-2 w-4 h-4 opacity-0 group-hover:opacity-100 cursor-ew-resize flex items-center justify-center hover:text-cyan-400 transition-all z-10"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-zinc-600">
                    <path d="M1 1L9 9M5 1L9 5M1 5L5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center animate-fade-in">
          {/* Logo Glow */}
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30 relative">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-white tracking-tight mb-3">
            Your AI Dashboard Studio
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10 max-w-lg mx-auto">
            Connect a database, upload a CSV/Excel file, or select a dataset from the sidebar. 
            Then type a natural language prompt in the chat panel to instantly generate interactive dashboards.
          </p>

          {/* Quick Start Cards */}
          <div className="w-full max-w-lg space-y-3">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">Quick start templates</p>
            <div className="grid grid-cols-2 gap-3">
              <QuickStartCard
                icon={<BarChart3 className="w-4 h-4" />}
                title="Sales Analytics"
                description="Revenue, profits, and regional breakdowns"
                color="cyan"
                onClick={() => handleDeployQuick("Create a sales performance dashboard showing revenue, profits, and breakdowns")}
              />
              <QuickStartCard
                icon={<PieChartIcon className="w-4 h-4" />}
                title="Marketing Dashboard"
                description="Ad spend, conversions, and platform ROI"
                color="violet"
                onClick={() => handleDeployQuick("Create an advertising dashboard with spend allocation, CTR, and campaign efficiency")}
              />
              <QuickStartCard
                icon={<Activity className="w-4 h-4" />}
                title="User Analytics"
                description="Active users, MRR growth, and plan metrics"
                color="emerald"
                onClick={() => handleDeployQuick("Create a SaaS analytics dashboard with user metrics, MRR trends, and plan breakdowns")}
              />
              <QuickStartCard
                icon={<Lightbulb className="w-4 h-4" />}
                title="Custom Dashboard"
                description="Describe what you want to see"
                color="amber"
                onClick={() => handleDeployQuick("Generate a comprehensive overview dashboard with KPIs, trends, and detailed data table")}
              />
            </div>
          </div>

          {/* AI Provider Status */}
          <div className="mt-8 flex items-center gap-2 px-3 py-2 rounded-full border border-white/[0.06] bg-white/[0.02]">
            <div className={`w-2 h-2 rounded-full ${aiConfig.apiKey ? 'bg-emerald-400' : 'bg-amber-400'} shadow-sm`} />
            <span className="text-[10px] text-zinc-500 font-medium">
              {aiConfig.apiKey 
                ? `AI ready — using ${aiConfig.provider === 'anthropic' ? 'Claude' : aiConfig.provider === 'groq' ? 'Groq' : 'OpenAI'}` 
                : 'No AI key configured — using local engine'}
            </span>
            {!aiConfig.apiKey && (
              <span className="text-[9px] text-amber-500/70 ml-1">(add in Settings)</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

// Sub-component: Empty chart placeholder
function EmptyChartPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <BarChart3 className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
        <p className="text-[10px] text-zinc-500">Insufficient data</p>
      </div>
    </div>
  );
}

// Sub-component: Widget type icon
function WidgetIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    area: <Activity className="w-3.5 h-3.5 text-cyan-400" />,
    line: <LineChartIcon className="w-3.5 h-3.5 text-cyan-400" />,
    bar: <BarChart3 className="w-3.5 h-3.5 text-violet-400" />,
    pie: <PieChartIcon className="w-3.5 h-3.5 text-emerald-400" />,
    donut: <PieChartIcon className="w-3.5 h-3.5 text-fuchsia-400" />,
    table: <TableIcon className="w-3.5 h-3.5 text-violet-400" />,
  };
  return <>{icons[type] || <LayoutGrid className="w-3.5 h-3.5 text-zinc-500" />}</>;
}

// Sub-component: Filter dropdown
function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; 
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-zinc-500 font-mono font-semibold">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-950 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer appearance-none"
      >
        {options.map(o => (
          <option key={o.value} value={o.value} className="bg-zinc-950">{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// Sub-component: Quick start card
function QuickStartCard({ icon, title, description, color, onClick }: {
  icon: React.ReactNode; title: string; description: string; 
  color: string; onClick: () => void;
}) {
  const borderColors: Record<string, string> = {
    cyan: 'hover:border-cyan-500/30 hover:bg-cyan-950/[0.08]',
    violet: 'hover:border-violet-500/30 hover:bg-violet-950/[0.08]',
    emerald: 'hover:border-emerald-500/30 hover:bg-emerald-950/[0.08]',
    amber: 'hover:border-amber-500/30 hover:bg-amber-950/[0.08]',
  };

  return (
    <button
      onClick={onClick}
      className={`glass-panel rounded-xl p-4 text-left border border-white/[0.06] transition-all duration-200 group flex items-start gap-3 ${borderColors[color]}`}
    >
      <div className={`w-9 h-9 rounded-lg bg-${color}-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-200`}
        style={{ backgroundColor: `${color === 'cyan' ? 'rgba(6,182,212,0.1)' : color === 'violet' ? 'rgba(139,92,246,0.1)' : color === 'emerald' ? 'rgba(52,211,153,0.1)' : 'rgba(245,158,11,0.1)'}` }}
      >
        <div className={`text-${color}-400`} style={{ 
          color: `${color === 'cyan' ? '#06b6d4' : color === 'violet' ? '#8b5cf6' : color === 'emerald' ? '#34d399' : '#f59e0b'}`
        }}>
          {icon}
        </div>
      </div>
      <div>
        <span className="font-bold text-xs text-zinc-200 block mb-0.5">{title}</span>
        <span className="text-[10px] text-zinc-500 leading-snug block">{description}</span>
      </div>
    </button>
  );
}

// ── Date Range Picker with presets ────────────────────────────────────────
const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This Year', days: 365 },
  { label: 'All Time', days: 0, allTime: true },
];

function formatDisplayDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRelativeDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

function DateRangePicker({ dateFrom, dateTo, onDateFromChange, onDateToChange }: {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);

  // Sync local state when global filters change externally
  useEffect(() => {
    setLocalFrom(dateFrom);
    setLocalTo(dateTo);
  }, [dateFrom, dateTo]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  const applyPreset = (preset: typeof DATE_PRESETS[0]) => {
    if (preset.allTime) {
      onDateFromChange('');
      onDateToChange('');
    } else if (preset.days === 0) {
      const today = getRelativeDate(0);
      onDateFromChange(today);
      onDateToChange(today);
    } else {
      onDateFromChange(getRelativeDate(preset.days));
      onDateToChange(getRelativeDate(0));
    }
    setOpen(false);
  };

  const applyCustom = () => {
    onDateFromChange(localFrom);
    onDateToChange(localTo);
    setOpen(false);
  };

  // Determine display text
  const hasRange = !!(dateFrom || dateTo);
  const displayText = dateFrom && dateTo
    ? `${formatDisplayDate(dateFrom)} — ${formatDisplayDate(dateTo)}`
    : dateFrom
      ? `From ${formatDisplayDate(dateFrom)}`
      : dateTo
        ? `Until ${formatDisplayDate(dateTo)}`
        : 'Select dates';

  // Detect active preset
  const todayStr = getRelativeDate(0);
  const activePreset = DATE_PRESETS.find(p => {
    if (p.allTime) return !dateFrom && !dateTo;
    if (p.days === 0) return dateFrom === todayStr && dateTo === todayStr;
    return dateFrom === getRelativeDate(p.days) && dateTo === todayStr;
  });

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 bg-zinc-950 border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[10px] transition-all hover:border-cyan-500/30 hover:bg-cyan-950/[0.08] ${
          hasRange ? 'text-zinc-200' : 'text-zinc-500'
        }`}
      >
        <Calendar className="w-3 h-3 shrink-0 text-zinc-500" />
        <span className="whitespace-nowrap min-w-[80px] text-left">{displayText}</span>
        <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 glass-panel rounded-xl border border-white/[0.1] shadow-2xl shadow-black/40 p-3 min-w-[280px] animate-fade-in">
          {/* Presets */}
          <div className="grid grid-cols-2 gap-1 mb-3">
            {DATE_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`text-[10px] font-medium px-2 py-1.5 rounded-lg transition-all text-left ${
                  activePreset?.label === preset.label
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <Clock className="w-2.5 h-2.5 inline mr-1 opacity-60" />
                {preset.label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mb-3" />

          {/* Custom Date Inputs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] w-8 shrink-0">From</span>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-[0.1em] w-8 shrink-0">To</span>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-zinc-300 focus:outline-none focus:border-cyan-500/50 [color-scheme:dark]"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setLocalFrom(''); setLocalTo(''); onDateFromChange(''); onDateToChange(''); setOpen(false); }}
                className="flex-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg py-1.5 transition-all"
              >
                Clear
              </button>
              <button
                onClick={applyCustom}
                className="flex-1 text-[10px] font-semibold text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/25 rounded-lg py-1.5 transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: deploy quick dashboard
function handleDeployQuick(prompt: string) {
  useDashboardStore.getState().sendChatMessage(prompt);
}
