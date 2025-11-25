'use client';

import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Grid,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Save as SaveIcon, CloudUpload as UploadIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { User } from '@/types/project';

export default function ProfileInfoTab() {
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Not authenticated');
      setLoading(false);
      return;
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', session.user.id)
      .single();

    if (userError) {
      setError(userError.message);
      setLoading(false);
      return;
    }

    const user = userData as User;
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
  };

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

      console.log('[Avatar Upload] Uploading file:', fileName, 'Size:', avatarFile.size);

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
              console.warn('[Avatar Upload] Failed to delete old avatar:', deleteError);
              // Continue anyway - not critical
            }
          }
        } catch (err) {
          console.warn('[Avatar Upload] Error deleting old avatar:', err);
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
        console.error('[Avatar Upload] Upload error:', uploadError);
        showError('Failed to upload avatar: ' + uploadError.message);
        setSaving(false);
        return;
      }

      console.log('[Avatar Upload] Upload successful:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      console.log('[Avatar Upload] Public URL:', publicUrl);

      // Update user record with new avatar URL
      const { data: updatedData, error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Avatar Upload] Update error:', updateError);
        showError('Failed to update avatar: ' + updateError.message);
        setSaving(false);
        return;
      }

      if (!updatedData) {
        console.error('[Avatar Upload] Update returned no data');
        showError('Failed to update avatar: Update returned no data. Check RLS policies.');
        setSaving(false);
        return;
      }

      console.log('[Avatar Upload] Successfully updated user:', updatedData);
      
      // Update local state
      setProfile({ ...profile, avatar_url: publicUrl });
      setAvatarPreview(publicUrl);
      setAvatarFile(null);
      showSuccess('Avatar uploaded successfully!');
    } catch (err) {
      console.error('[Avatar Upload] Unexpected error:', err);
      showError('Failed to upload avatar: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const updateData: any = {
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
        console.error('[Profile Info] Update error:', updateError);
        console.error('[Profile Info] Update data:', updateData);
        showError('Failed to save profile: ' + updateError.message);
        setSaving(false);
        return;
      }

      if (!updatedData) {
        console.error('[Profile Info] Update returned no data');
        showError('Failed to save profile: Update returned no data. Check RLS policies.');
        setSaving(false);
        return;
      }

      console.log('[Profile Info] Successfully updated:', updatedData);
      showSuccess('Profile updated successfully!');
      await loadProfile();
    } catch (err) {
      console.error('[Profile Info] Save error:', err);
      showError('Failed to save profile: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !profile) {
    return (
      <Alert severity="error">
        {error || 'Failed to load profile'}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
          Profile Information
        </Typography>
        <Button
          startIcon={<SaveIcon />}
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar
                src={avatarPreview || undefined}
                sx={{
                  width: 120,
                  height: 120,
                  mb: 2,
                  border: '3px solid',
                  borderColor: 'primary.main',
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
                  sx={{ mb: 2 }}
                >
                  Upload Avatar
                </Button>
              </label>
              {avatarFile && (
                <Button
                  onClick={handleUploadAvatar}
                  variant="contained"
                  disabled={saving}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  {saving ? 'Uploading...' : 'Save Avatar'}
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    fullWidth
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
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    fullWidth
                    placeholder="https://example.com"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

