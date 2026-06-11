import { Dataset } from './mockData';

export interface SQLQueryResult {
  columns: string[];
  rows: Record<string, any>[];
  queryTimeMs: number;
  sql: string;
}

export class SQLEngine {
  private datasets: Map<string, Dataset> = new Map();

  constructor(initialDatasets: Dataset[] = []) {
    initialDatasets.forEach(ds => this.registerDataset(ds));
  }

  public registerDataset(dataset: Dataset) {
    this.datasets.set(dataset.tableName.toLowerCase(), dataset);
  }

  public getDatasetsList() {
    return Array.from(this.datasets.values()).map(d => ({
      name: d.name,
      tableName: d.tableName,
      columns: d.columns,
      rowCount: d.rowCount,
      description: d.description,
    }));
  }

  /**
   * Safe execution entry point.
   */
  public execute(sqlQuery: string, globalFilters?: { dateFrom?: string; dateTo?: string; region?: string; platform?: string; plan_type?: string }): SQLQueryResult {
    const startTime = performance.now();
    const cleanSql = sqlQuery.trim().replace(/;$/, '');

    // 1. Safety Validation
    const upperQuery = cleanSql.toUpperCase();
    const forbidden = ['DELETE', 'DROP', 'UPDATE', 'ALTER', 'INSERT', 'CREATE', 'TRUNCATE', 'RENAME', 'GRANT', 'REVOKE'];
    for (const verb of forbidden) {
      // Use regex to match whole words only to prevent matching columns like 'created_at' or 'drop_off_rate'
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      if (regex.test(upperQuery)) {
        throw new Error(`Security Violation: Command '${verb}' is not permitted. Only read-only SELECT operations are allowed.`);
      }
    }

    if (!upperQuery.startsWith('SELECT')) {
      throw new Error(`Syntax Error: Query must start with SELECT. Received: "${cleanSql.substring(0, 30)}..."`);
    }

    // 2. Parse FROM table
    // Regex to match "FROM table_name"
    const fromMatch = cleanSql.match(/FROM\s+([a-zA-Z0-9_\-]+)/i);
    if (!fromMatch) {
      throw new Error("Syntax Error: Table name not specified. Missing FROM clause.");
    }
    const tableName = fromMatch[1].toLowerCase();
    const dataset = this.datasets.get(tableName);
    if (!dataset) {
      throw new Error(`Database Error: Table '${tableName}' does not exist in the active schema.`);
    }

    let sourceRows = [...dataset.rows];

    // 3. Inject Global Filters into WHERE clause dynamically if provided
    const filterClauses: string[] = [];
    if (globalFilters) {
      if (globalFilters.dateFrom && dataset.columns.some(c => c.name === 'date')) {
        sourceRows = sourceRows.filter(r => r.date >= globalFilters.dateFrom!);
      }
      if (globalFilters.dateTo && dataset.columns.some(c => c.name === 'date')) {
        sourceRows = sourceRows.filter(r => r.date <= globalFilters.dateTo!);
      }
      if (globalFilters.region && dataset.columns.some(c => c.name === 'region')) {
        sourceRows = sourceRows.filter(r => r.region === globalFilters.region);
      }
      if (globalFilters.platform && dataset.columns.some(c => c.name === 'platform')) {
        sourceRows = sourceRows.filter(r => r.platform === globalFilters.platform);
      }
      if (globalFilters.plan_type && dataset.columns.some(c => c.name === 'plan_type')) {
        sourceRows = sourceRows.filter(r => r.plan_type === globalFilters.plan_type);
      }
    }

    // 4. Parse SQL WHERE clause
    const whereMatch = cleanSql.match(/WHERE\s+(.+?)(?:GROUP\s+BY|ORDER\s+BY|LIMIT|$)/i);
    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      sourceRows = this.applyWhereFilters(sourceRows, whereClause);
    }

    // 5. Parse SELECT columns and Aggregates
    const selectMatch = cleanSql.match(/SELECT\s+(.+?)\s+FROM/i);
    if (!selectMatch) {
      throw new Error("Syntax Error: Missing SELECT fields.");
    }
    const selectFieldsStr = selectMatch[1].trim();
    const selectItems = this.parseSelectItems(selectFieldsStr);

    // 6. Parse GROUP BY
    const groupByMatch = cleanSql.match(/GROUP\s+BY\s+(.+?)(?:ORDER\s+BY|LIMIT|$)/i);
    let groupedRows: Record<string, any>[] = [];
    let isAggregated = selectItems.some(item => item.isAggregate);

