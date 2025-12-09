'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Grid, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSearchParams } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { InteractiveOnboarding, OnboardingProvider } from '@/components/onboarding';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useUser } from '@/components/providers/UserProvider';
import CreateUserDialog from '@/components/admin/CreateUserDialog';
import { Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, Button } from '@mui/material';
import type { User } from '@/types/project';
import logger from '@/lib/utils/logger';

// New dashboard components
import GreetingHeader from '@/components/dashboard/GreetingHeader';
import QuickActionsRow from '@/components/dashboard/QuickActionsRow';
import UserTasksCard from '@/components/dashboard/UserTasksCard';
import UserProjectsCard from '@/components/dashboard/UserProjectsCard';
import KBArticlesSlider from '@/components/dashboard/KBArticlesSlider';
import TeamPreviewCard from '@/components/dashboard/TeamPreviewCard';
import RecentCommentsCard from '@/components/dashboard/RecentCommentsCard';

function DashboardPageContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createSupabaseClient();
  const { organization } = useOrganization();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeTour, setShowWelcomeTour] = useState(false);
  const [showInvitePrompt, setShowInvitePrompt] = useState(false);
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<{ quantity: number; organizationId: string } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    // Check for pending user invites after signup
    const inviteDataStr = sessionStorage.getItem('pending_user_invites');
    const inviteUsers = searchParams.get('invite_users') === 'true';

    if (inviteDataStr && inviteUsers && organization) {
      try {
        const inviteData = JSON.parse(inviteDataStr);
        // Verify data is not too old (max 1 hour)
        if (Date.now() - inviteData.timestamp < 60 * 60 * 1000) {
          setPendingInvites(inviteData);
          setShowInvitePrompt(true);
        } else {
          sessionStorage.removeItem('pending_user_invites');
        }
      } catch (err) {
        sessionStorage.removeItem('pending_user_invites');
      }
    }

    // Track login count for rocket icon flicker (handled in TopBar)
    const loginCount = parseInt(localStorage.getItem('loginCount') || '0', 10);
    localStorage.setItem('loginCount', String(loginCount + 1));

    const checkSession = async () => {
      if (loadingRef.current) return;

      try {
        loadingRef.current = true;
        setLoading(true);

        // Log debug info from sign-in if available
        const debugInfo = localStorage.getItem('signin_debug');
        if (debugInfo) {
          logger.debug('Sign-in debug info:', JSON.parse(debugInfo));
          localStorage.removeItem('signin_debug');
        }

        // Wait a bit for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 200));

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const session = sessionData?.session;

        logger.debug('Dashboard session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          sessionError: sessionError?.message
        });

        if (!session) {
          logger.error('No session in dashboard, redirecting to sign-in');
          router.push('/auth/signin');
          return;
        }

        setError(null);
      } catch (fetchError) {
        logger.error('[Dashboard] Error checking session:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: unknown) => {
      if (event === 'SIGNED_IN' && session) {
        logger.debug('Auth state changed to SIGNED_IN');
        checkSession();
      }
    });

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, organization]);

  // Lazy load users when invite prompt is shown
  useEffect(() => {
    if (showInvitePrompt && !usersLoaded && organization?.id) {
      const loadUsers = async () => {
        try {
          const usersResponse = await fetch('/api/admin/users');
          if (usersResponse.ok) {
            const usersData = await usersResponse.json();
            if (usersData?.users) {
              setUsers(usersData.users.map((u: User) => ({
                id: u.id,
                email: u.email,
                name: u.name,
                role: u.role
              })) as User[]);
              setUsersLoaded(true);
            }
          }
        } catch (usersErr) {
          logger.error('[Dashboard] Error loading users:', usersErr);
        }
      };
      loadUsers();
    }
  }, [showInvitePrompt, usersLoaded, organization?.id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: { xs: 2, md: 3 } }}>
        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            {error}
          </Alert>
        )}

        {/* Greeting Header */}
        <GreetingHeader />

        {/* Quick Actions */}
        <QuickActionsRow />

        {/* Tasks and Projects Row */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={6}>
            <UserTasksCard />
          </Grid>
          <Grid item xs={12} md={6}>
            <UserProjectsCard />
          </Grid>
        </Grid>

        {/* Knowledge Base Articles Slider */}
        <KBArticlesSlider />

        {/* Teams and Comments Row */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TeamPreviewCard />
          </Grid>
          <Grid item xs={12} md={6}>
            <RecentCommentsCard />
          </Grid>
        </Grid>
      </Box>

      <InteractiveOnboarding
        open={showWelcomeTour}
        onClose={() => setShowWelcomeTour(false)}
      />

      {/* Invite Users Prompt */}
      <Dialog
        open={showInvitePrompt}
        onClose={() => {
          setShowInvitePrompt(false);
          sessionStorage.removeItem('pending_user_invites');
          router.push('/dashboard');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Invite Team Members</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You purchased {pendingInvites?.quantity || 0} user{pendingInvites?.quantity !== 1 ? 's' : ''} for your plan.
            You currently have {users.length} user{users.length !== 1 ? 's' : ''} in your organization.
            {pendingInvites && users.length < pendingInvites.quantity && (
              <>
                <br /><br />
                You can invite up to {pendingInvites.quantity - users.length} more user{pendingInvites.quantity - users.length !== 1 ? 's' : ''} to your organization.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowInvitePrompt(false);
            sessionStorage.removeItem('pending_user_invites');
            router.push('/dashboard');
          }}>
            Maybe Later
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setShowInvitePrompt(false);
              setShowCreateUserDialog(true);
            }}
          >
            Invite Users Now
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateUserDialog}
        onClose={() => {
          setShowCreateUserDialog(false);
          if (pendingInvites && users.length + 1 >= pendingInvites.quantity) {
            sessionStorage.removeItem('pending_user_invites');
            setPendingInvites(null);
          }
        }}
        onUserCreated={() => {
          // User created - dialog will handle reload
        }}
      />

      </>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    }>
      <OnboardingProvider>
        <DashboardPageContent />
      </OnboardingProvider>
    </Suspense>
  );
}
