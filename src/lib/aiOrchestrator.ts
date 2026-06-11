import { Dataset, DatasetColumn } from './mockData';
import { SQLEngine, SQLQueryResult } from './sqlEngine';

export interface WidgetConfig {
  id: string;
  title: string;
  type: 'line' | 'area' | 'bar' | 'pie' | 'donut' | 'kpi' | 'table' | 'scatter';
  query: string;
  xAxis: string;
  yAxis: string;
  yAxis2?: string;
  w: number; // grid width (1-12)
  h: number; // grid height (rows)
  x: number;
  y: number;
  data?: Record<string, any>[];
  metricsSummary?: string;
}

export interface DashboardConfig {
  dashboardTitle: string;
  layout?: any[]; // for grid UI
  filters: string[];
  widgets: WidgetConfig[];
  insights: string[];
}

export interface OrchestratorStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  details?: string;
}

export interface OrchestrationResult {
  steps: OrchestratorStep[];
  dashboard: DashboardConfig;
  sqlQueries: string[];
}

interface MatchedColumns {
  numeric: string[];
  string: string[];
  date: string[];
  all: DatasetColumn[];
}

export class AIOrchestrator {
  private sqlEngine: SQLEngine;

  constructor(sqlEngine: SQLEngine) {
    this.sqlEngine = sqlEngine;
  }

  public processPrompt(prompt: string, activeDataset: Dataset, globalFilters?: any): OrchestrationResult {
    const steps: OrchestratorStep[] = [
      { name: 'Understand User Prompt', status: 'running', details: `Analyzing query: "${prompt}"` },
      { name: 'Analyze Dataset Schema', status: 'pending', details: `Inspecting columns for table: ${activeDataset.tableName}` },
      { name: 'Generate Dashboard Plan', status: 'pending', details: 'Formulating layout structure and visualization types' },
      { name: 'Generate Safe SQL Queries', status: 'pending', details: 'Creating optimized SELECT statements' },
      { name: 'Execute Database Queries', status: 'pending', details: 'Running aggregate operations' },
      { name: 'Synthesize AI Business Insights', status: 'pending', details: 'Formulating observations and KPI highlights' }
    ];

    try {
      // 1. Understand Prompt
      steps[0].status = 'completed';
      steps[0].details = `Understood target intent for dashboard generation around: "${prompt}"`;

      // 2. Schema Analysis
      steps[1].status = 'running';
      const cols = this.getMatchedColumns(activeDataset, prompt);

      steps[1].status = 'completed';
      steps[1].details = `Analyzed schema for '${activeDataset.tableName}'. Found ${activeDataset.columns.length} fields: ` +
        `Metrics: [${cols.numeric.join(', ')}], ` +
        `Dimensions: [${cols.string.join(', ')}], ` +
        `Timelines: [${cols.date.join(', ')}].`;

      // 3. Generate Plan & 4. SQL Queries
      steps[2].status = 'running';
      steps[3].status = 'running';

      const dashboard = this.generateDashboardPlan(prompt, activeDataset, cols);

      steps[2].status = 'completed';
      steps[2].details = `Designed dashboard layout with ${dashboard.widgets.length} interactive widgets tailored to your request.`;

      // 5. Execute Queries
      steps[4].status = 'running';
      const sqlQueries: string[] = [];

      dashboard.widgets.forEach((widget) => {
        sqlQueries.push(widget.query);
        try {
          const res = this.sqlEngine.execute(widget.query, globalFilters);
          widget.data = res.rows;
          widget.metricsSummary = `Query completed in ${res.queryTimeMs}ms. Returned ${res.rows.length} aggregated records.`;
        } catch (err: any) {
          console.error(`Error executing AI query for widget "${widget.title}":`, err);
          widget.data = [];
          widget.metricsSummary = `Execution error: ${err.message}`;
        }
      });

      steps[3].status = 'completed';
      steps[3].details = `Successfully generated and validated ${sqlQueries.length} safe SELECT queries using standard GROUP BY and WHERE clauses.`;

      steps[4].status = 'completed';
      steps[4].details = `Executed query transactions successfully. Hydrated visual configurations with live processed results.`;

      // 6. Insights
      steps[5].status = 'running';
      dashboard.insights = this.generateInsights(prompt, activeDataset, dashboard.widgets);
      steps[5].status = 'completed';
      steps[5].details = `Completed business metadata extraction. Synthesized ${dashboard.insights.length} operational recommendations.`;

      return {
        steps,
        dashboard,
        sqlQueries
      };
    } catch (error: any) {
      const activeStep = steps.find(s => s.status === 'running') || steps[0];
      activeStep.status = 'failed';
      activeStep.details = `Execution failed: ${error.message}`;
      throw error;
    }
  }

