'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Button,
  CircularProgress,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import EmptyState from '@/components/ui/EmptyState';
import type { Organization, Package, Subscription } from '@/lib/organizationContext';

interface OrganizationWithDetails extends Organization {
  subscription?: Subscription | null;
  package?: Package | null;
  user_count?: number;
  project_count?: number;
}

export default function AdminOrganizationsTab() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [organizations, setOrganizations] = useState<OrganizationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrg, setSelectedOrg] = useState<OrganizationWithDetails | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [packages, setPackages] = useState<Package[]>([]);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/organizations');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organizations';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadPackages = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/packages');
      if (!response.ok) {
        throw new Error('Failed to load packages');
      }

      const data = await response.json();
      setPackages(data.packages || []);
    } catch (err) {
      console.error('Error loading packages:', err);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
    loadPackages();
  }, [loadOrganizations, loadPackages]);

  const handleViewOrganization = (org: OrganizationWithDetails) => {
    setSelectedOrg(org);
    setViewDialogOpen(true);
  };

  const handleUpdateSubscription = async (orgId: string, packageId: string) => {
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update subscription');
      }

      showSuccess('Subscription updated successfully');
      loadOrganizations();
      setViewDialogOpen(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update subscription';
      showError(errorMessage);
    }
  };

  const filteredOrganizations = organizations.filter((org) =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error && organizations.length === 0) {
    return (
      <Box p={3}>
        <EmptyState
          title="Failed to load organizations"
          description={error}
          actionLabel="Retry"
          onAction={loadOrganizations}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          Organizations
        </Typography>
      </Box>

      <Box mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search organizations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {filteredOrganizations.length === 0 ? (
        <EmptyState
          title="No organizations found"
          description={searchTerm ? 'Try adjusting your search terms' : 'No organizations have been created yet'}
        />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Projects</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrganizations.map((org) => (
                <TableRow key={org.id} hover>
                  <TableCell>{org.name}</TableCell>
                  <TableCell>
                    <Chip label={org.slug} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={org.subscription_status}
                      size="small"
                      color={
                        org.subscription_status === 'active'
                          ? 'success'
                          : org.subscription_status === 'trial'
                          ? 'info'
                          : org.subscription_status === 'past_due'
                          ? 'warning'
                          : 'error'
                      }
                    />
                  </TableCell>
                  <TableCell>{org.package?.name || 'None'}</TableCell>
                  <TableCell>{org.user_count || 0}</TableCell>
                  <TableCell>{org.project_count || 0}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleViewOrganization(org)}
                      aria-label="View organization"
                    >
                      <ViewIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Organization Detail Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Organization Details</DialogTitle>
        <DialogContent>
          {selectedOrg && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {selectedOrg.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Slug: {selectedOrg.slug}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Status: {selectedOrg.subscription_status}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Package</InputLabel>
                  <Select
                    value={selectedOrg.package?.id || ''}
                    label="Package"
                    onChange={(e) =>
                      handleUpdateSubscription(selectedOrg.id, e.target.value as string)
                    }
                  >
                    {packages.map((pkg) => (
                      <MenuItem key={pkg.id} value={pkg.id}>
                        {pkg.name} - ${pkg.price_per_user_monthly}/user/month
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {selectedOrg.subscription && (
                <Grid item xs={12}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        Subscription Details
                      </Typography>
                      <Typography variant="body2">
                        Status: {selectedOrg.subscription.status}
                      </Typography>
                      {selectedOrg.subscription.current_period_end && (
                        <Typography variant="body2">
                          Period End:{' '}
                          {new Date(selectedOrg.subscription.current_period_end).toLocaleDateString()}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