    if (groupByMatch) {
      const groupByFields = groupByMatch[1].split(',').map(s => s.trim().replace(/['"`]/g, ''));
      groupedRows = this.executeGroupBy(sourceRows, groupByFields, selectItems);
    } else if (isAggregated) {
      // Aggregating entire dataset into a single row
      groupedRows = this.executeGlobalAggregation(sourceRows, selectItems);
    } else {
      // Simple SELECT projection
      const isSelectAll = selectItems.length === 1 && selectItems[0].column === '*';
      if (isSelectAll) {
        // SELECT * — return full rows as-is
        groupedRows = sourceRows.map(row => ({ ...row }));
      } else {
        groupedRows = sourceRows.map(row => {
          const projected: Record<string, any> = {};
          selectItems.forEach(item => {
            projected[item.alias] = row[item.column];
          });
          return projected;
        });
      }
    }

    // 7. Parse ORDER BY
    const orderByMatch = cleanSql.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/i);
    if (orderByMatch) {
      const orderByStr = orderByMatch[1].trim();
      groupedRows = this.executeOrderBy(groupedRows, orderByStr);
    }

    // 8. Parse LIMIT
    const limitMatch = cleanSql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      groupedRows = groupedRows.slice(0, limitVal);
    }

    const outputColumns = selectItems.map(item => item.alias);

    return {
      columns: outputColumns,
      rows: groupedRows,
      queryTimeMs: Math.round((performance.now() - startTime) * 100) / 100,
      sql: cleanSql,
    };
  }