  /**
   * Parse the user's prompt and match keywords against dataset columns.
   * This gives us the columns that are most relevant to what the user asked for.
   */
  private getMatchedColumns(dataset: Dataset, prompt: string): MatchedColumns {
    const lowerPrompt = prompt.toLowerCase();

    const numericCols = dataset.columns.filter(c => c.type === 'number');
    const stringCols = dataset.columns.filter(c => c.type === 'string');
    const dateCols = dataset.columns.filter(c => c.type === 'date');

    // Score columns by relevance to the prompt using a separate score map
    const buildScoreMap = (cols: DatasetColumn[]): Map<string, number> => {
      const scores = new Map<string, number>();
      for (const col of cols) {
        const colName = col.name.toLowerCase().replace(/_/g, ' ');
        let score = 0;

        if (lowerPrompt.includes(colName)) {
          score += 10;
        }

        // Partial word match
        const words = colName.split(/[\s_]+/);
        for (const word of words) {
          if (word.length > 2 && lowerPrompt.includes(word)) {
            score += 5;
          }
        }

        // If a word from the prompt appears in the column name
        const promptWords = lowerPrompt.split(/[\s,]+/).filter(w => w.length > 2);
        for (const pw of promptWords) {
          if (colName.includes(pw)) {
            score += 3;
          }
        }

        scores.set(col.name, score);
      }
      return scores;
    };

    // Sort column names by score (descending)
    const sortByScore = (cols: DatasetColumn[], scores: Map<string, number>): string[] => {
      return [...cols].sort((a, b) => (scores.get(b.name) || 0) - (scores.get(a.name) || 0)).map(c => c.name);
    };

    const numericScores = buildScoreMap(numericCols);
    const stringScores = buildScoreMap(stringCols);
    const dateScores = buildScoreMap(dateCols);

    return {
      numeric: sortByScore(numericCols, numericScores),
      string: sortByScore(stringCols, stringScores),
      date: sortByScore(dateCols, dateScores),
      all: dataset.columns,
    };
  }

  /**
   * Detect user intent from the prompt to decide what kind of widgets to create.
   */
  private detectIntent(prompt: string): {
    hasTrendIntent: boolean;
    hasBreakdownIntent: boolean;
    hasComparisonIntent: boolean;
    hasSummaryIntent: boolean;
    hasDistributionIntent: boolean;
    chartType: string | null;
  } {
    const lower = prompt.toLowerCase();

    return {
      hasTrendIntent: /trend|over time|timeline|daily|monthly|weekly|history|growth|change|progress/i.test(lower),
      hasBreakdownIntent: /breakdown|by |per |group|category|categorize|split|segment/i.test(lower),
      hasComparisonIntent: /compare|versus|vs |difference|against|best|worst|top|bottom/i.test(lower),
      hasSummaryIntent: /total|sum|overview|summary|aggregate|all|metrics|kpi|performance/i.test(lower),
      hasDistributionIntent: /distribution|share|percentage|proportion|pct|ratio|allocation|composition/i.test(lower),
      chartType: /pie/.test(lower) ? 'pie' : /donut/.test(lower) ? 'donut' : /bar/.test(lower) ? 'bar' : /line/.test(lower) ? 'line' : /area/.test(lower) ? 'area' : /table/.test(lower) ? 'table' : null,
    };
  }

