'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useUser } from '@/components/providers/UserProvider';
import { useOnboarding } from '../OnboardingProvider';

interface ProfileStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function ProfileStep({ onComplete, onSkip }: ProfileStepProps) {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { user, refresh } = useUser();
  const { saving: contextSaving } = useOnboarding();

  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if profile is already completed
  const isProfileComplete = Boolean(user?.name && user?.name.trim().length > 0);

  // Load existing data
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        title: user.title || '',
        bio: user.bio || '',
      });
      setAvatarPreview(user.avatar_url || null);
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        setError('File must be an image');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate name
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let avatarUrl = user.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          setSaving(false);
          return;
        }

        const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;

        // Delete old avatar if exists
        if (user.avatar_url) {
          try {
            const oldFileName = user.avatar_url.split('/').pop()?.split('?')[0];
            if (oldFileName) {
              await supabase.storage.from('avatars').remove([oldFileName]);
            }
          } catch {
            // Continue anyway
          }
        }

        // Upload new avatar
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: avatarFile.type,
          });

        if (uploadError) {
          setError('Failed to upload avatar: ' + uploadError.message);
          setSaving(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        avatarUrl = publicUrl;
      }

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: formData.name.trim(),
          title: formData.title.trim() || null,
          bio: formData.bio.trim() || null,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) {
        setError('Failed to save profile: ' + updateError.message);
        setSaving(false);
        return;
      }

      // Refresh user data
      await refresh();
      onComplete();
    } catch (err) {
      setError('Failed to save profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (isProfileComplete) {
    // Show summary view
    return (
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
          <Typography variant="subtitle1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Profile Complete
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            backgroundColor: theme.palette.action.hover,
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Avatar
            src={user?.avatar_url || undefined}
            sx={{ width: 64, height: 64 }}
          >
            {user?.name?.[0]?.toUpperCase() || <PersonIcon />}
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>
              {user?.name}
            </Typography>
            {user?.title && (
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                {user.title}
              </Typography>
            )}
            {user?.bio && (
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  mt: 0.5,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {user.bio}
              </Typography>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="outlined"
            onClick={onSkip}
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Edit Profile
          </Button>
          <Button
            variant="contained"
            onClick={onComplete}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.secondary,
              },
            }}
          >
            Continue
          </Button>
        </Box>
      </Box>
    );
  }

  // Show form view
  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Avatar Upload */}
        <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Avatar
              src={avatarPreview || undefined}
              sx={{
                width: 100,
                height: 100,
                mb: 1,
                border: `2px solid ${theme.palette.divider}`,
              }}
            >
              {formData.name?.[0]?.toUpperCase() || <PersonIcon sx={{ fontSize: 48 }} />}
            </Avatar>
            <Button
              component="label"
              size="small"
              startIcon={<UploadIcon />}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Upload Photo
              <input
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileChange}
              />
            </Button>
          </Box>
        </Grid>

        {/* Name Field */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Your full name"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
            }}
          />
        </Grid>

        {/* Title Field */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Job Title"
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Software Engineer, Product Manager"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
            }}
          />
        </Grid>

        {/* Bio Field */}
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Bio"
            value={formData.bio}
            onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
            multiline
            rows={2}
            placeholder="A brief description about yourself"
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
            }}
          />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
        <Button
          variant="outlined"
          onClick={onSkip}
          disabled={saving || contextSaving}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Skip for Now
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || contextSaving || !formData.name.trim()}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? <CircularProgress size={20} /> : 'Save & Continue'}
        </Button>
      </Box>
    </Box>
  );
}

