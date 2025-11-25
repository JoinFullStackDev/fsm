'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';

interface ViewInviteDialogProps {
  open: boolean;
  userEmail: string;
  userId: string;
  onClose: () => void;
}

export default function ViewInviteDialog({
  open,
  userEmail,
  userId,
  onClose,
}: ViewInviteDialogProps) {
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadInvite = async () => {
    setLoading(true);
    setError(null);
    setTemporaryPassword(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/invite`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load invite');
        setLoading(false);
        return;
      }

      setTemporaryPassword(data.temporaryPassword);
      showSuccess('Invite password generated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassword = async () => {
    if (temporaryPassword) {
      try {
        await navigator.clipboard.writeText(temporaryPassword);
        setPasswordCopied(true);
        showSuccess('Password copied to clipboard');
        setTimeout(() => setPasswordCopied(false), 2000);
      } catch (err) {
        showError('Failed to copy password');
      }
    }
  };

  const handleClose = () => {
    setTemporaryPassword(null);
    setShowPassword(false);
    setPasswordCopied(false);
    setError(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#000',
          border: '2px solid rgba(0, 229, 255, 0.2)',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#00E5FF',
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          View Invite
        </Typography>
        <IconButton onClick={handleClose} sx={{ color: '#00E5FF' }} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, backgroundColor: 'rgba(244, 67, 54, 0.1)' }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
            Email
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {userEmail}
          </Typography>
        </Box>

        {!temporaryPassword && !loading && (
          <Alert severity="info" sx={{ mb: 2, backgroundColor: 'rgba(0, 229, 255, 0.1)' }}>
            Click &quot;Generate Password&quot; to create a new temporary password for this user.
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {temporaryPassword && (
          <Box>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              Temporary Password
            </Typography>
            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              value={temporaryPassword}
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ color: 'text.secondary', mr: 1 }}
                    >
                      {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                    <IconButton
                      onClick={handleCopyPassword}
                      edge="end"
                      sx={{ color: passwordCopied ? 'success.main' : 'text.secondary' }}
                      title="Copy password"
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              User should change this password on first login
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '2px solid rgba(0, 229, 255, 0.2)' }}>
        <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>
          {temporaryPassword ? 'Close' : 'Cancel'}
        </Button>
        {!temporaryPassword && (
          <Button
            onClick={handleLoadInvite}
            variant="contained"
            disabled={loading}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              '&:hover': {
                backgroundColor: '#00B2CC',
              },
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              'Generate Password'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

