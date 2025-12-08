'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Save as SaveIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useUser } from '@/components/providers/UserProvider';
import type { User } from '@/types/project';

export default function ProfileInfoTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { user, loading: userLoading, refresh } = useUser(); // Use UserProvider instead of direct API call
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    company: '',
    title: '',
    location: '',
    phone: '',
    website: '',
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Load profile data from UserProvider (no redundant API call)
  useEffect(() => {
    if (userLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    setProfile(user);
    setFormData({
      name: user.name || '',
      bio: user.bio || '',
      company: user.company || '',
      title: user.title || '',
      location: user.location || '',
      phone: user.phone || '',
      website: user.website || '',
    });
    setAvatarPreview(user.avatar_url || null);
    setLoading(false);
  }, [user, userLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showError('File size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        showError('File must be an image');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile || !profile) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        showError('Not authenticated');
        setSaving(false);
        return;
      }

      // Get file extension
      const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      
      // Create unique filename using user ID and timestamp
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // First, try to delete old avatar if it exists
      if (profile.avatar_url) {
        try {
          // Extract filename from URL
          const oldUrl = profile.avatar_url;
          const oldFileName = oldUrl.split('/').pop()?.split('?')[0];
          if (oldFileName) {
            const { error: deleteError } = await supabase.storage
              .from('avatars')
              .remove([oldFileName]);
            
            if (deleteError) {
              // Continue anyway - not critical
            }
          }
        } catch (err) {
          // Continue anyway
        }
      }

      // Upload new avatar
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) {
        showError('Failed to upload avatar: ' + uploadError.message);
        setSaving(false);
        return;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user record with new avatar URL
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        showError('Failed to update avatar: ' + updateError.message);
        setSaving(false);
        return;
      }

      if (!updatedData) {
        showError('Failed to update avatar: Update returned no data. Check RLS policies.');
        setSaving(false);
        return;
      }
      
      // Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      setAvatarPreview(publicUrl);
      setAvatarFile(null);
      showSuccess('Avatar uploaded successfully!');
    } catch (err) {
      showError('Failed to upload avatar: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const updateData: Partial<User> = {
        name: formData.name || null,
        bio: formData.bio || null,
        company: formData.company || null,
        title: formData.title || null,
        location: formData.location || null,
        phone: formData.phone || null,
        website: formData.website || null,
      };
      
      // Only include updated_at if the column exists (will be added via migration)
      // For now, we'll let the database trigger handle it if it exists
      
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        showError('Failed to save profile: ' + updateError.message);
        setSaving(false);
        return;
      }

      if (!updatedData) {
        showError('Failed to save profile: Update returned no data. Check RLS policies.');
        setSaving(false);
        return;
      }

      showSuccess('Profile updated successfully!');
      await refresh(); // Refresh user data from UserProvider
    } catch (err) {
      showError('Failed to save profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Alert 
        severity="error"
        sx={{
          backgroundColor: theme.palette.action.hover,
          border: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
        }}
      >
        {error || 'Failed to load profile'}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Profile Information
        </Typography>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          variant="outlined"
          disabled={saving}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
            '&.Mui-disabled': {
              borderColor: theme.palette.divider,
              color: theme.palette.text.secondary,
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Box
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Avatar
              src={avatarPreview || undefined}
              sx={{
                width: 120,
                height: 120,
                mb: 2,
                border: `2px solid ${theme.palette.divider}`,
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              }}
            >
              {formData.name?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="avatar-upload"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="avatar-upload">
              <Button
                component="span"
                variant="outlined"
                startIcon={<UploadIcon />}
                sx={{
                  mb: 2,
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Upload Avatar
              </Button>
            </label>
            {avatarFile && (
              <Button
                onClick={handleUploadAvatar}
                variant="outlined"
                disabled={saving}
                size="small"
                sx={{
                  mt: 1,
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                  '&.Mui-disabled': {
                    borderColor: theme.palette.divider,
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                {saving ? 'Uploading...' : 'Save Avatar'}
              </Button>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={8}>
          <Box
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  fullWidth
                  multiline
                  rows={3}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  fullWidth
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Website"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  fullWidth
                  placeholder="https://example.com"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                      '& fieldset': {
                        borderColor: theme.palette.divider,
                      },
                      '&:hover fieldset': {
                        borderColor: theme.palette.text.secondary,
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: theme.palette.text.primary,
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: theme.palette.text.secondary,
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </Grid>
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

