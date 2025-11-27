'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createSupabaseClient } from '@/lib/supabaseClient';

export default function SignInPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent form from submitting/reloading
    setError(null);
    setLoading(true);

    console.log('[SignIn] Attempting sign-in for:', email);

    try {
      // Single sign-in attempt to avoid rate limiting
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      const signInData = result.data;
      const signInError = result.error;

      if (signInError) {
        console.error('[SignIn] Sign-in error:', signInError);
        console.error('[SignIn] Error details:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        });
        
        // Check for rate limiting
        if (signInError.message.includes('rate limit') || signInError.message.includes('too many requests') || signInError.status === 429) {
          setError('Too many login attempts. Please wait a few minutes before trying again.');
        } else if (signInError.message.includes('Email not confirmed') || signInError.message.includes('email_not_confirmed')) {
          setError('Please confirm your email before signing in. Check your inbox for the confirmation link.');
        } else if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('invalid_credentials')) {
          setError('Invalid email or password.');
        } else {
          setError(signInError.message || 'Sign-in failed. Please try again.');
        }
        setLoading(false);
        return;
      }

      const data = signInData;

      if (data && data.user) {
        console.log('Auth successful, user ID:', data.user.id);
        console.log('Email confirmed:', data.user.email_confirmed_at);

        // Verify user record exists in users table
        // Single attempt to avoid rate limiting
        const userResult = await supabase
          .from('users')
          .select('id, role, invited_by_admin, last_active_at, organization_id')
          .eq('auth_id', data.user.id)
          .single();
        
        let userData = userResult.data;
        let userError = userResult.error;

        console.log('User record lookup:', { userData, userError });

        if (userError || !userData) {
          console.warn('User record not found, attempting to create via API...');
          // User record doesn't exist - create it via API route (server-side, can use admin client)
          try {
            const createResponse = await fetch('/api/auth/create-user-record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: data.user.email || email,
                name: data.user.user_metadata?.name || '',
                role: data.user.user_metadata?.role || 'pm',
              }),
            });

            if (!createResponse.ok) {
              const errorData = await createResponse.json();
              throw new Error(errorData.error || 'Failed to create user record');
            }

            const { user: createdUser } = await createResponse.json();
            userData = createdUser;
            console.log('User record created successfully:', userData);
          } catch (createErr) {
            console.error('Failed to create user record:', createErr);
            setError(`Account exists but user record is missing. Error: ${createErr instanceof Error ? createErr.message : 'Unknown error'}. Please contact support.`);
            setLoading(false);
            return;
          }
        } else if (userData && !userData.organization_id) {
          // User exists but doesn't have an organization_id - assign them via API
          console.log('User exists but missing organization_id, assigning via API...');
          try {
            const assignResponse = await fetch('/api/auth/create-user-record', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: data.user.email || email,
                name: data.user.user_metadata?.name || '',
                role: userData.role || 'pm',
              }),
            });

            if (assignResponse.ok) {
              const { user: updatedUser } = await assignResponse.json();
              userData = updatedUser;
            }
          } catch (assignErr) {
            console.error('Failed to assign organization:', assignErr);
            // Non-critical error - continue with signin
          }
        }
        
        // Update last_active_at if we have userData
        if (userData) {
          console.log('User record found:', userData);
          
          // Update last_active_at (this marks that they've logged in)
          // Don't auto-activate - admin must activate them manually after first login
          await supabase
            .from('users')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', userData.id);
          
          console.log('User last_active_at updated');
        }

      // Verify session is established (single check)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { session: !!session, sessionError });

      // Store debug info in localStorage so it persists across redirects
      localStorage.setItem('signin_debug', JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: data.user.id,
        email: data.user.email,
        emailConfirmed: !!data.user.email_confirmed_at,
        hasSession: !!session,
        sessionError: sessionError?.message,
      }));

      if (!session) {
        console.error('No session after sign-in!');
        setError('Session not established. Please try again.');
        setLoading(false);
        return;
      }

      console.log('Session confirmed, redirecting to dashboard...');
      // Use router.push for client-side navigation (smoother than window.location)
      // Refresh router to ensure session is available on the dashboard
      router.refresh();
      router.push('/dashboard');
      } else {
        setError('Sign-in successful but no user data returned.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Unexpected error during sign-in:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Container maxWidth="sm">
        <Paper
          sx={{
            width: '100%',
            p: 4,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            align="center"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 1,
            }}
          >
            Sign In
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, textAlign: 'center', mb: 3 }}>
            FullStack Method™ App
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {error}
              {error.includes('confirm your email') && (
                <Box sx={{ mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={async () => {
                      const { error: resendError } = await supabase.auth.resend({
                        type: 'signup',
                        email: email,
                      });
                      if (resendError) {
                        setError('Failed to resend confirmation email: ' + resendError.message);
                      } else {
                        setError('Confirmation email sent! Please check your inbox.');
                      }
                    }}
                    sx={{
                      borderColor: theme.palette.text.primary,
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.text.primary,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    Resend Confirmation Email
                  </Button>
                </Box>
              )}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSignIn}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              margin="normal"
              autoComplete="email"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
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
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              margin="normal"
              autoComplete="current-password"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
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
              variant="outlined"
              sx={{
                mt: 3,
                mb: 2,
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                fontWeight: 600,
                py: 1.5,
                fontSize: '1.1rem',
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
            <Typography variant="body2" align="center" sx={{ mt: 2, color: theme.palette.text.secondary }}>
              <Link
                href="/auth/forgot-password"
                underline="hover"
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                Forgot password?
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

