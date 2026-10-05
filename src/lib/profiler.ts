import { ColumnDataType, ColumnProfile, DatasetProfile, SemanticRole } from '@/types/dataset';

// Helper to determine if a string looks like a currency
function isCurrencyString(val: string): boolean {
  return /^[$\u20B9\u20AC\u00A3\u00A5]?\s*-?\d+([.,]\d+)?\s*[$\u20B9\u20AC\u00A3\u00A5]?$/.test(val.trim());
}

// Clean currency/numeric string to pure number
export function cleanNumericValue(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$₹€£¥,\s%]/g, '').trim();
    if (cleaned === '') return null;
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
}

// Helper to check valid date
function isDateString(val: string): boolean {
  if (!val || typeof val !== 'string' || val.length < 4) return false;
  // Common date formats: YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, ISO strings
  const dateRegex = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(T|\s)?.*$/;
  const usDateRegex = /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}(T|\s)?.*$/;
  if (!dateRegex.test(val) && !usDateRegex.test(val)) return false;
  const parsed = Date.parse(val);
  return !isNaN(parsed);
}

// Infer semantic role from column name and data characteristics
export function inferSemanticRole(colName: string, type: ColumnDataType, sampleValues: any[]): SemanticRole {
  const norm = colName.toLowerCase().replace(/[^a-z0-9]/g, '_').trim();
  const isNumeric = (type === 'integer' || type === 'decimal' || type === 'currency');

  // 1. Date / Time (can be date type or string formatted date)
  if (
    type === 'date' || 
    (type as string) === 'datetime' || 
    norm.includes('date') || 
    norm.includes('timestamp') || 
    norm.includes('day') || 
    norm.includes('month') || 
    norm.includes('year')
  ) {
    return 'date';
  }

  // 2. Order ID / Transaction ID
  if (
    norm.includes('order_id') ||
    norm.includes('orderid') ||
    norm.includes('order_no') ||
    norm.includes('invoice') ||
    norm.includes('txn') ||
    norm.includes('transaction_id') ||
    (norm === 'id' && !isNumeric)
  ) {
    return 'order_id';
  }

  // 3. Dimensions & Non-numeric entities
  if (!isNumeric) {
    // Channel / Source / Campaign
    if (norm.includes('channel') || norm.includes('campaign') || norm.includes('source') || norm.includes('medium') || norm.includes('ad_')) {
      return 'campaign';
    }

    // Geographic Dimensions: Country / City / State / Region
    if (
      norm.includes('country') ||
      norm.includes('nation') ||
      norm.includes('state') ||
      norm.includes('city') ||
      norm.includes('province') ||
      norm.includes('zip') ||
      norm.includes('postal')
    ) {
      return 'country';
    }

    if (
      norm.includes('region') ||
      norm.includes('territory') ||
      norm.includes('zone') ||
      norm.includes('area') ||
      norm.includes('store') ||
      norm.includes('location') ||
      norm.includes('branch') ||
      norm.includes('hub') ||
      norm.includes('market')
    ) {
      return 'region';
    }

    // Customer
    if (
      norm.includes('customer') ||
      norm.includes('client') ||
      norm.includes('buyer') ||
      norm.includes('account_name') ||
      norm.includes('user_name')
    ) {
      return 'customer';
    }

    // Employee / Rep
    if (
      norm.includes('employee') ||
      norm.includes('rep') ||
      norm.includes('salesperson') ||
      norm.includes('agent') ||
      norm.includes('manager')
    ) {
      return 'employee';
    }

    // Product
    if (
      norm.includes('product') ||
      norm.includes('item') ||
      norm.includes('sku') ||
      norm.includes('merchandise') ||
      (norm.includes('part') && !norm.includes('partner'))
    ) {
      return 'product';
    }

    // Category / Segment
    if (
      norm.includes('category') ||
      norm.includes('department') ||
      norm.includes('segment') ||
      norm.includes('cohort') ||
      norm.includes('type') ||
      norm.includes('group')
    ) {
      return 'category';
    }

    // Payment Method
    if (norm.includes('payment') || norm.includes('tender') || norm.includes('billing')) {
      return 'payment';
    }

    return 'dimension';
  }

  // 4. Numeric Measures (guaranteed isNumeric = true)
  // Discount
  if (norm.includes('discount') || norm.includes('rebate') || norm.includes('refund') || norm.includes('promo')) {
    return 'discount';
  }

  // Profit / Margin
  if (norm.includes('profit') || norm.includes('net_income') || norm.includes('earnings') || norm.includes('margin')) {
    return norm.includes('margin') ? 'margin' : 'profit';
  }

  // Cost / Expense
  if (norm.includes('cost') || norm.includes('cogs') || norm.includes('expense') || norm.includes('spend')) {
    return norm.includes('expense') ? 'expense' : 'cost';
  }

  // Price
  if (norm.includes('price') || norm.includes('unit_price') || norm.includes('rate') || norm.includes('fee')) {
    return 'price';
  }

  // Quantity / Volume (Note: strictly exclude country/county false positives)
  if (
    norm.includes('qty') ||
    norm.includes('quantity') ||
    norm.includes('units') ||
    norm.includes('volume') ||
    (norm.includes('count') && !norm.includes('country') && !norm.includes('county') && !norm.includes('account'))
  ) {
    return 'quantity';
  }

  // Revenue / Sales
  if (
    (norm.includes('revenue') ||
     norm.includes('sales') ||
     norm.includes('turnover') ||
     norm.includes('gross') ||
     norm.includes('amount') ||
     norm.includes('total_spend')) &&
    !norm.includes('channel') &&
    !norm.includes('rep')
  ) {
    return 'revenue';
  }

  return 'measure';
}