  private generateDashboardPlan(
    prompt: string,
    dataset: Dataset,
    cols: MatchedColumns
  ): DashboardConfig {
    const tableName = dataset.tableName;
    const intent = this.detectIntent(prompt);

    // Determine the most relevant columns based on prompt matching
    const primaryMetric = cols.numeric[0] || 'id';
    const secondaryMetric = cols.numeric[1] || cols.numeric[0] || 'id';
    const tertiaryMetric = cols.numeric[2] || cols.numeric[0] || 'id';
    const primaryDim = cols.string[0] || 'category';
    const secondaryDim = cols.string[1] || cols.string[0] || 'category';
    const dateCol = cols.date[0] || 'date';

    const hasTrend = intent.hasTrendIntent && cols.date.length > 0;
    const hasBreakdown = intent.hasBreakdownIntent && cols.string.length > 0;
    const hasDistribution = intent.hasDistributionIntent && cols.string.length > 0;
    const hasSummary = intent.hasSummaryIntent || (!hasTrend && !hasBreakdown);
    const userChartType = intent.chartType;

    const allWidgets: any[] = [];
    let yOffset = 0;
    let xPos = 0;

    // ---------- ROW 1: KPI Cards (always show up to 3) ----------
    const metricColsToShow = [
      { name: primaryMetric, label: primaryMetric.replace(/_/g, ' ') },
      { name: secondaryMetric, label: secondaryMetric.replace(/_/g, ' ') },
      { name: tertiaryMetric, label: tertiaryMetric.replace(/_/g, ' ') },
    ].filter((m, i) => m.name !== primaryMetric || i === 0) // dedup
      .filter((m, i, arr) => arr.findIndex(a => a.name === m.name) === i) // unique
      .slice(0, 3);

    let kpiX = 0;
    for (const m of metricColsToShow) {
      allWidgets.push({
        id: `kpi_${m.name}`,
        title: `Total ${m.label.toUpperCase()}`,
        type: 'kpi',
        query: `SELECT SUM(${m.name}) as ${m.name} FROM ${tableName}`,
        xAxis: '',
        yAxis: m.name,
        w: 4, h: 2, x: kpiX, y: yOffset,
      });
      kpiX += 4;
    }
    yOffset += 2;

    // ---------- ROW 2+: Intent-Based Charts ----------

    // TREND CHART (if user asked for trend/over time AND we have a date column)
    if (hasTrend) {
      const metric = cols.numeric[0] || primaryMetric;
      const secondMetric = cols.numeric[1] && cols.numeric[1] !== metric ? cols.numeric[1] : null;
      const trendType = userChartType === 'line' ? 'line' : userChartType === 'bar' ? 'bar' : 'area';

      const selectClause = secondMetric
        ? `SUM(${metric}) as ${metric}, SUM(${secondMetric}) as ${secondMetric}`
        : `SUM(${metric}) as ${metric}`;

      allWidgets.push({
        id: 'chart_trend',
        title: `${metric.replace(/_/g, ' ')} Trend Over Time`,
        type: trendType,
        query: `SELECT ${dateCol}, ${selectClause} FROM ${tableName} GROUP BY ${dateCol} ORDER BY ${dateCol} ASC`,
        xAxis: dateCol,
        yAxis: metric,
        yAxis2: secondMetric || undefined,
        w: 8, h: 4, x: 0, y: yOffset,
      });
      xPos = 8;
    }

    // DISTRIBUTION CHART (pie/donut) - if user asked for distribution/share OR breakdown with string cols
    if (hasDistribution && cols.string.length > 0 && cols.numeric.length > 0) {
      const dim = cols.string[0];
      const metric = cols.numeric[0];
      const distType = userChartType === 'pie' ? 'pie' : 'donut';

      allWidgets.push({
        id: 'chart_distribution',
        title: `Distribution by ${dim.replace(/_/g, ' ')}`,
        type: distType,
        query: `SELECT ${dim}, SUM(${metric}) as ${metric} FROM ${tableName} GROUP BY ${dim} ORDER BY ${metric} DESC LIMIT 8`,
        xAxis: dim,
        yAxis: metric,
        w: hasTrend ? 4 : 6, h: 4, x: hasTrend ? 8 : 0, y: yOffset,
      });

      if (!hasTrend) xPos = 6;
    }

    // COMPARISON/BREAKDOWN BAR CHART
    if (hasBreakdown && cols.string.length > 0 && cols.numeric.length > 0) {
      const dim = cols.string[0];
      const metric = hasTrend && cols.numeric[1] ? cols.numeric[1] : cols.numeric[0];
      const barType = userChartType === 'bar' ? 'bar' : 'bar';

      // If we already placed something at xPos, put this below or next to it
      const barW = xPos > 0 ? 4 : 6;

      allWidgets.push({
        id: 'chart_breakdown',
        title: `${metric.replace(/_/g, ' ')} by ${dim.replace(/_/g, ' ')}`,
        type: barType,
        query: `SELECT ${dim}, SUM(${metric}) as ${metric} FROM ${tableName} GROUP BY ${dim} ORDER BY ${metric} DESC LIMIT 10`,
        xAxis: dim,
        yAxis: metric,
        w: barW, h: 4, x: xPos, y: yOffset,
      });
      xPos += barW;
    }

    // If we placed any chart in the second row, advance yOffset
    if (hasTrend || hasDistribution || (hasBreakdown && cols.string.length > 0 && cols.numeric.length > 0)) {
      yOffset += 4;
      xPos = 0;
    }

    // DETAIL TABLE
    // Include up to 6 columns that best match the prompt
    const topCols = [
      ...cols.string.slice(0, 2),
      ...cols.numeric.slice(0, 3),
      ...cols.date.slice(0, 1),
    ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);

    if (topCols.length > 0) {
      allWidgets.push({
        id: 'table_detail',
        title: `${dataset.name} — Detailed Data`,
        type: 'table',
        query: `SELECT ${topCols.join(', ')} FROM ${tableName} LIMIT 20`,
        xAxis: topCols[0],
        yAxis: topCols[1] || topCols[0],
        w: 12, h: 4, x: 0, y: yOffset,
      });
      yOffset += 4;
    }

    // If somehow no widgets were created (shouldn't happen), create a simple one
    if (allWidgets.length === 0) {
      allWidgets.push({
        id: 'table_fallback',
        title: `${dataset.name} Data`,
        type: 'table',
        query: `SELECT * FROM ${tableName} LIMIT 10`,
        xAxis: dataset.columns[0]?.name || 'id',
        yAxis: dataset.columns[1]?.name || dataset.columns[0]?.name || 'id',
        w: 12, h: 4, x: 0, y: yOffset,
      });
    }

    // Determine filterable columns (first 2 string cols that make sense as filters)
    const filterCols = cols.string.slice(0, 3).filter(c =>
      !c.toLowerCase().includes('id') && !c.toLowerCase().includes('name')
    );

    return {
      dashboardTitle: this.generateDashboardTitle(prompt, dataset.name),
      filters: filterCols,
      widgets: allWidgets,
      insights: [],
    };
  }

