import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

export async function middleware(request: NextRequest) {
  // Let service worker requests pass through - Next.js will serve from public/sw.js
  if (request.nextUrl.pathname === '/sw.js') {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const cookieStore = await cookies();
  const response = NextResponse.next();

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

  // Get session first (cookie-based, no network call)
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // Conditionally refresh session only if needed
  // Refresh if: session is missing AND auth cookies exist, OR session is expiring soon (< 5 minutes)
  let currentSession = session;
  if (authCookies.length > 0) {
    const needsRefresh = !currentSession || (currentSession.expires_at && (() => {
      const expiresAt = new Date(currentSession.expires_at * 1000);
      const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
      return expiresAt <= fiveMinutesFromNow;
    })());
    
    if (needsRefresh) {
      try {
        await supabase.auth.refreshSession();
        // Re-fetch session after refresh
        const refreshed = await supabase.auth.getSession();
        if (refreshed.data?.session) {
          currentSession = refreshed.data.session;
        }
      } catch (refreshError) {
        // Ignore refresh errors - session might not be ready yet
        console.log('[Middleware] Session refresh attempt (non-critical):', refreshError instanceof Error ? refreshError.message : 'Unknown error');
      }
    }
  }
  
  // Lazy-load getUser() - only call when needed for admin routes
  // Initialize as null, will be populated only for routes that need it
  let user: any = null;
  let userError: any = null;

  // Log session check in middleware (for debugging)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log('[Middleware] Dashboard access check:', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id,
      sessionError: sessionError?.message,
      path: request.nextUrl.pathname,
      authCookies: authCookies.length,
    });
  }

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
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('id, email, role, auth_id, is_super_admin')
      .eq('auth_id', currentUserId)
      .single();

    if (dbUserError) {
      const userEmail = user?.email || currentSession?.user?.email;
      if (userEmail) {
        const { data: emailUserData } = await supabase
          .from('users')
          .select('id, email, role, auth_id, is_super_admin')
          .eq('email', userEmail)
          .single();
        
        if (emailUserData && emailUserData.role === 'admin' && emailUserData.is_super_admin) {
          return response;
        }
      }
      // Let client-side handle it
      return response;
    }

    if (!userData) {
      return response;
    }

    // Only allow super admins
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
    
    console.log('[Middleware] Admin route access check:', {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      hasSession: !!currentSession,
      userId: user?.id || currentSession?.user?.id,
      userEmail: user?.email || currentSession?.user?.email,
      authCookies: authCookies.length,
      userError: userError?.message,
    });

    // Use authenticated user if available, otherwise fall back to session
    const currentUserId = user?.id || currentSession?.user?.id;
    
    if (!currentUserId) {
      console.log('[Middleware] No user or session for admin route');
      // If we have auth cookies, let it through for client-side check
      // Otherwise redirect to signin
      if (authCookies.length > 0) {
        console.log('[Middleware] Auth cookies present, allowing through for client-side check');
        return response;
      }
      console.log('[Middleware] No user/session and no auth cookies, redirecting to signin');
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Check if user is admin and super admin
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('id, email, role, auth_id, is_super_admin')
      .eq('auth_id', currentUserId)
      .single();

    console.log('[Middleware] Admin role check result:', {
      userData,
      dbUserError: dbUserError?.message,
      queryAuthId: currentUserId,
    });

    if (dbUserError) {
      console.error('[Middleware] Error checking admin role:', dbUserError);
      // If user not found by auth_id, try by email as fallback
      const userEmail = user?.email || currentSession?.user?.email;
      if (userEmail) {
        console.log('[Middleware] Trying fallback lookup by email:', userEmail);
        const { data: emailUserData, error: emailError } = await supabase
          .from('users')
          .select('id, email, role, auth_id, is_super_admin')
          .eq('email', userEmail)
          .single();
        
        console.log('[Middleware] Email lookup result:', { emailUserData, emailError: emailError?.message });
        
        // Only allow admins with super_admin flag
        if (emailUserData && emailUserData.role === 'admin' && emailUserData.is_super_admin) {
          console.log('[Middleware] Found super admin user by email, allowing access');
          return response; // Allow access
        }
      }
      // If error checking role, let client-side handle it (don't block)
      // Client-side will check role and redirect if needed
      console.log('[Middleware] Error checking admin role, allowing through for client-side check');
      return response;
    }

    if (!userData) {
      console.log('[Middleware] No user data found, allowing through for client-side check');
      return response;
    }

    // Allow admins (both organization admins and super admins) to access admin routes
    // Individual pages handle their own access control (super admin vs organization admin)
    if (userData.role !== 'admin') {
      console.log('[Middleware] User is not an admin (role:', userData.role, '), redirecting to dashboard');
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    console.log('[Middleware] Admin access granted, role:', userData.role, 'is_super_admin:', userData.is_super_admin);
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

  // Protect dashboard and project routes
  // Early exit optimization: if no auth cookies exist, redirect immediately (skip all auth calls)
  if (
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/project')
  ) {
    // Early exit: no auth cookies means no session, redirect immediately
    if (authCookies.length === 0) {
      const referer = request.headers.get('referer');
      const isFromSignIn = referer?.includes('/auth/signin');
      
      // Only redirect if not coming from sign-in
      if (!isFromSignIn) {
        console.log('[Middleware] No auth cookies, redirecting to signin');
        return NextResponse.redirect(new URL('/auth/signin', request.url));
      }
      
      // Coming from sign-in but no cookies yet - let it through for client-side check
      console.log('[Middleware] Coming from sign-in with no cookies, allowing through for client-side check');
      return response;
    }
    
    // Auth cookies exist - check session (already fetched above)
    if (!currentSession) {
      // Auth cookies exist but no session - let client-side handle it (no getUser call needed)
      console.log('[Middleware] Auth cookies present but no session, allowing through for client-side session check');
      return response;
    }
    
    // Session exists, allow access
    console.log('[Middleware] Session found, allowing access to:', request.nextUrl.pathname);
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
  ],
};

