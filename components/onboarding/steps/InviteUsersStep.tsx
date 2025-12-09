'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  PersonAdd as PersonAddIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOnboarding } from '../OnboardingProvider';
import type { User, UserRole } from '@/types/project';

interface InviteUsersStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function InviteUsersStep({ onComplete, onSkip }: InviteUsersStepProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { saving: contextSaving } = useOnboarding();

  const [pendingInvites, setPendingInvites] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'engineer' as UserRole,
  });

  const hasPendingInvites = pendingInvites.length > 0;

  // Load pending invites (users with invited_by_admin = true and no last_active_at)
  const loadPendingInvites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users?status=pending');
      if (!response.ok) {
        // Silently fail - user may not have permission
        setLoading(false);
        return;
      }
      const data = await response.json();
      // Filter for pending invites
      const pending = (data.users || []).filter(
        (u: User) => u.invited_by_admin && !u.last_active_at
      );
      setPendingInvites(pending.slice(0, 5));
    } catch (err) {
      console.error('Failed to load pending invites:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingInvites();
  }, [loadPendingInvites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          role: formData.role,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to invite user');
      }

      showSuccess('Invitation sent successfully');
      await loadPendingInvites();
      setShowForm(false);
      setFormData({ name: '', email: '', role: 'engineer' });
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to invite user';
      setError(errorMessage);
      showError(errorMessage);
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

  return (
    <Box>
      {error && !showForm && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Pending Invites Summary */}
      {hasPendingInvites && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PendingIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {pendingInvites.length} Pending {pendingInvites.length === 1 ? 'Invite' : 'Invites'}
            </Typography>
          </Box>

          <Paper
            sx={{
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
            }}
          >
            <List dense disablePadding>
              {pendingInvites.map((user, index) => (
                <ListItem
                  key={user.id}
                  sx={{
                    borderBottom:
                      index < pendingInvites.length - 1
                        ? `1px solid ${theme.palette.divider}`
                        : 'none',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <EmailIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={user.name || user.email}
                    secondary={user.email}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      color: theme.palette.text.secondary,
                    }}
                  />
                  <Chip
                    label={user.role}
                    size="small"
                    sx={{
                      backgroundColor: theme.palette.action.selected,
                      color: theme.palette.text.secondary,
                      fontSize: '0.7rem',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Box>
      )}

      {/* Add Invite Button / Form Toggle */}
      <Button
        startIcon={showForm ? <ExpandLessIcon /> : hasPendingInvites ? <AddIcon /> : <PersonAddIcon />}
        onClick={() => setShowForm(!showForm)}
        variant={hasPendingInvites ? 'outlined' : 'contained'}
        fullWidth={!hasPendingInvites}
        sx={
          hasPendingInvites
            ? {
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                mb: 2,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }
            : {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px dashed ${theme.palette.divider}`,
                mb: 2,
                py: 2,
                '&:hover': {
                  backgroundColor: theme.palette.action.selected,
                  borderColor: theme.palette.text.primary,
                },
              }
        }
      >
        {showForm ? 'Hide Form' : hasPendingInvites ? 'Invite Another User' : 'Invite Your First Team Member'}
      </Button>

      {/* Invite User Form */}
      <Collapse in={showForm}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{
            p: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            mb: 2,
          }}
        >
          {error && showForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            margin="dense"
            size="small"
            placeholder="Team member's full name"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            required
            margin="dense"
            size="small"
            placeholder="email@company.com"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />

          <FormControl fullWidth margin="dense" size="small" sx={{ mb: 2 }}>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Role</InputLabel>
            <Select
              value={formData.role}
              label="Role"
              onChange={(e) => setFormData((prev) => ({ ...prev, role: e.target.value as UserRole }))}
              sx={{
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              }}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="pm">Project Manager</MenuItem>
              <MenuItem value="designer">Designer</MenuItem>
              <MenuItem value="engineer">Engineer</MenuItem>
            </Select>
          </FormControl>

          <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
            An invitation email will be sent to this user with instructions to set up their account.
          </Alert>

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={saving}
              sx={{ color: theme.palette.text.secondary }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !formData.name.trim() || !formData.email.trim()}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': { backgroundColor: theme.palette.text.secondary },
              }}
            >
              {saving ? <CircularProgress size={20} /> : 'Send Invitation'}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
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
          {hasPendingInvites ? 'Skip' : 'Skip for Now'}
        </Button>
        {hasPendingInvites && (
          <Button
            variant="contained"
            onClick={onComplete}
            disabled={saving || contextSaving}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.secondary,
              },
            }}
          >
            Finish Setup
          </Button>
        )}
      </Box>
    </Box>
  );
}

