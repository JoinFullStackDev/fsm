import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import MUIThemeProvider from '@/components/ThemeProvider';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import LayoutWrapper from '@/components/layout/LayoutWrapper';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FullStack Method™ App',
  description: 'The FullStack Method™ App - Guided system for building products',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <MUIThemeProvider>
          <NotificationProvider>
            <ErrorBoundary>
              <LayoutWrapper>
                {children}
              </LayoutWrapper>
            </ErrorBoundary>
          </NotificationProvider>
        </MUIThemeProvider>
      </body>
    </html>
  );
}

