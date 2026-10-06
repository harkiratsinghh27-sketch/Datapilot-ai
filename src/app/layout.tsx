import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Data Desk',
  description: 'Upload your CSV, ask plain-English questions, and generate deterministic calculations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full m-0 p-0 antialiased bg-[var(--bg)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