// Compute comprehensive statistics for a list of numbers
function computeNumericStats(numbers: number[]): {
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
} {
  if (numbers.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = numbers.reduce((acc, val) => acc + val, 0);
  const mean = sum / numbers.length;

  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return {
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100
  };
}

// Profile the entire dataset
export function profileDataset(
  fileName: string,
  fileSize: number,
  rows: Record<string, any>[]
): DatasetProfile {
  const rowCount = rows.length;
  if (rowCount === 0) {
    return {
      fileName,
      fileSize,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      duplicateRowsCount: 0,
      missingValuesCount: 0,
      summary: 'Dataset is empty.',
      keyMeasures: [],
      keyDimensions: []
    };
  }

  const colNames = Object.keys(rows[0]);
  const columnCount = colNames.length;

  let totalMissingValues = 0;
  const columns: ColumnProfile[] = [];

  // Track duplicate rows with a hashed set (using first 5000 rows for high performance)
  const sampleLimit = Math.min(rowCount, 5000);
  const rowHashes = new Set<string>();
  let duplicateCount = 0;

  for (let i = 0; i < sampleLimit; i++) {
    const hash = JSON.stringify(rows[i]);
    if (rowHashes.has(hash)) {
      duplicateCount++;
    } else {
      rowHashes.add(hash);
    }
  }

  // Profile each column
  for (const colName of colNames) {
    let nullCount = 0;
    const values: any[] = [];
    const numericValues: number[] = [];
    let dateMatchCount = 0;
    let integerMatchCount = 0;
    let decimalMatchCount = 0;
    let currencyMatchCount = 0;
    let booleanMatchCount = 0;
    const uniqueValSet = new Set<string>();

    for (let r = 0; r < rowCount; r++) {
      const rawVal = rows[r][colName];
      if (rawVal === null || rawVal === undefined || rawVal === '') {
        nullCount++;
      } else {
        const strVal = String(rawVal).trim();
        values.push(rawVal);
        uniqueValSet.add(strVal);

        // Date check
        if (isDateString(strVal)) {
          dateMatchCount++;
        }

        // Currency check
        if (isCurrencyString(strVal) && (strVal.includes('$') || strVal.includes('₹') || strVal.includes('€') || strVal.includes('£'))) {
          currencyMatchCount++;
        }

        // Number check
        const num = cleanNumericValue(rawVal);
        if (num !== null && !isNaN(num)) {
          numericValues.push(num);
          if (Number.isInteger(num)) {
            integerMatchCount++;
          } else {
            decimalMatchCount++;
          }
        }

        // Boolean check
        const lower = strVal.toLowerCase();
        if (['true', 'false', 'yes', 'no', 't', 'f', '1', '0'].includes(lower)) {
          booleanMatchCount++;
        }
      }
    }

    totalMissingValues += nullCount;
    const nonNullCount = rowCount - nullCount;
    const sampleValues = values.slice(0, 5);

    // Determine type
    let type: ColumnDataType = 'string';
    if (nonNullCount > 0) {
      if (currencyMatchCount / nonNullCount > 0.8) {
        type = 'currency';
      } else if (dateMatchCount / nonNullCount > 0.8) {
        type = 'date';
      } else if (numericValues.length / nonNullCount > 0.85) {
        type = decimalMatchCount > 0 ? 'decimal' : 'integer';
      } else if (booleanMatchCount === nonNullCount && uniqueValSet.size <= 2) {
        type = 'boolean';
      } else if (uniqueValSet.size <= Math.min(50, Math.ceil(rowCount * 0.15))) {
        type = 'categorical';
      } else if (colName.toLowerCase().includes('id') || colName.toLowerCase().includes('code')) {
        type = 'identifier';
      }
    }

    const isNumeric = type === 'integer' || type === 'decimal' || type === 'currency';
    const isDate = type === 'date' || (type as string) === 'datetime';
    const isCategorical = type === 'categorical';

    const colProfile: ColumnProfile = {
      name: colName,
      originalName: colName,
      type,
      semanticRole: inferSemanticRole(colName, type, sampleValues),
      sampleValues,
      nullCount,
      nullPercentage: rowCount > 0 ? Math.round((nullCount / rowCount) * 1000) / 10 : 0,
      uniqueCount: uniqueValSet.size,
      isNumeric,
      isDate,
      isCategorical
    };

    if (isNumeric && numericValues.length > 0) {
      const stats = computeNumericStats(numericValues);
      colProfile.min = stats.min;
      colProfile.max = stats.max;
      colProfile.mean = stats.mean;
      colProfile.median = stats.median;
      colProfile.stdDev = stats.stdDev;
    } else if (isDate && values.length > 0) {
      // Find min & max date
      const validDates = values.map(v => Date.parse(v)).filter(d => !isNaN(d)).sort((a, b) => a - b);
      if (validDates.length > 0) {
        colProfile.min = new Date(validDates[0]).toISOString().split('T')[0];
        colProfile.max = new Date(validDates[validDates.length - 1]).toISOString().split('T')[0];
      }
    }

    columns.push(colProfile);
  }

  // Second-pass: Bulletproof semantic role resolution using dataset values
  const resolved = resolveBusinessColumns({ columns, rowCount, columnCount } as any, rows);

  for (const c of columns) {
    if (c.name === resolved.revenueCol) {
      c.semanticRole = 'revenue';
      c.isNumeric = true;
    } else if (c.name === resolved.profitCol) {
      c.semanticRole = 'profit';
      c.isNumeric = true;
    } else if (c.name === resolved.quantityCol) {
      c.semanticRole = 'quantity';
      c.isNumeric = true;
    } else if (c.name === resolved.productCol) {
      c.semanticRole = 'product';
      c.isNumeric = false;
    } else if (c.name === resolved.categoryCol) {
      c.semanticRole = 'category';
      c.isNumeric = false;
    } else if (c.name === resolved.regionCol) {
      c.semanticRole = 'region';
      c.isNumeric = false;
    } else if (c.name === resolved.channelCol) {
      c.semanticRole = 'campaign';
      c.isNumeric = false;
    } else if (c.name === resolved.dateCol) {
      c.semanticRole = 'date';
      c.isDate = true;
    } else if (c.name === resolved.priceCol) {
      c.semanticRole = 'price';
      c.isNumeric = true;
    } else if (c.name === resolved.costCol) {
      c.semanticRole = 'cost';
      c.isNumeric = true;
    }
  }

  // Identify key measures: strictly numeric columns
  const keyMeasures = columns
    .filter(c => c.isNumeric)
    .map(c => c.name);

  // Identify key dimensions: strictly non-numeric columns
  const keyDimensions = columns
    .filter(c => !c.isNumeric && !c.isDate && c.type !== 'identifier')
    .map(c => c.name);

  const dateCol = resolved.dateCol || columns.find(c => c.semanticRole === 'date' || c.isDate)?.name;

  const summary = `Dataset contains ${rowCount.toLocaleString()} rows and ${columnCount} columns with ${keyMeasures.length} measures and ${keyDimensions.length} dimensions.`;

  return {
    fileName,
    fileSize,
    rowCount,
    columnCount,
    columns,
    duplicateRowsCount: duplicateCount,
    missingValuesCount: totalMissingValues,
    summary,
    keyMeasures,
    keyDimensions,
    dateColumn: dateCol
  };
}

export interface ResolvedBusinessColumns {
  revenueCol: string;
  profitCol?: string;
  costCol?: string;
  quantityCol?: string;
  priceCol?: string;
  discountCol?: string;
  productCol: string;
  customerCol?: string;
  regionCol?: string;
  categoryCol?: string;
  channelCol?: string;
  dateCol?: string;
  orderIdCol?: string;
}

export function resolveBusinessColumns(
  profile: DatasetProfile | { columns: ColumnProfile[]; rowCount?: number; columnCount?: number; dateColumn?: string },
  dataset?: Record<string, any>[]
): ResolvedBusinessColumns {
  const sampleRow = dataset && dataset.length > 0 ? dataset[0] : null;

  // Determine if a column actually holds numeric data
  const isColNumeric = (colName: string): boolean => {
    const colProf = profile.columns?.find(c => c.name === colName);
    if (colProf && colProf.isNumeric) return true;
    if (sampleRow && typeof sampleRow[colName] === 'number') return true;
    if (dataset && dataset.length > 0) {
      for (let i = 0; i < Math.min(dataset.length, 25); i++) {
        const val = dataset[i][colName];
        if (typeof val === 'number') return true;
        if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val.replace(/[$€£¥,]/g, '')))) return true;
      }
    }
    return false;
  };

  const colNames = profile.columns ? profile.columns.map(c => c.name) : (sampleRow ? Object.keys(sampleRow) : []);
  const numericCols = colNames.filter(isColNumeric);
  const textCols = colNames.filter(c => !isColNumeric(c));

  // 1. REVENUE COLUMN
  // Never select channels, reps, discounts, taxes, or non-numeric fields
  const revCol =
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('net_rev') || n.includes('total_rev') || n === 'revenue') && !n.includes('channel');
    }) ||
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('gross_sales') || n.includes('total_sales') || n.includes('net_sales')) && !n.includes('channel');
    }) ||
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (
        (n.includes('revenue') || n.includes('sales') || n.includes('turnover') || n.includes('amount')) &&
        !n.includes('channel') &&
        !n.includes('rep') &&
        !n.includes('agent') &&
        !n.includes('discount') &&
        !n.includes('profit') &&
        !n.includes('cost') &&
        !n.includes('tax') &&
        !n.includes('shipping')
      );
    }) ||
    numericCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'revenue';
    }) ||
    numericCols[0] ||
    'Revenue';

  // 2. PROFIT COLUMN
  const profitCol =
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('profit') || n.includes('margin_dollar') || n.includes('earnings') || n.includes('net_income')) && !n.includes('pct') && !n.includes('percent');
    }) ||
    numericCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'profit';
    });

  // 3. QUANTITY / UNITS COLUMN
  const qtyCol =
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (
        (n.includes('units_sold') || n.includes('unit_sold') || n.includes('units') || n.includes('qty') || n.includes('quantity') || n.includes('volume')) &&
        !n.includes('price') &&
        !n.includes('country') &&
        !n.includes('county') &&
        !n.includes('account')
      );
    }) ||
    numericCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'quantity';
    });

  // 4. PRODUCT COLUMN
  const prodCol =
    textCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('product_name') || n.includes('product_title') || n.includes('item_name')) && !n.includes('category');
    }) ||
    textCols.find(c => {
      const n = c.toLowerCase();
      return (
        (n.includes('product') || n.includes('item') || n.includes('sku') || n.includes('merchandise')) &&
        !n.includes('category') &&
        !n.includes('channel') &&
        !n.includes('id')
      );
    }) ||
    textCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'product';
    }) ||
    textCols[0] ||
    'Product';

  // 5. CATEGORY COLUMN
  const catCol =
    textCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('category') || n.includes('department') || n.includes('dept') || n.includes('segment')) && !n.includes('channel');
    }) ||
    textCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'category';
    });

  // 6. REGION / COUNTRY / STORE LOCATION COLUMN
  const regCol =
    textCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('country') || n.includes('store') || n.includes('location') || n.includes('region') || n.includes('state') || n.includes('city') || n.includes('branch') || n.includes('hub')) && !n.includes('channel');
    }) ||
    textCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'region' || prof?.semanticRole === 'country';
    });

  // 7. CHANNEL COLUMN
  const chanCol = textCols.find(c => c.toLowerCase().includes('channel') || c.toLowerCase().includes('source') || c.toLowerCase().includes('medium'));

  // 8. CUSTOMER COLUMN
  const customerCol = textCols.find(c => {
    const n = c.toLowerCase();
    return (n.includes('customer') || n.includes('client') || n.includes('buyer') || n.includes('account')) && !n.includes('segment');
  });

  // 9. DATE COLUMN
  const dateCol =
    (profile as DatasetProfile).dateColumn ||
    profile.columns?.find(c => c.isDate || c.semanticRole === 'date')?.name ||
    colNames.find(c => {
      const n = c.toLowerCase();
      return n.includes('date') || n.includes('time') || n.includes('day') || n.includes('month') || n.includes('timestamp');
    });

  // 10. PRICE COLUMN
  const priceCol =
    numericCols.find(c => {
      const n = c.toLowerCase();
      return (n.includes('unit_price') || n.includes('price') || n.includes('rate') || n.includes('cost_per')) && !n.includes('gross') && !n.includes('total');
    }) ||
    numericCols.find(c => {
      const prof = profile.columns?.find(p => p.name === c);
      return prof?.semanticRole === 'price';
    });

  // 11. COST COLUMN
  const costCol = numericCols.find(c => {
    const n = c.toLowerCase();
    return (n.includes('cost') || n.includes('cogs') || n.includes('expense') || n.includes('spend')) && !n.includes('revenue') && !n.includes('profit');
  });

  // 12. DISCOUNT COLUMN
  const discountCol = numericCols.find(c => c.toLowerCase().includes('discount') || c.toLowerCase().includes('rebate') || c.toLowerCase().includes('refund'));

  return {
    revenueCol: revCol,
    profitCol,
    costCol,
    quantityCol: qtyCol,
    priceCol,
    discountCol,
    productCol: prodCol,
    customerCol,
    regionCol: regCol,
    categoryCol: catCol,
    channelCol: chanCol,
    dateCol
  };
}
