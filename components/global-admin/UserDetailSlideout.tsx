'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  CalendarToday as CalendarIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { User } from '@/types/project';
import type { Organization } from '@/types/organization';

interface UserWithOrganization extends User {
  organizations?: Organization | null;
  updated_at?: string | null;
}

interface UserDetailSlideoutProps {
  open: boolean;
  user: UserWithOrganization | null;
  onClose: () => void;
  onUserUpdated: () => void;
}

export default function UserDetailSlideout({
  open,
  user,
  onClose,
  onUserUpdated,
}: UserDetailSlideoutProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserWithOrganization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    organization_id: '',
    is_active: true,
  });

  const loadUser = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/global/admin/users/${user.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load user');
      }

      const data = await response.json();
      setUserData(data.user);
      setFormData({
        name: data.user.name || '',
        email: data.user.email || '',
        role: data.user.role || '',
        organization_id: data.user.organization_id || '',
        is_active: data.user.is_active !== false,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user?.id, showError]);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/global/admin/organizations');
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (err) {
      console.error('Error loading organizations:', err);
    } finally {
      setLoadingOrgs(false);
    }
  }, []);

  useEffect(() => {
    if (open && user) {
      loadUser();
      loadOrganizations();
    } else if (!open) {
      setUserData(null);
      setError(null);
      setFormData({
        name: '',
        email: '',
        role: '',
        organization_id: '',
        is_active: true,
      });
    }
  }, [open, user, loadUser, loadOrganizations]);

  const handleSave = async () => {
    if (!user?.id) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/global/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user');
      }

      showSuccess('User updated successfully');
      onUserUpdated();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update user';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const drawerWidth = 600;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: drawerWidth,
          maxWidth: '90vw',
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            User Details
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : error && !userData ? (
            <Alert severity="error">{error}</Alert>
          ) : userData ? (
            <>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {/* User Info Section */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  User Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      InputProps={{
                        startAdornment: <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      InputProps={{
                        startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Role</InputLabel>
                      <Select
                        value={formData.role}
                        label="Role"
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        startAdornment={<SecurityIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                      >
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="pm">Product Manager</MenuItem>
                        <MenuItem value="designer">Designer</MenuItem>
                        <MenuItem value="engineer">Engineer</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Organization</InputLabel>
                      <Select
                        value={formData.organization_id}
                        label="Organization"
                        onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                        disabled={loadingOrgs}
                        startAdornment={<BusinessIcon sx={{ mr: 1, color: 'text.secondary' }} />}
                      >
                        <MenuItem value="">No Organization</MenuItem>
                        {organizations.map((org) => (
                          <MenuItem key={org.id} value={org.id}>
                            {org.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={formData.is_active ? 'active' : 'inactive'}
                        label="Status"
                        onChange={(e) =>
                          setFormData({ ...formData, is_active: e.target.value === 'active' })
                        }
                      >
                        <MenuItem value="active">Active</MenuItem>
                        <MenuItem value="inactive">Inactive</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Paper>

              {/* Read-only Info */}
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  Additional Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        Created: {new Date(userData.created_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </Grid>
                  {userData.updated_at && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Updated: {new Date(userData.updated_at).toLocaleString()}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {userData.last_active_at && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CalendarIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Last Active: {new Date(userData.last_active_at).toLocaleString()}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                  {userData.organizations && (
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon sx={{ color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          Current Organization: {userData.organizations.name}
                        </Typography>
                      </Box>
                    </Grid>
                  )}
                </Grid>
              </Paper>
            </>
          ) : null}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 3,
            borderTop: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={onClose} variant="outlined">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            disabled={saving || loading}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

