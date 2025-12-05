'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createSupabaseClient } from '@/lib/supabaseClient';

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const supabase = createSupabaseClient();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  useEffect(() => {
    const handleInvitation = async () => {
      try {
        // Check if we have hash fragments from Supabase (invitation link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const type = hashParams.get('type');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        if (error) {
          setError(errorDescription || error || 'Invalid invitation link');
          setProcessing(false);
          return;
        }

        // Handle both 'invite' (new users) and 'recovery' (re-invited users with confirmed emails)
        if (accessToken && (type === 'invite' || type === 'recovery')) {
          // Exchange the access token for a session
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get('refresh_token') || '',
          });

          if (sessionError) {
            setError(sessionError.message || 'Failed to process invitation link');
            setProcessing(false);
            return;
          }

          if (sessionData.session) {
            // Email is confirmed, now user needs to set password
            setEmailConfirmed(true);
            setProcessing(false);
          } else {
            setError('Failed to create session. Please try again.');
            setProcessing(false);
          }
        } else {
          // No hash params - might be a direct link or already processed
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setEmailConfirmed(true);
            setProcessing(false);
          } else {
            setError('Invalid invitation link. Please contact your administrator for a new invitation.');
            setProcessing(false);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred processing the invitation');
        setProcessing(false);
      }
    };

    handleInvitation();
  }, [supabase]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError('Session expired. Please request a new invitation.');
        setLoading(false);
        return;
      }

      // Update password using Supabase
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to set password');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  if (processing) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress sx={{ color: theme.palette.text.primary }} />
        </Box>
      </Container>
    );
  }

  if (!emailConfirmed) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
          <Card sx={{ width: '100%', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <CardContent>
              <Typography variant="h5" component="h1" gutterBottom sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                Invalid Invitation Link
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 2 }}>
                The invitation link is invalid or has expired. Please contact your administrator for a new invitation.
              </Typography>
              <Button
                variant="outlined"
                fullWidth
                sx={{ mt: 3 }}
                onClick={() => router.push('/auth/signin')}
              >
                Go to Sign In
              </Button>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
          <Card sx={{ width: '100%', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <CardContent>
              <Alert severity="success" sx={{ mb: 2 }}>
                Password set successfully! Redirecting to your dashboard...
              </Alert>
            </CardContent>
          </Card>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: 4 }}>
        <Card sx={{ width: '100%', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <CardContent>
            <Typography variant="h5" component="h1" gutterBottom sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              Set Your Password
            </Typography>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Your email has been confirmed. Please set a password for your account.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSetPassword}>
              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="new-password"
                helperText="Must be at least 6 characters"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                }}
              />
              <TextField
                fullWidth
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                margin="normal"
                autoComplete="new-password"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                }}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                sx={{ 
                  mt: 3, 
                  mb: 2,
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.default,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                  },
                }}
              >
                {loading ? 'Setting Password...' : 'Set Password'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    }>
      <SetPasswordForm />
    </Suspense>
  );
}
