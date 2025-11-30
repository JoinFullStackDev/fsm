'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  IconButton,
  Container,
  Paper,
} from '@mui/material';
import {
  Edit as EditIcon,
  GetApp as ExportIcon,
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import WidgetRenderer from '@/components/dashboards/WidgetRenderer';
import DashboardSubscriptionDialog from '@/components/dashboards/DashboardSubscriptionDialog';
import GridLayout, { Layout } from 'react-grid-layout';
import '@/app/dashboards/styles.css';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_personal: boolean;
  is_default: boolean;
  layout: any;
  widgets: Widget[];
}

interface Widget {
  id: string;
  widget_type: string;
  dataset: any;
  position: any;
  settings: any;
}

export default function DashboardViewerPage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const { features } = useOrganization();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dashboards/${params.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load dashboard');
      }

      const data = await response.json();
      setDashboard(data.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (features && features.custom_dashboards_enabled !== true) {
      router.push('/dashboard');
      return;
    }

    if (params.id) {
      loadDashboard();
    }
  }, [params.id, features, router, loadDashboard]);

  useEffect(() => {
    const updateWidth = () => {
      // Get the container Box that wraps the GridLayout
      const container = document.querySelector('.dashboard-layout-container');
      if (container) {
        // Use the full container width (padding is already accounted for in the parent Box)
        setContainerWidth(container.clientWidth);
      } else {
        // Fallback: use window width minus padding (p: 3 = 24px each side)
        setContainerWidth(window.innerWidth - 48);
      }
    };

    // Wait for DOM to be ready
    const timer = setTimeout(updateWidth, 100);
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, [dashboard]); // Recalculate when dashboard loads


  const handleEdit = () => {
    router.push(`/dashboards/${params.id}/edit`);
  };

  const handleExportPDF = async () => {
    try {
      const response = await fetch(`/api/dashboards/${params.id}/export/pdf`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to export dashboard');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dashboard?.name || 'dashboard'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export dashboard');
    }
  };

  if (features && features.custom_dashboards_enabled !== true) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !dashboard) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Dashboard not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/dashboards')} sx={{ mt: 2 }}>
          Back to Dashboards
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 6 }}>
      <Container maxWidth="xl" sx={{ pt: 4, pb: 4, px: { xs: 0, md: 3 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton
              onClick={() => router.push('/dashboards')}
              sx={{
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                  fontSize: { xs: '1.5rem', md: '2rem' },
                }}
              >
                {dashboard.name}
              </Typography>
              {dashboard.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {dashboard.description}
                </Typography>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<EmailIcon />}
              onClick={() => setSubscriptionDialogOpen(true)}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Scheduled Reports
            </Button>
            <Button
              startIcon={<ExportIcon />}
              onClick={handleExportPDF}
              sx={{
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Export PDF
            </Button>
            <Button
              startIcon={<EditIcon />}
              variant="contained"
              onClick={handleEdit}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Edit
            </Button>
          </Box>
        </Box>

        {dashboard.widgets && dashboard.widgets.length > 0 ? (
          <Box 
            className="dashboard-layout-container"
            sx={{ position: 'relative', minHeight: '50vh', width: '100%' }}
          >
            <GridLayout
              className="dashboard-layout"
              layout={dashboard.widgets.map((widget) => {
                const pos = widget.position || {};
                return {
                  i: widget.id,
                  x: pos.x ?? 0,
                  y: pos.y ?? 0,
                  w: pos.w ?? 4,
                  h: pos.h ?? 3,
                  minW: 2,
                  minH: 2,
                  maxW: 12,
                  maxH: 10,
                  static: true, // Make widgets non-draggable in viewer
                };
              })}
              cols={12}
              rowHeight={60}
              width={containerWidth || window.innerWidth - 48}
              isDraggable={false}
              isResizable={false}
              compactType={null}
              preventCollision={false}
              verticalCompact={false}
              margin={[10, 10]}
            >
              {dashboard.widgets.map((widget) => (
                <Paper
                  key={widget.id}
                  elevation={0}
                  sx={{
                    height: '100%',
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <WidgetRenderer widget={widget} dashboardId={params.id as string} />
                  </Box>
                </Paper>
              ))}
            </GridLayout>
          </Box>
        ) : (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No widgets yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add widgets to this dashboard to display data
                </Typography>
                <Button variant="contained" startIcon={<EditIcon />} onClick={handleEdit}>
                  Edit Dashboard
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Container>

      {/* Subscription Dialog */}
      <DashboardSubscriptionDialog
        open={subscriptionDialogOpen}
        onClose={() => setSubscriptionDialogOpen(false)}
        dashboardId={params.id as string}
      />
    </Box>
  );
}

