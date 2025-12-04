'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress } from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Component that protects routes by checking authentication
 * Redirects to signin if user is not authenticated
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // No session - redirect to signin
          router.push('/auth/signin');
          return;
        }

        // Verify user exists in database via API to avoid RLS recursion
        const userResponse = await fetch('/api/users/me');
        if (!userResponse.ok) {
          // User doesn't exist in database or error - redirect to signin
          router.push('/auth/signin');
          return;
        }

        // User is authenticated
        setIsAuthenticated(true);
      } catch (err) {
        // Error checking auth - redirect to signin
        router.push('/auth/signin');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return <>{children}</>;
}

