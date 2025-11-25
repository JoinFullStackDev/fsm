'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';

export default function Navbar() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();

  // Debug logging
  useEffect(() => {
    if (!roleLoading) {
      console.log('[Navbar] Role loaded:', role);
    }
  }, [role, roleLoading]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth/signin');
  };

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: '#000',
        borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          component="div"
          sx={{
            flexGrow: 1,
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          FullStack Method™
        </Typography>
        <Button
          onClick={() => router.push('/dashboard')}
          sx={{
            color: '#E0E0E0',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: '#00E5FF',
            },
          }}
        >
          Dashboard
        </Button>
        {!roleLoading && role === 'admin' && (
          <>
            <Button
              onClick={() => router.push('/admin')}
              sx={{
                color: '#E0E0E0',
                '&:hover': {
                  backgroundColor: 'rgba(233, 30, 99, 0.1)',
                  color: '#E91E63',
                },
              }}
            >
              Admin
            </Button>
            <Button
              onClick={() => router.push('/admin/templates')}
              sx={{
                color: '#E0E0E0',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  color: '#00E5FF',
                },
              }}
            >
              Templates
            </Button>
          </>
        )}
        <Button
          onClick={() => router.push('/profile')}
          sx={{
            color: '#E0E0E0',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
              color: '#00E5FF',
            },
          }}
        >
          Profile
        </Button>
        <Button
          onClick={handleSignOut}
          sx={{
            color: '#E0E0E0',
            '&:hover': {
              backgroundColor: 'rgba(255, 23, 68, 0.1)',
              color: '#FF1744',
            },
          }}
        >
          Sign Out
        </Button>
      </Toolbar>
    </AppBar>
  );
}

