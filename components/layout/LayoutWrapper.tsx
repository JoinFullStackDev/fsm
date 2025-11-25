'use client';

import { usePathname } from 'next/navigation';
import MainLayout from './MainLayout';

interface LayoutWrapperProps {
  children: React.ReactNode;
}

// Routes that should NOT have the MainLayout (sidebar + topbar)
const AUTH_ROUTES = ['/auth', '/signin', '/signup', '/forgot-password', '/reset-password', '/confirm'];
const STANDALONE_ROUTES = ['/reports'];
const LANDING_ROUTES = ['/'];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();

  // Check if current route is an auth route, standalone route, or landing page
  const isAuthRoute = pathname && AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isStandaloneRoute = pathname && STANDALONE_ROUTES.some(route => pathname.startsWith(route));
  const isLandingRoute = pathname && LANDING_ROUTES.includes(pathname);

  // Don't apply MainLayout to auth routes, standalone routes, or landing page
  if (isAuthRoute || isStandaloneRoute || isLandingRoute) {
    return <>{children}</>;
  }

  // Apply MainLayout to all other routes
  return <MainLayout>{children}</MainLayout>;
}