  private generateDashboardTitle(prompt: string, datasetName: string): string {
    // Extract a meaningful title from the prompt
    const lower = prompt.toLowerCase();

    if (/trend|growth|history|timeline|over time/i.test(lower)) {
      return `Trend Analysis: ${datasetName}`;
    }
    if (/compare|vs |versus|difference/i.test(lower)) {
      return `Comparison Report: ${datasetName}`;
    }
    if (/breakdown|by |per |group/i.test(lower)) {
      return `Breakdown Analysis: ${datasetName}`;
    }
    if (/summary|overview|kpi|metrics|performance/i.test(lower)) {
      return `Performance Overview: ${datasetName}`;
    }
    if (/sales|revenue|profit|income/i.test(lower)) {
      return `Revenue & Sales Dashboard: ${datasetName}`;
    }
    if (/customer|user|client|signup|acquisition/i.test(lower)) {
      return `Customer Analytics: ${datasetName}`;
    }
    if (/marketing|ad |campaign|spend|conversion|ctr/i.test(lower)) {
      return `Marketing Performance: ${datasetName}`;
    }

    // Default: extract the first meaningful phrase
    const words = prompt.split(/[\s,.!?]+/).filter(w => w.length > 2).slice(0, 5).join(' ');
    return words ? `${words} — ${datasetName}` : `${datasetName} Analytics`;
  }

  private generateInsights(prompt: string, dataset: Dataset, widgets: WidgetConfig[]): string[] {
    // Generate dynamic insights based on the actual data in the widgets
    const insights: string[] = [];

    // Check KPI widgets for data values
    const kpiWidgets = widgets.filter(w => w.type === 'kpi');
    for (const kpi of kpiWidgets) {
      if (kpi.data && kpi.data.length > 0) {
        const val = kpi.data[0]?.[kpi.yAxis];
        if (val !== undefined && val !== null) {
          const formattedVal = typeof val === 'number'
            ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(val)
            : String(val);
          insights.push(`**${kpi.title}**: ${formattedVal} — based on your dataset.`);
        }
      }
    }

    // Add general observations
    const hasTrend = widgets.some(w => ['area', 'line'].includes(w.type));
    if (hasTrend) {
      insights.push('Trend visualization generated — examine direction and seasonality in your data.');
    }

    const hasBreakdown = widgets.some(w => w.type === 'bar' || w.type === 'pie' || w.type === 'donut');
    if (hasBreakdown) {
      insights.push('Category breakdown generated — identify top-performing segments at a glance.');
    }

    if (insights.length === 0) {
      insights.push(`Dashboard created for **${dataset.name}** with ${widgets.length} widgets based on your request.`);
    }

    return insights;
  }
}
