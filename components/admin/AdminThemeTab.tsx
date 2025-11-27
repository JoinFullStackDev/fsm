'use client';

import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Upload as UploadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';

export default function AdminThemeTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBranding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization]);

  const loadBranding = async () => {
    if (!organization?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/organization/${organization.id}/branding`);
      if (response.ok) {
        const data = await response.json();
        setLogoUrl(data.logo_url || null);
        setIconUrl(data.icon_url || null);
      }
    } catch (err) {
      console.error('Error loading branding:', err);
      setError('Failed to load branding');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showError('Logo file size must be less than 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');

      const response = await fetch(`/api/organization/${organization.id}/branding/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload logo');
      }

      const data = await response.json();
      setLogoUrl(data.url);
      showSuccess('Logo uploaded successfully!');
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image file');
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      showError('Icon file size must be less than 1MB');
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'icon');

      const response = await fetch(`/api/organization/${organization.id}/branding/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload icon');
      }

      const data = await response.json();
      setIconUrl(data.url);
      showSuccess('Icon uploaded successfully!');
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to upload icon');
    } finally {
      setUploadingIcon(false);
      if (iconInputRef.current) {
        iconInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!organization?.id) return;

    try {
      const response = await fetch(`/api/organization/${organization.id}/branding`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'logo' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove logo');
      }

      setLogoUrl(null);
      showSuccess('Logo removed successfully!');
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove logo');
    }
  };

  const handleRemoveIcon = async () => {
    if (!organization?.id) return;

    try {
      const response = await fetch(`/api/organization/${organization.id}/branding`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'icon' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove icon');
      }

      setIconUrl(null);
      showSuccess('Icon removed successfully!');
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove icon');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Company Branding
        </Typography>
      </Box>

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

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Company Logo
            </Typography>
            <Typography variant="caption" sx={{ mb: 2, color: theme.palette.text.secondary, display: 'block' }}>
              Recommended: 280x40px, SVG or PNG (max 2MB)
            </Typography>
            {logoUrl && (
              <Box sx={{ mb: 2 }}>
                <Box
                  component="img"
                  src={logoUrl}
                  alt="Company Logo"
                  sx={{
                    maxHeight: 60,
                    maxWidth: '100%',
                    objectFit: 'contain',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    p: 1,
                    backgroundColor: theme.palette.background.default,
                  }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                {uploadingLogo ? 'Uploading...' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
              </Button>
              {logoUrl && (
                <Button
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveLogo}
                  sx={{
                    borderColor: theme.palette.error.main,
                    color: theme.palette.error.main,
                    '&:hover': {
                      borderColor: theme.palette.error.dark,
                      backgroundColor: theme.palette.error.dark + '20',
                    },
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, color: theme.palette.text.primary, fontWeight: 600 }}>
              Company Icon
            </Typography>
            <Typography variant="caption" sx={{ mb: 2, color: theme.palette.text.secondary, display: 'block' }}>
              Recommended: 32x32px, SVG or PNG (max 1MB)
            </Typography>
            {iconUrl && (
              <Box sx={{ mb: 2 }}>
                <Box
                  component="img"
                  src={iconUrl}
                  alt="Company Icon"
                  sx={{
                    height: 40,
                    width: 40,
                    objectFit: 'contain',
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                    p: 1,
                    backgroundColor: theme.palette.background.default,
                  }}
                />
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => iconInputRef.current?.click()}
                disabled={uploadingIcon}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                {uploadingIcon ? 'Uploading...' : iconUrl ? 'Replace Icon' : 'Upload Icon'}
              </Button>
              {iconUrl && (
                <Button
                  variant="outlined"
                  startIcon={<DeleteIcon />}
                  onClick={handleRemoveIcon}
                  sx={{
                    borderColor: theme.palette.error.main,
                    color: theme.palette.error.main,
                    '&:hover': {
                      borderColor: theme.palette.error.dark,
                      backgroundColor: theme.palette.error.dark + '20',
                    },
                  }}
                >
                  Remove
                </Button>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
