// Evade Turbopack static analysis by requiring dynamically
const duckdb = typeof window === 'undefined' ? require(String('duckdb')) : null;

const db = duckdb ? new duckdb.Database(':memory:') : null;

// Helper to convert BigInt to Number
function serializeRow(row: any) {
  const obj: any = {};
  for (const key in row) {
    if (typeof row[key] === 'bigint') {
      obj[key] = Number(row[key]);
    } else {
      obj[key] = row[key];
    }
  }
  return obj;
}

export function runQuery(sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err: any, res: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(res.map(serializeRow));
      }
    });
  });
}
