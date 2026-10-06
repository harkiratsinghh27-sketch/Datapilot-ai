export interface FileProfile {
  columns: { name: string; type: string }[];
  rowCount: number;
  stats: Record<string, any>;
  sampleRows: any[][];
}

export interface CachedFile {
  fileId: string;
  filename: string;
  filePath: string;
  profile: FileProfile;
}

// In-memory cache
export const fileCache = new Map<string, CachedFile>();
