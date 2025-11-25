'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Alert,
  Card,
  CardContent,
  Button,
  CircularProgress,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';

export default function ConfirmPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const confirmEmail = async () => {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const type = params.get('type');

      if (!token) {
        setStatus('error');
        setMessage('Invalid confirmation link');
        return;
      }

      if (type === 'recovery') {
        // Password reset - redirect to reset page
        router.push('/auth/reset-password');
        return;
      }

      // Email confirmation
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      });

      if (error) {
        setStatus('error');
        setMessage(error.message);
        return;
      }

      setStatus('success');
      setMessage('Email confirmed successfully! Redirecting to dashboard...');
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    };

    confirmEmail();
  }, [router, supabase]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <Card sx={{ width: '100%' }}>
          <CardContent>
            {status === 'loading' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="h6" sx={{ mt: 2 }}>
                  Confirming email...
                </Typography>
              </Box>
            )}

            {status === 'success' && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {message}
              </Alert>
            )}

            {status === 'error' && (
              <>
                <Alert severity="error" sx={{ mb: 2 }}>
                  {message}
                </Alert>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={() => router.push('/auth/signin')}
                >
                  Go to Sign In
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

