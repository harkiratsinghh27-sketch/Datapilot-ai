import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DataPilot — Business Analytics Platform',
  description: 'Upload your CSV, ask plain-English questions, and generate deterministic calculations, interactive visualisations, and actionable business insights.',
  keywords: ['Business Intelligence', 'Analytics', 'CSV Analysis', 'Data Platform', 'DataPilot'],
  authors: [{ name: 'DataPilot' }]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..700;1,14..32,300..700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--background)] text-[var(--foreground)]">
        {children}
      </body>
    </html>
  );
}
