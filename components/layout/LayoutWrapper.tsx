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
const PUBLIC_ROUTES = ['/pricing', '/affiliates']; // Public pages that don't need dashboard layout
const GLOBAL_ADMIN_ROUTES = ['/global/admin'];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();

  // Check if current route is an auth route, standalone route, landing page, public route, or global admin route
  const isAuthRoute = pathname && AUTH_ROUTES.some(route => pathname.startsWith(route));
  const isStandaloneRoute = pathname && STANDALONE_ROUTES.some(route => pathname.startsWith(route));
  const isLandingRoute = pathname && LANDING_ROUTES.includes(pathname);
  const isPublicRoute = pathname && PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  const isGlobalAdminRoute = pathname && GLOBAL_ADMIN_ROUTES.some(route => pathname.startsWith(route));

  // Don't apply MainLayout to auth routes, standalone routes, landing page, public routes, or global admin routes
  if (isAuthRoute || isStandaloneRoute || isLandingRoute || isPublicRoute || isGlobalAdminRoute) {
    return <>{children}</>;
  }

  // Apply MainLayout to all other routes
  return <MainLayout>{children}</MainLayout>;
}

