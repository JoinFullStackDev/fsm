import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import logger from '@/lib/utils/logger';
import { setCsrfToken } from '@/lib/utils/csrf';

export async function middleware(request: NextRequest) {
  // Let service worker requests pass through - Next.js will serve from public/sw.js
  if (request.nextUrl.pathname === '/sw.js') {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const cookieStore = await cookies();
  let response = NextResponse.next();
  
  // Set CSRF token for page responses (not API routes)
  // Skip API routes and static files
  const isPageRequest = !request.nextUrl.pathname.startsWith('/api') && 
                        !request.nextUrl.pathname.startsWith('/_next') &&
                        !request.nextUrl.pathname.includes('.');
  
  if (isPageRequest) {
    response = await setCsrfToken(response);
  }

  // Add security headers
  const isProduction = process.env.NODE_ENV === 'production';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Content Security Policy
  // Allow Supabase, Stripe, and other trusted sources
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' " + supabaseUrl + " https://api.stripe.com https://*.supabase.co wss://*.supabase.co",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

  response.headers.set('Content-Security-Policy', cspDirectives);
  
  // X-Frame-Options: Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options: Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // Referrer-Policy: Control referrer information
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Restrict browser features
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );
  
  // Strict-Transport-Security: Force HTTPS in production
  if (isProduction) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set(name, value, options);
        } catch (error) {
          // Ignore errors in middleware
        }
      },
      remove(name: string) {
        try {
          cookieStore.set(name, '', { expires: new Date(0) });
        } catch (error) {
          // Ignore errors in middleware
        }
      },
    },
  });

  // Check for auth cookies first (before making any auth calls)
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => 
    c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')
  );

  // Get session (Supabase handles refresh automatically, no need for manual refresh)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  const currentSession = session;
  
  // Lazy-load getUser() - only call when needed for admin routes
  // Initialize as null, will be populated only for routes that need it
  let user: any = null;
  let userError: any = null;

  // Protect global admin routes (super admin only)
  // These routes need getUser() for role verification
  if (request.nextUrl.pathname.startsWith('/global/admin')) {
    // Call getUser() only when needed for admin routes
    if (!user) {
      const userResult = await supabase.auth.getUser();
      user = userResult.data?.user;
      userError = userResult.error;
    }
    
    const currentUserId = user?.id || currentSession?.user?.id;
    
    if (!currentUserId) {
      if (authCookies.length > 0) {
        return response;
      }
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Check if user is super admin
    // Use admin client to avoid RLS recursion
    // Filter by auth_id (unique per user) - this is safe
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: dbUserError } = await adminClient
      .from('users')
      .select('id, email, role, auth_id, is_super_admin, is_company_admin, organization_id')
      .eq('auth_id', currentUserId)
      .single();

    if (dbUserError) {
      // Fail securely - log error and deny access
      logger.error('[Middleware] Authorization check failed for global admin route:', {
        error: dbUserError,
        userId: currentUserId,
        path: request.nextUrl.pathname,
      });
      // Deny access when authorization check fails
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    if (!userData) {
      // Fail securely - no user data found
      logger.warn('[Middleware] User data not found for global admin route:', {
        userId: currentUserId,
        path: request.nextUrl.pathname,
      });
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Only allow super admins (super admins can access all organizations)
    if (userData.role !== 'admin' || !userData.is_super_admin) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
  }

  // Protect admin routes
  // Exclude /admin/templates routes - they handle their own access control based on package settings
  if (request.nextUrl.pathname.startsWith('/admin') && !request.nextUrl.pathname.startsWith('/admin/templates')) {
    // Call getUser() only when needed for admin routes
    if (!user) {
      const userResult = await supabase.auth.getUser();
      user = userResult.data?.user;
      userError = userResult.error;
    }
    
    // Use authenticated user if available, otherwise fall back to session
    const currentUserId = user?.id || currentSession?.user?.id;
    
    if (!currentUserId) {
      // If we have auth cookies, let it through for client-side check
      // Otherwise redirect to signin
      if (authCookies.length > 0) {
        return response;
      }
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Check if user is admin
    // Use admin client to bypass RLS and avoid recursion
    // Filter by auth_id (unique per user) - this is safe
    const { createAdminSupabaseClient } = await import('@/lib/supabaseAdmin');
    const adminClient = createAdminSupabaseClient();
    const { data: userData, error: dbUserError } = await adminClient
      .from('users')
      .select('id, email, role, auth_id, is_super_admin, organization_id')
      .eq('auth_id', currentUserId)
      .single();

    if (dbUserError) {
      // Fail securely - log error and deny access
      logger.error('[Middleware] Authorization check failed for admin route:', {
        error: dbUserError,
        userId: currentUserId,
        path: request.nextUrl.pathname,
      });
      // Deny access when authorization check fails
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    if (!userData) {
      // Fail securely - no user data found
      logger.warn('[Middleware] User data not found for admin route:', {
        userId: currentUserId,
        path: request.nextUrl.pathname,
      });
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Verify user has organization (required for admin routes)
    if (!userData.organization_id) {
      logger.warn('[Middleware] User has no organization_id for admin route:', {
        userId: userData.id,
        path: request.nextUrl.pathname,
      });
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Allow admins (both organization admins and super admins) to access admin routes
    // Individual pages handle their own access control (super admin vs organization admin)
    if (userData.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response; // Explicitly allow access
  }

  // For /admin/templates routes, just check authentication and let the page handle access control
  if (request.nextUrl.pathname.startsWith('/admin/templates')) {
    // Call getUser() for auth check
    if (!user) {
      const userResult = await supabase.auth.getUser();
      user = userResult.data?.user;
      userError = userResult.error;
    }
    
    const currentUserId = user?.id || currentSession?.user?.id;
    
    if (!currentUserId) {
      // If we have auth cookies, let it through for client-side check
      if (authCookies.length > 0) {
        return response;
      }
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Allow authenticated users through - the templates page will check package limits
    return response;
  }

  // Protect all dashboard and authenticated routes
  // These routes require authentication - redirect to signin if not authenticated
  const protectedRoutes = [
    '/dashboard',
    '/project',
    '/organization',
    '/admin',
    '/dashboards',
    '/ops',
    '/my-tasks',
    '/profile',
    '/projects',
  ];
  
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );
  
  if (isProtectedRoute) {
    // Early exit: no auth cookies means no session, redirect immediately
    if (authCookies.length === 0) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    
    // Auth cookies exist - verify session
    if (!currentSession) {
      // No valid session - redirect to signin
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    
    // Session exists, allow access
    // Individual routes/pages can handle user existence checks if needed
  }

  return response;
}

export const config = {
  matcher: [
    '/sw.js',
    '/global/admin/:path*',
    '/admin/:path*',
    '/dashboard/:path*',
    '/project/:path*',
    '/organization/:path*',
    '/dashboards/:path*',
    '/ops/:path*',
    '/my-tasks/:path*',
    '/profile/:path*',
    '/projects/:path*',
  ],
};

