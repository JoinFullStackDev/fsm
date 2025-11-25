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
  Card,
  CardContent,
  Collapse,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';

export default function SignInPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent form from submitting/reloading
    setError(null);
    setLoading(true);

    console.log('[SignIn] Attempting sign-in for:', email);

    try {
      // Try sign-in with retry logic for newly created users
      // Sometimes there's a delay before password is fully committed
      let signInData = null;
      let signInError = null;
      let attempts = 0;
      const maxAttempts = 2;

      while (!signInData && !signInError && attempts < maxAttempts) {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        signInData = result.data;
        signInError = result.error;

        // If we get invalid credentials and it's not the last attempt, wait and retry
        if (signInError && attempts < maxAttempts - 1) {
          const isInvalidCredentials = signInError.message.includes('Invalid login credentials') || 
                                      signInError.message.includes('invalid_credentials') ||
                                      signInError.message.includes('Invalid login');
          
          if (isInvalidCredentials) {
            console.log(`[SignIn] Invalid credentials on attempt ${attempts + 1}, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            signInError = null; // Reset to retry
          }
        }
        attempts++;
      }

      if (signInError) {
        console.error('[SignIn] Sign-in error after', attempts, 'attempts:', signInError);
        console.error('[SignIn] Error details:', {
          message: signInError.message,
          status: signInError.status,
          name: signInError.name,
        });
        
        // Check if it's an email confirmation error
        if (signInError.message.includes('Email not confirmed') || signInError.message.includes('email_not_confirmed')) {
          setError('Please confirm your email before signing in. Check your inbox for the confirmation link.');
        } else if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('invalid_credentials')) {
          // More specific error for invalid credentials
          setError('Invalid email or password. If you were just created, please wait a moment and try again, or ask your admin to regenerate your password.');
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
        // Try multiple times in case of RLS timing issues
        let userData = null;
        let userError = null;
        let attempts = 0;
        
        while (!userData && attempts < 3) {
          const result = await supabase
            .from('users')
            .select('id, role, invited_by_admin, last_active_at')
            .eq('auth_id', data.user.id)
            .single();
          
          userData = result.data;
          userError = result.error;
          
          if (userError && attempts < 2) {
            console.log(`User record lookup attempt ${attempts + 1} failed, retrying...`, userError);
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          attempts++;
        }

        console.log('User record lookup:', { userData, userError, attempts });

        if (userError || !userData) {
          console.warn('User record not found after multiple attempts, attempting to create...');
          // User record doesn't exist - try to create it
          // Use ON CONFLICT to prevent duplicates if record exists but RLS hid it
          const { error: createError } = await supabase.rpc('create_user_record', {
            p_auth_id: data.user.id,
            p_email: data.user.email || email,
            p_name: data.user.user_metadata?.name || '',
            p_role: data.user.user_metadata?.role || 'pm',
          });

          if (createError) {
            console.error('Failed to create user record:', createError);
            // If creation fails, try one more lookup in case it was created
            const retryResult = await supabase
              .from('users')
              .select('id, role, invited_by_admin, last_active_at')
              .eq('auth_id', data.user.id)
              .single();
            
            if (retryResult.data) {
              userData = retryResult.data;
              console.log('User record found on retry after create attempt');
            } else {
              setError(`Account exists but user record is missing. Error: ${createError.message}. Please contact support.`);
              setLoading(false);
              return;
            }
          } else {
            console.log('User record created successfully, fetching it...');
            // Fetch the newly created record
            const fetchResult = await supabase
              .from('users')
              .select('id, role, invited_by_admin, last_active_at')
              .eq('auth_id', data.user.id)
              .single();
            
            if (fetchResult.data) {
              userData = fetchResult.data;
            }
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

      // Verify session is established
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session check:', { session: !!session, sessionError, sessionData: session });

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
        setError('Session not established. Please try again. Check console for details.');
        setLoading(false);
        return;
      }

      // Wait a bit longer to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 300));

      // Double-check session before redirect
      const { data: { session: sessionCheck } } = await supabase.auth.getSession();
      if (!sessionCheck) {
        console.error('Session lost after wait!');
        setError('Session not persisting. This might be a cookie issue.');
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
        <Card
          sx={{
            width: '100%',
            border: '2px solid',
            borderColor: 'primary.main',
            backgroundColor: 'background.paper',
            boxShadow: '0 8px 32px rgba(0, 229, 255, 0.2)',
          }}
        >
          <CardContent>
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              align="center"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              Sign In
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', align: 'center', mb: 3 }}>
              FullStack Method™ App
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
                {error.includes('confirm your email') && (
                  <Box sx={{ mt: 1 }}>
                    <Button
                      size="small"
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
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  fontWeight: 600,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <Typography variant="body2" align="center" sx={{ mb: 1 }}>
                <Link href="/auth/forgot-password" underline="hover">
                  Forgot password?
                </Link>
              </Typography>
              <Typography variant="body2" align="center">
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" underline="hover">
                  Sign up
                </Link>
              </Typography>
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Button
                  size="small"
                  onClick={() => setShowDebug(!showDebug)}
                  sx={{ textTransform: 'none' }}
                >
                  {showDebug ? 'Hide' : 'Show'} Debug Info
                </Button>
              </Box>
              <Collapse in={showDebug}>
                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="caption" component="div">
                    <strong>Debug Information:</strong>
                    <br />
                    • Check Supabase Dashboard → Authentication → Settings
                    <br />
                    • Ensure &quot;Enable email confirmations&quot; matches your setup
                    <br />
                    • Verify the `create_user_record` function exists in your database
                    <br />
                    • Check browser console for detailed error messages
                  </Typography>
                </Alert>
              </Collapse>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

