import type { Metadata } from 'next';
import { Inter, Rubik } from 'next/font/google';
import MUIThemeProvider from '@/components/ThemeProvider';
import { NotificationProvider } from '@/components/providers/NotificationProvider';
import { OrganizationProvider } from '@/components/providers/OrganizationProvider';
import { UserProvider } from '@/components/providers/UserProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import LayoutWrapper from '@/components/layout/LayoutWrapper';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });
const rubik = Rubik({ 
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-rubik',
});

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
      <body className={`${inter.className} ${rubik.variable}`}>
        <MUIThemeProvider>
          <UserProvider>
            <NotificationProvider>
              <OrganizationProvider>
                <ErrorBoundary>
                  <LayoutWrapper>
                    {children}
                  </LayoutWrapper>
                </ErrorBoundary>
              </OrganizationProvider>
            </NotificationProvider>
          </UserProvider>
        </MUIThemeProvider>
      </body>
    </html>
  );
}

