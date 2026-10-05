export type ColumnDataType =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'categorical'
  | 'identifier'
  | 'currency'
  | 'percentage';

export type SemanticRole =
  | 'revenue'
  | 'sales'
  | 'price'
  | 'quantity'
  | 'cost'
  | 'profit'
  | 'margin'
  | 'order_id'
  | 'customer'
  | 'product'
  | 'category'
  | 'region'
  | 'country'
  | 'date'
  | 'employee'
  | 'campaign'
  | 'expense'
  | 'discount'
  | 'payment'
  | 'dimension'
  | 'measure'
  | 'unknown';

export interface ColumnProfile {
  name: string;
  originalName: string;
  type: ColumnDataType;
  semanticRole: SemanticRole;
  sampleValues: (string | number | boolean | null)[];
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  median?: number;
  stdDev?: number;
  isNumeric: boolean;
  isDate: boolean;
  isCategorical: boolean;
}

export interface DatasetProfile {
  fileName: string;
  fileSize: number;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  duplicateRowsCount: number;
  missingValuesCount: number;
  summary: string;
  keyMeasures: string[];
  keyDimensions: string[];
  dateColumn?: string;
}

export type ChartType = 'bar' | 'horizontal_bar' | 'line' | 'area' | 'donut' | 'scatter';

export interface MetricCard {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtext?: string;
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  xAxis: string;
  yAxis: string;
  secondaryYAxis?: string;
  data: Record<string, any>[];
  colorPalette?: string[];
  unit?: string;
}

export interface TableConfig {
  columns: string[];
  rows: Record<string, any>[];
  totalCount?: number;
}

export interface AIAnalysisResponse {
  answer: string;
  requestType?: 'DATA_ANALYSIS' | 'GENERAL_KNOWLEDGE' | 'CURRENT_INFORMATION' | 'MIXED' | 'ERROR';
  metrics?: MetricCard[];
  table?: TableConfig;
  chart?: ChartConfig;
  insights?: string[];
  warnings?: string[];
  followUpQuestions?: string[];
  sources?: string[];
  calculation?: {
    dataUsed: string[];
    formula: string;
    steps: string[];
  };
  query?: string;
  calculationPlan?: string;
  confidence: 'high' | 'medium' | 'low';
  executionTimeMs?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  analysis?: AIAnalysisResponse;
  isStreaming?: boolean;
  error?: string;
}

export interface ConversationContext {
  lastIntent?: string;
  lastMeasures?: string[];
  lastDimensions?: string[];
  lastFilters?: Record<string, any>;
  lastQuery?: string;
  historySummary?: string;
}
