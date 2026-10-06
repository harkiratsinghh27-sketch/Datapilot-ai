'use client';

import { useState } from 'react';
import { UploadView } from '@/components/UploadView';
import { WorkspaceView } from '@/components/WorkspaceView';

export default function Page() {
  const [fileData, setFileData] = useState<any>(null);

  if (!fileData) {
    return <UploadView onUploadSuccess={setFileData} />;
  }

  return <WorkspaceView fileData={fileData} onReset={() => setFileData(null)} />;
}
