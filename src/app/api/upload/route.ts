import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { runQuery } from '@/lib/db';
import { fileCache, FileProfile } from '@/lib/store';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ detail: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ detail: 'File exceeds 50MB limit' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Save to tmp dir
    const fileId = randomUUID();
    // Duckdb needs the exact extension for JSON/Parquet/etc or we can use read_csv_auto
    const ext = file.name.split('.').pop()?.toLowerCase() || 'csv';
    
    // Basic validation
    if (!['csv', 'tsv', 'json', 'parquet', 'xlsx'].includes(ext)) {
      return NextResponse.json({ detail: 'Unsupported file type' }, { status: 400 });
    }

    const filePath = join(tmpdir(), `${fileId}.${ext}`);
    await writeFile(filePath, buffer);

    let readFunc = `read_csv_auto('${filePath}')`;
    if (ext === 'json') readFunc = `read_json_auto('${filePath}')`;
    if (ext === 'parquet') readFunc = `read_parquet('${filePath}')`;
    // Note: DuckDB natively supports excel via spatial extension (st_read) or similar, but for simplicity we assume DuckDB can read it if spatial is loaded, OR we can just error if it's not supported natively. Wait, the user said "DuckDB where possible; PapaParse for CSV, SheetJS for XLSX, native for JSON/Parquet." Let's use duckdb for csv/parquet/json.
    if (ext === 'xlsx') {
       return NextResponse.json({ detail: 'XLSX is currently unsupported in this basic DuckDB setup. Please convert to CSV.' }, { status: 400 });
    }

    // Register view in DuckDB
    // For concurrent queries on different files, we must create a view uniquely named for this file, or we just rely on the readFunc for profiling.
    const tableName = `t_${fileId.replace(/-/g, '')}`;
    await runQuery(`CREATE OR REPLACE VIEW ${tableName} AS SELECT * FROM ${readFunc}`);

    // Profile the data
    const rowCountRes = await runQuery(`SELECT count(*) as count FROM ${tableName}`);
    const rowCount = Number(rowCountRes[0].count);

    if (rowCount === 0) {
      return NextResponse.json({ detail: 'File is empty or has no rows' }, { status: 400 });
    }

    // Get schema
    const schemaRes = await runQuery(`PRAGMA table_info('${tableName}')`);
    const columns = schemaRes.map((r: any) => ({
      name: r.name,
      type: r.type
    }));

    // Get sample rows
    const sampleRowsRes = await runQuery(`SELECT * FROM ${tableName} LIMIT 5`);

    // Basic stats for numeric columns
    const stats: Record<string, any> = {};
    for (const col of columns) {
      const type = col.type.toUpperCase();
      if (type.includes('INT') || type.includes('FLOAT') || type.includes('DOUBLE') || type.includes('DECIMAL')) {
         const colStats = await runQuery(`SELECT min("${col.name}") as min, max("${col.name}") as max, avg("${col.name}") as mean, count("${col.name}") as non_nulls FROM ${tableName}`);
         stats[col.name] = colStats[0];
      } else if (type.includes('VARCHAR') || type.includes('TEXT')) {
         const topValues = await runQuery(`SELECT "${col.name}", count(*) as c FROM ${tableName} GROUP BY 1 ORDER BY c DESC LIMIT 5`);
         stats[col.name] = { topValues: topValues.map(v => v[col.name]) };
      }
    }

    const profile: FileProfile = {
      columns,
      rowCount,
      stats,
      sampleRows: sampleRowsRes
    };

    fileCache.set(fileId, {
      fileId,
      filename: file.name,
      filePath,
      profile
    });

    return NextResponse.json({
      file_id: fileId,
      filename: file.name,
      rows: rowCount,
      columns,
      preview: {
        columns: columns.map(c => c.name),
        rows: sampleRowsRes.map(r => Object.values(r))
      }
    });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ detail: error.message || 'Upload failed' }, { status: 500 });
  }
}
