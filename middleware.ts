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

  // Check for auth cookies first (before trying to refresh)
  const allCookies = cookieStore.getAll();
  const authCookies = allCookies.filter(c => 
    c.name.includes('supabase') || c.name.includes('sb-') || c.name.includes('auth')
  );

  // Try to refresh session if we have auth cookies (but don't fail if it doesn't work)
  // This is important after sign-in when cookies are being set
  if (authCookies.length > 0) {
    try {
      await supabase.auth.refreshSession();
    } catch (refreshError) {
      // Ignore refresh errors - session might not be ready yet
      console.log('[Middleware] Session refresh attempt (non-critical):', refreshError instanceof Error ? refreshError.message : 'Unknown error');
    }
  }
  
  // Get user - this authenticates with Supabase Auth server (more secure than getSession)
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  
  // Get session for compatibility
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  // Log session check in middleware (for debugging)
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    console.log('[Middleware] Dashboard access check:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message,
      path: request.nextUrl.pathname,
      authCookies: authCookies.length,
    });
  }

  // Protect global admin routes (super admin only)
  if (request.nextUrl.pathname.startsWith('/global/admin')) {
    const currentUserId = user?.id || session?.user?.id;
    
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
      const userEmail = user?.email || session?.user?.email;
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
    console.log('[Middleware] Admin route access check:', {
      path: request.nextUrl.pathname,
      hasUser: !!user,
      hasSession: !!session,
      userId: user?.id || session?.user?.id,
      userEmail: user?.email || session?.user?.email,
      authCookies: authCookies.length,
      userError: userError?.message,
    });

    // Use authenticated user if available, otherwise fall back to session
    const currentUserId = user?.id || session?.user?.id;
    
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
      const userEmail = user?.email || session?.user?.email;
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
    const currentUserId = user?.id || session?.user?.id;
    
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
  // Note: We're more lenient here - let client-side handle the session check
  // This prevents redirect loops when cookies haven't propagated yet
  if (
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/project')
  ) {
    if (!session && !user) {
      // Check if this is a redirect from sign-in (allow it to pass through)
      const referer = request.headers.get('referer');
      const isFromSignIn = referer?.includes('/auth/signin');
      
      // Check for auth cookies that might indicate a session exists
      // (authCookies already defined above)
      
      console.log('[Middleware] No session/user for protected route:', {
        path: request.nextUrl.pathname,
        referer,
        isFromSignIn,
        hasAuthCookies: authCookies.length > 0,
        cookieNames: cookieStore.getAll().map(c => c.name),
        hasUser: !!user,
        hasSession: !!session,
      });
      
      // ALWAYS let it through if we have auth cookies - session might not be ready yet
      // Client-side will handle the actual session check and redirect if needed
      if (authCookies.length > 0) {
        console.log('[Middleware] Auth cookies present, allowing through for client-side session check');
        return response;
      }
      
      // Only redirect if no auth cookies and not from sign-in
      if (!isFromSignIn) {
        console.log('[Middleware] No auth cookies and not from sign-in, redirecting to signin');
        return NextResponse.redirect(new URL('/auth/signin', request.url));
      }
      
      // Coming from sign-in but no cookies yet - let it through anyway
      // The client-side will handle the redirect if session doesn't establish
      console.log('[Middleware] Coming from sign-in, allowing through for client-side check');
      return response;
    }
    
    // If we have a session or user, allow access
    console.log('[Middleware] Session/user found, allowing access to:', request.nextUrl.pathname);
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

