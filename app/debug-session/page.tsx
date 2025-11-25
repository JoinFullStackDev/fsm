'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  Paper,
  Divider,
  CircularProgress,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';

export default function DebugSessionPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Check admin access
  useEffect(() => {
    if (roleLoading) return;
    
    if (role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    
    setCheckingAccess(false);
  }, [role, roleLoading, router]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      const { data: userData, error: userError } = session
        ? await supabase
            .from('users')
            .select('*')
            .eq('auth_id', session.user.id)
            .single()
        : { data: null, error: null };

      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);

      setDebugInfo({
        timestamp: new Date().toISOString(),
        session: {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          emailConfirmed: !!session?.user?.email_confirmed_at,
          lastSignIn: session?.user?.last_sign_in_at,
          error: sessionError?.message,
        },
        userRecord: {
          exists: !!userData,
          data: userData,
          error: userError?.message,
        },
        cookies: {
          supabaseAuthToken: cookies['sb-access-token'] ? 'EXISTS' : 'MISSING',
          supabaseRefreshToken: cookies['sb-refresh-token'] ? 'EXISTS' : 'MISSING',
          allCookies: Object.keys(cookies).filter(k => k.includes('supabase') || k.includes('sb-')),
        },
        localStorage: {
          signinDebug: localStorage.getItem('signin_debug'),
        },
      });
    };

    checkSession();
  }, [supabase]);

  const handleClearStorage = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  if (checkingAccess || roleLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Session Debug Information (Admin Only)
      </Typography>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Debug Data</Typography>
            <Button variant="outlined" onClick={handleClearStorage}>
              Clear Storage & Reload
            </Button>
          </Box>

          {debugInfo ? (
            <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </Paper>
          ) : (
            <Typography>Loading debug information...</Typography>
          )}

          <Divider sx={{ my: 3 }} />

          <Alert severity="info">
            <Typography variant="body2">
              <strong>What to check:</strong>
              <br />
              1. Session exists: Should be true
              <br />
              2. User record exists: Should be true
              <br />
              3. Cookies: Should have supabase auth tokens
              <br />
              4. Email confirmed: Should be true
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    </Container>
  );
}

