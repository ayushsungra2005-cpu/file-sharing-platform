import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CloudVault | Secure File-Sharing Platform',
  description: 'A private and secure cloud file-sharing platform for college projects.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
