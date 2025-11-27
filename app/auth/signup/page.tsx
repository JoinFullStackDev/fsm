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
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import type { UserRole } from '@/types/project';

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState<UserRole>('pm');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate organization name
    if (!organizationName || organizationName.trim().length === 0) {
      setError('Organization name is required');
      setLoading(false);
      return;
    }

    try {
      // Step 1: Create organization
      const orgSlug = organizationName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: organizationName.trim(),
          slug: orgSlug,
          subscription_status: 'trial',
        })
        .select()
        .single();

      if (orgError) {
        // Check if slug already exists
        if (orgError.code === '23505') {
          setError('An organization with this name already exists. Please choose a different name.');
        } else {
          setError(`Failed to create organization: ${orgError.message}`);
        }
        setLoading(false);
        return;
      }

      // Step 2: Sign up user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            role,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Step 3: Create user record with organization_id
        const { error: userError } = await supabase.rpc('create_user_record', {
          p_auth_id: authData.user.id,
          p_email: email,
          p_name: name,
          p_role: role,
        });

        if (userError) {
          setError(userError.message);
          setLoading(false);
          return;
        }

        // Step 4: Assign user to organization
        const { error: assignError } = await supabase
          .from('users')
          .update({ organization_id: orgData.id })
          .eq('auth_id', authData.user.id);

        if (assignError) {
          setError(`Failed to assign user to organization: ${assignError.message}`);
          setLoading(false);
          return;
        }

        // Step 5: Create default subscription (Starter package) via API
        try {
          const { data: starterPackage } = await supabase
            .from('packages')
            .select('id')
            .eq('name', 'Starter')
            .single();

          if (starterPackage) {
            await fetch('/api/organization/subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                organization_id: orgData.id,
                package_id: starterPackage.id,
              }),
            });
          }
        } catch (subError) {
          // Non-critical error - subscription can be created later
          console.warn('Failed to create default subscription:', subError);
        }

        router.push('/dashboard');
      }
    } catch (err) {
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
            borderColor: 'secondary.main',
            backgroundColor: 'background.paper',
            boxShadow: '0 8px 32px rgba(233, 30, 99, 0.2)',
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
                background: 'linear-gradient(135deg, #E91E63 0%, #00E5FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              Sign Up
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', align: 'center', mb: 3 }}>
              FullStack Method™ App
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSignUp}>
              <TextField
                fullWidth
                label="Organization Name"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                required
                margin="normal"
                helperText="This will be your company or team name"
              />
              <TextField
                fullWidth
                label="Your Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                margin="normal"
                autoComplete="name"
              />
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
                autoComplete="new-password"
                helperText="Must be at least 6 characters"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Role</InputLabel>
                <Select
                  value={role}
                  label="Role"
                  onChange={(e) => setRole(e.target.value as UserRole)}
                >
                  <MenuItem value="pm">Product Manager</MenuItem>
                  <MenuItem value="designer">Designer</MenuItem>
                  <MenuItem value="engineer">Engineer</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{
                  mt: 3,
                  mb: 2,
                  backgroundColor: 'secondary.main',
                  color: 'secondary.contrastText',
                  fontWeight: 600,
                  py: 1.5,
                  fontSize: '1.1rem',
                  '&:hover': {
                    backgroundColor: 'secondary.dark',
                    boxShadow: '0 6px 25px rgba(233, 30, 99, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Sign Up'}
              </Button>
              <Typography variant="body2" align="center">
                Already have an account?{' '}
                <Link href="/auth/signin" underline="hover">
                  Sign in
                </Link>
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

