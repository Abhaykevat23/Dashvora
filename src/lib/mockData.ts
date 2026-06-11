export interface DatasetColumn {
  name: string;
  type: 'number' | 'string' | 'date';
}

export interface Dataset {
  id: string;
  name: string;
  tableName: string;
  columns: DatasetColumn[];
  rowCount: number;
  rows: Record<string, any>[];
  description?: string;
  sourceType?: 'upload' | 'connection' | 'server_upload';
  sourceConnectorId?: string;
}

/**
 * Default datasets — empty.
 * Users start with a clean slate and add data via:
 * 1. Database connections (MySQL, PostgreSQL)
 * 2. CSV/Excel file uploads
 */
export const defaultDatasets: Dataset[] = [];
