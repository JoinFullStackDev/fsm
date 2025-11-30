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

    // Check if user is admin and super admin
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('id, email, role, auth_id, is_super_admin')
      .eq('auth_id', currentUserId)
      .single();

    if (dbUserError) {
      // If user not found by auth_id, try by email as fallback
      const userEmail = user?.email || currentSession?.user?.email;
      if (userEmail) {
        const { data: emailUserData, error: emailError } = await supabase
          .from('users')
          .select('id, email, role, auth_id, is_super_admin')
          .eq('email', userEmail)
          .single();
        
        // Only allow admins with super_admin flag
        if (emailUserData && emailUserData.role === 'admin' && emailUserData.is_super_admin) {
          return response; // Allow access
        }
      }
      // If error checking role, let client-side handle it (don't block)
      // Client-side will check role and redirect if needed
      return response;
    }

    if (!userData) {
      return response;
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

