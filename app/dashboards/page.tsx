'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  Dashboard as DashboardIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as ContentCopyIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useOrganization } from '@/components/providers/OrganizationProvider';

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  is_personal: boolean;
  is_default: boolean;
  organization_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export default function DashboardsPage() {
  const router = useRouter();
  const theme = useTheme();
  const { features } = useOrganization();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; id: string } | null>(null);

  useEffect(() => {
    // Check module access
    if (features && features.custom_dashboards_enabled !== true) {
      router.push('/dashboard');
      return;
    }

    loadDashboards();
  }, [features, router]);

  const loadDashboards = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dashboards');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load dashboards');
      }

      const data = await response.json();
      setDashboards(data.dashboards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboards');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDashboard = () => {
    router.push('/dashboards/new');
  };

  const handleViewDashboard = (id: string) => {
    router.push(`/dashboards/${id}`);
  };

  const handleEditDashboard = (id: string) => {
    router.push(`/dashboards/${id}/edit`);
  };

  const handleDuplicateDashboard = async (id: string) => {
    try {
      const response = await fetch(`/api/dashboards/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate dashboard');
      }

      await loadDashboards();
      setMenuAnchor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate dashboard');
    }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!confirm('Are you sure you want to delete this dashboard?')) {
      return;
    }

    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete dashboard');
      }

      await loadDashboards();
      setMenuAnchor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setMenuAnchor({ el: event.currentTarget, id });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  if (features && features.custom_dashboards_enabled !== true) {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Dashboards
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateDashboard}
        >
          Create Dashboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {dashboards.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <DashboardIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No dashboards yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create your first dashboard to get started
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateDashboard}>
                Create Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {dashboards.map((dashboard) => (
            <Grid item xs={12} sm={6} md={4} key={dashboard.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  '&:hover': {
                    boxShadow: theme.shadows[4],
                  },
                }}
                onClick={() => handleViewDashboard(dashboard.id)}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {dashboard.name}
                        {dashboard.is_default && (
                          <Chip label="Default" size="small" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                        {dashboard.is_personal && (
                          <Chip label="Personal" size="small" variant="outlined" />
                        )}
                        {dashboard.organization_id && !dashboard.is_personal && (
                          <Chip label="Organization" size="small" variant="outlined" />
                        )}
                        {dashboard.project_id && (
                          <Chip label="Project" size="small" variant="outlined" />
                        )}
                      </Box>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuOpen(e, dashboard.id);
                      }}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </Box>
                  {dashboard.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {dashboard.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Updated {new Date(dashboard.updated_at).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Menu
        anchorEl={menuAnchor?.el}
        open={!!menuAnchor}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleViewDashboard(menuAnchor.id);
              handleMenuClose();
            }
          }}
        >
          <VisibilityIcon sx={{ mr: 1 }} fontSize="small" />
          View
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleEditDashboard(menuAnchor.id);
              handleMenuClose();
            }
          }}
        >
          <EditIcon sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleDuplicateDashboard(menuAnchor.id);
            }
          }}
        >
          <ContentCopyIcon sx={{ mr: 1 }} fontSize="small" />
          Duplicate
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuAnchor) {
              handleDeleteDashboard(menuAnchor.id);
            }
          }}
          sx={{ color: theme.palette.error.main }}
        >
          <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}

