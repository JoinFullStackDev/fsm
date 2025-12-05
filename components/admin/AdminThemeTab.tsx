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
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Upload as UploadIcon, Delete as DeleteIcon, DarkMode as DarkModeIcon, LightMode as LightModeIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';

type BrandingType = 'logo' | 'icon' | 'logo_light' | 'icon_light';

export default function AdminThemeTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dark mode branding
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  
  // Light mode branding
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [iconLightUrl, setIconLightUrl] = useState<string | null>(null);
  
  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingLogoLight, setUploadingLogoLight] = useState(false);
  const [uploadingIconLight, setUploadingIconLight] = useState(false);
  
  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const logoLightInputRef = useRef<HTMLInputElement>(null);
  const iconLightInputRef = useRef<HTMLInputElement>(null);

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
        setLogoLightUrl(data.logo_light_url || null);
        setIconLightUrl(data.icon_light_url || null);
      }
    } catch (err) {
      console.error('Error loading branding:', err);
      setError('Failed to load branding');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: BrandingType,
    setUploading: (v: boolean) => void,
    setUrl: (v: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image file');
      return;
    }

    // Validate file size (max 2MB for logos, 1MB for icons)
    const maxSize = type.startsWith('logo') ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxSize) {
      showError(`File size must be less than ${type.startsWith('logo') ? '2MB' : '1MB'}`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch(`/api/organization/${organization.id}/branding/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to upload ${type.replace('_', ' ')}`);
      }

      const data = await response.json();
      setUrl(data.url);
      showSuccess(`${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} uploaded successfully!`);
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : `Failed to upload ${type.replace('_', ' ')}`);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleRemove = async (
    type: BrandingType,
    setUrl: (v: string | null) => void
  ) => {
    if (!organization?.id) return;

    try {
      const response = await fetch(`/api/organization/${organization.id}/branding`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to remove ${type.replace('_', ' ')}`);
      }

      setUrl(null);
      showSuccess(`${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} removed successfully!`);
      await loadBranding();
    } catch (err) {
      showError(err instanceof Error ? err.message : `Failed to remove ${type.replace('_', ' ')}`);
    }
  };

  const renderBrandingCard = (
    title: string,
    description: string,
    url: string | null,
    type: BrandingType,
    uploading: boolean,
    setUploading: (v: boolean) => void,
    setUrl: (v: string | null) => void,
    inputRef: React.RefObject<HTMLInputElement>,
    isIcon: boolean = false,
    previewBgColor?: string
  ) => (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        height: '100%',
      }}
    >
      <Typography variant="h6" sx={{ mb: 1, color: theme.palette.text.primary, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ mb: 2, color: theme.palette.text.secondary, display: 'block' }}>
        {description}
      </Typography>
      {url && (
        <Box sx={{ mb: 2 }}>
          <Box
            component="img"
            src={url}
            alt={title}
            sx={{
              maxHeight: isIcon ? 40 : 60,
              maxWidth: isIcon ? 40 : '100%',
              width: isIcon ? 40 : 'auto',
              height: isIcon ? 40 : 'auto',
              objectFit: 'contain',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              p: 1,
              backgroundColor: previewBgColor || theme.palette.background.default,
            }}
          />
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleUpload(e, type, setUploading, setUrl, inputRef)}
          style={{ display: 'none' }}
        />
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {uploading ? 'Uploading...' : url ? 'Replace' : 'Upload'}
        </Button>
        {url && (
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => handleRemove(type, setUrl)}
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
  );

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

      {/* Dark Mode Section */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DarkModeIcon sx={{ color: theme.palette.text.secondary }} />
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Dark Mode Assets
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
            (Used when the app is in dark mode)
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderBrandingCard(
              'Company Logo (Dark Mode)',
              'Recommended: 280x40px, SVG or PNG (max 2MB). Should be visible on dark backgrounds.',
              logoUrl,
              'logo',
              uploadingLogo,
              setUploadingLogo,
              setLogoUrl,
              logoInputRef,
              false,
              '#1a1a1a' // Dark preview background
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderBrandingCard(
              'Company Icon (Dark Mode)',
              'Recommended: 32x32px, SVG or PNG (max 1MB). Should be visible on dark backgrounds.',
              iconUrl,
              'icon',
              uploadingIcon,
              setUploadingIcon,
              setIconUrl,
              iconInputRef,
              true,
              '#1a1a1a' // Dark preview background
            )}
          </Grid>
        </Grid>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Light Mode Section */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LightModeIcon sx={{ color: theme.palette.warning.main }} />
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Light Mode Assets
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
            (Optional - Falls back to dark mode assets if not set)
          </Typography>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderBrandingCard(
              'Company Logo (Light Mode)',
              'Recommended: 280x40px, SVG or PNG (max 2MB). Should be visible on light backgrounds.',
              logoLightUrl,
              'logo_light',
              uploadingLogoLight,
              setUploadingLogoLight,
              setLogoLightUrl,
              logoLightInputRef,
              false,
              '#f5f5f5' // Light preview background
            )}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderBrandingCard(
              'Company Icon (Light Mode)',
              'Recommended: 32x32px, SVG or PNG (max 1MB). Should be visible on light backgrounds.',
              iconLightUrl,
              'icon_light',
              uploadingIconLight,
              setUploadingIconLight,
              setIconLightUrl,
              iconLightInputRef,
              true,
              '#f5f5f5' // Light preview background
            )}
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