  private applyWhereFilters(rows: any[], whereClause: string): any[] {
    // Parse standard operators: =, !=, <, >, <=, >=, LIKE, IN
    // Simplified SQL parsing for the simulation
    let filtered = [...rows];
    
    // Split on AND/OR. We'll support simple AND chains for now
    const conditions = whereClause.split(/\s+AND\s+/i);

    conditions.forEach(cond => {
      // Match key = value or key >= value or key <= value
      const match = cond.trim().match(/([a-zA-Z0-9_\-]+)\s*(>=|<=|!=|<>|=|>|<|LIKE|IN)\s*(.+)/i);
      if (!match) return;

      const column = match[1].trim();
      const operator = match[2].trim().toUpperCase();
      let valueStr = match[3].trim().replace(/^['"]|['"]$/g, ''); // strip quotes

      if (operator === '=') {
        filtered = filtered.filter(r => String(r[column]) === valueStr);
      } else if (operator === '!=' || operator === '<>') {
        filtered = filtered.filter(r => String(r[column]) !== valueStr);
      } else if (operator === '>=') {
        const val = isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
        filtered = filtered.filter(r => r[column] >= val);
      } else if (operator === '<=') {
        const val = isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
        filtered = filtered.filter(r => r[column] <= val);
      } else if (operator === '>') {
        const val = isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
        filtered = filtered.filter(r => r[column] > val);
      } else if (operator === '<') {
        const val = isNaN(Number(valueStr)) ? valueStr : Number(valueStr);
        filtered = filtered.filter(r => r[column] < val);
      } else if (operator === 'LIKE') {
        const regexStr = valueStr.replace(/%/g, '.*');
        const regex = new RegExp(`^${regexStr}$`, 'i');
        filtered = filtered.filter(r => regex.test(String(r[column])));
      } else if (operator === 'IN') {
        // e.g., ('a', 'b', 'c')
        const inVals = valueStr
          .replace(/^\(|\)$/g, '')
          .split(',')
          .map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        filtered = filtered.filter(r => inVals.includes(String(r[column])));
      }
    });

    return filtered;
  }

  private parseSelectItems(selectStr: string) {
    // Splits elements taking care of commas inside aggregation functions, like ROUND(SUM(sales), 2)
    // Here we split by commas that are NOT inside parentheses
    const items: string[] = [];
    let current = '';
    let parenCount = 0;
    
    for (let i = 0; i < selectStr.length; i++) {
      const char = selectStr[i];
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === ',' && parenCount === 0) {
        items.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      items.push(current.trim());
    }

    return items.map(item => {
      // Check for alias: "AS alias_name" or "alias_name"
      // e.g., "SUM(sales) AS total" or "SUM(sales) total"
      let expression = item;
      let alias = item;
      
      const asMatch = item.match(/\s+AS\s+([a-zA-Z0-9_\-]+)/i);
      if (asMatch) {
        expression = item.substring(0, asMatch.index).trim();
        alias = asMatch[1].trim();
      } else {
        // Look for space followed by word if no AS
        const spaceIndex = item.lastIndexOf(' ');
        if (spaceIndex !== -1 && !item.includes(')')) {
          expression = item.substring(0, spaceIndex).trim();
          alias = item.substring(spaceIndex + 1).trim();
        }
      }

      // Detect aggregation
      const aggMatch = expression.match(/^(SUM|AVG|COUNT|MAX|MIN)\((.+?)\)$/i);
      const isAggregate = !!aggMatch;
      let aggFunc = '';
      let column = expression;

      if (aggMatch) {
        aggFunc = aggMatch[1].toUpperCase();
        column = aggMatch[2].trim().replace(/['"`]/g, '');
      } else {
        column = expression.replace(/['"`]/g, '');
      }

      // Clean alias
      alias = alias.replace(/['"`]/g, '');

      return {
        original: item,
        expression,
        alias,
        isAggregate,
        aggFunc,
        column,
      };
    });
  }

  private executeGroupBy(rows: any[], groupByFields: string[], selectItems: any[]): Record<string, any>[] {
    const groups: Record<string, any[]> = {};

    rows.forEach(row => {
      const key = groupByFields.map(field => String(row[field])).join('|||');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });

    return Object.entries(groups).map(([key, groupRows]) => {
      const firstRow = groupRows[0];
      const result: Record<string, any> = {};

      selectItems.forEach(item => {
        if (item.isAggregate) {
          result[item.alias] = this.calculateAggregate(groupRows, item.aggFunc, item.column);
        } else {
          // If it's in GROUP BY or just a standard projected column, grab it from the first row
          result[item.alias] = firstRow[item.column];
        }
      });

      return result;
    });
  }

  private executeGlobalAggregation(rows: any[], selectItems: any[]): Record<string, any>[] {
    if (rows.length === 0) {
      const result: Record<string, any> = {};
      selectItems.forEach(item => {
        result[item.alias] = item.aggFunc === 'COUNT' ? 0 : null;
      });
      return [result];
    }

    const result: Record<string, any> = {};
    selectItems.forEach(item => {
      if (item.isAggregate) {
        result[item.alias] = this.calculateAggregate(rows, item.aggFunc, item.column);
      } else {
        result[item.alias] = rows[0][item.column];
      }
    });

    return [result];
  }

  private calculateAggregate(rows: any[], func: string, column: string): number | null {
    if (func === 'COUNT') {
      if (column === '*') return rows.length;
      return rows.filter(r => r[column] !== undefined && r[column] !== null).length;
    }

    const values = rows
      .map(r => Number(r[column]))
      .filter(val => !isNaN(val) && val !== null && val !== undefined);

    if (values.length === 0) return null;

    switch (func) {
      case 'SUM':
        return Math.round(values.reduce((sum, val) => sum + val, 0) * 100) / 100;
      case 'AVG':
        const sum = values.reduce((acc, val) => acc + val, 0);
        return Math.round((sum / values.length) * 100) / 100;
      case 'MAX':
        return Math.max(...values);
      case 'MIN':
        return Math.min(...values);
      default:
        return null;
    }
  }

  private executeOrderBy(rows: Record<string, any>[], orderByStr: string): Record<string, any>[] {
    const parts = orderByStr.split(',').map(s => s.trim());
    const sortingRules = parts.map(part => {
      const match = part.match(/(.+?)\s+(ASC|DESC)$/i);
      let column = part;
      let direction = 'ASC';
      if (match) {
        column = match[1].trim().replace(/['"`]/g, '');
        direction = match[2].toUpperCase();
      }
      return { column, direction };
    });

    return [...rows].sort((a, b) => {
      for (const rule of sortingRules) {
        const valA = a[rule.column];
        const valB = b[rule.column];

        if (valA === valB) continue;

        // Handle string vs number sorts
        const isNumA = typeof valA === 'number';
        const isNumB = typeof valB === 'number';

        if (isNumA && isNumB) {
          return rule.direction === 'ASC' ? valA - valB : valB - valA;
        } else {
          const strA = String(valA);
          const strB = String(valB);
          return rule.direction === 'ASC' ? strA.localeCompare(strB) : strB.localeCompare(strA);
        }
      }
      return 0;
    });
  }
}
