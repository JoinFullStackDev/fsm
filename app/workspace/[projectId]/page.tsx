'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  WorkspacePremium as WorkspacePremiumIcon,
  CheckCircle as CheckCircleIcon,
  Psychology as PsychologyIcon,
  AccountTree as AccountTreeIcon,
  MenuBook as MenuBookIcon,
  ArrowBack as ArrowBackIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import WorkspaceChat from '@/components/workspace/chat/WorkspaceChat';
import HelpDrawer from '@/components/workspace/HelpDrawer';
import type { ProjectWorkspaceWithCounts } from '@/types/workspace';

export default function WorkspacePage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const { features } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ProjectWorkspaceWithCounts | null>(null);
  const [helpDrawerOpen, setHelpDrawerOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string; name: string | null; email: string; role: string }>>([]);

  useEffect(() => {
    if (!features?.product_workspace_enabled) {
      setError('Product Workspace module not enabled for your organization');
      setLoading(false);
      return;
    }

    const loadWorkspace = async () => {
      try {
        const [workspaceRes, membersRes] = await Promise.all([
          fetch(`/api/workspaces/${projectId}`),
          fetch(`/api/projects/${projectId}/members`),
        ]);

        if (!workspaceRes.ok) {
          const data = await workspaceRes.json();
          throw new Error(data.error || 'Failed to load workspace');
        }

        const workspaceData = await workspaceRes.json();
        setWorkspace(workspaceData);

        // Load team members (non-blocking if fails)
        if (membersRes.ok) {
          const membersData = await membersRes.json();
          setTeamMembers(
            (membersData.members || []).map((m: any) => ({
              user_id: m.user_id,
              name: m.user?.name || null,
              email: m.user?.email || 'Unknown',
              role: m.role,
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspace();
  }, [projectId, features]);

  if (!features?.product_workspace_enabled) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="warning">
          Product Workspace module is not enabled for your organization. Please upgrade your plan to access this feature.
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading workspace...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/project/${projectId}`)}
          sx={{ mt: 2 }}
        >
          Back to Project
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/project/${projectId}`)}
            sx={{ fontWeight: 600 }}
          >
            Back to Project
          </Button>
          <Button
            variant="outlined"
            startIcon={<HelpOutlineIcon />}
            onClick={() => setHelpDrawerOpen(true)}
          >
            Help & Tips
          </Button>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Box
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
              borderRadius: 3,
              p: 2.5,
              boxShadow: theme.shadows[8],
            }}
          >
            <WorkspacePremiumIcon sx={{ fontSize: 48, color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h2" component="h1" sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: '2rem', md: '3rem' } }}>
              Product Workspace
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400 }}>
              Clarity before code • Upstream product thinking
            </Typography>
          </Box>
        </Box>

        {/* Quick Stats */}
        {workspace && (workspace.clarity_spec_count > 0 || workspace.epic_draft_count > 0 || workspace.decision_count > 0) && (
          <Box sx={{ mt: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{workspace.clarity_spec_count + workspace.epic_draft_count}</Typography>
              <Typography variant="body2" color="text.secondary">work items</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{workspace.decision_count}</Typography>
              <Typography variant="body2" color="text.secondary">decisions</Typography>
            </Box>
            {workspace.debt_count > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.error.main }}>{workspace.debt_count}</Typography>
                <Typography variant="body2" color="text.secondary">debt items</Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Overview Cards */}
      <Grid container spacing={3}>
        {/* Clarity Canvas */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              },
            }}
            onClick={() => router.push(`/workspace/${projectId}/clarity`)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <PsychologyIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                <Typography variant="h5" component="h2">
                  Clarity Canvas
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Define problems, capture business intent, and identify outcomes before solutioning
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                <Typography variant="caption">
                  {workspace?.clarity_spec_count || 0} spec{workspace?.clarity_spec_count === 1 ? '' : 's'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Epic Builder */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              },
            }}
            onClick={() => router.push(`/workspace/${projectId}/epics`)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AccountTreeIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                <Typography variant="h5" component="h2">
                  Epic Builder
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Decompose clarity into actionable FE/BE work and generate tasks or export to GitLab
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                <Typography variant="caption">
                  {workspace?.epic_draft_count || 0} epic{workspace?.epic_draft_count === 1 ? '' : 's'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Context Library */}
        <Grid item xs={12} md={4}>
          <Card
            sx={{
              height: '100%',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: theme.shadows[8],
              },
            }}
            onClick={() => router.push(`/workspace/${projectId}/context`)}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <MenuBookIcon sx={{ fontSize: 40, color: theme.palette.primary.main, mr: 2 }} />
                <Typography variant="h5" component="h2">
                  Context Library
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Track decisions and debt so context isn&apos;t lost and teams can learn from history
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />
                  <Typography variant="caption">
                    {workspace?.decision_count || 0} decisions
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
                  <Typography variant="caption">
                    {workspace?.debt_count || 0} debt items
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* AI Chat Assistant */}
      {workspace && (
        <Box sx={{ mt: 6 }}>
          <WorkspaceChat
            projectId={projectId}
            workspaceId={workspace.id}
            hasSpecs={(workspace.clarity_spec_count || 0) > 0}
            hasEpics={(workspace.epic_draft_count || 0) > 0}
            hasTasks={true}
            teamMembers={teamMembers}
          />
        </Box>
      )}

      {/* Help Drawer */}
      <HelpDrawer open={helpDrawerOpen} onClose={() => setHelpDrawerOpen(false)} />
    </Container>
  );
}
