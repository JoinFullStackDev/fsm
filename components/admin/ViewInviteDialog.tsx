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
  IconButton,
  CircularProgress,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Email as EmailIcon,
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
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResendInvite = async () => {
    setLoading(true);
    setError(null);
    setEmailSent(false);

    try {
      const response = await fetch(`/api/admin/users/${userId}/invite`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || data.message || 'Failed to resend invitation email';
        setError(errorMessage);
        showError(errorMessage);
        setLoading(false);
        return;
      }

      setEmailSent(true);
      showSuccess('Invitation email sent successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resend invitation';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmailSent(false);
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
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: theme.palette.action.hover,
          color: theme.palette.text.primary,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
          Resend Invitation
        </Typography>
        <IconButton
          onClick={handleClose}
          disabled={loading}
          sx={{ 
            color: theme.palette.text.primary,
            '&:hover': {
              backgroundColor: theme.palette.background.paper,
            },
          }}
          size="small"
          aria-label="Close dialog"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2, 
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            {error}
          </Alert>
        )}

        {emailSent && (
          <Alert 
            severity="success" 
            icon={<CheckCircleIcon />}
            sx={{ 
              mb: 2, 
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
              Invitation email sent!
            </Typography>
            <Typography variant="body2">
              An invitation email has been sent to <strong>{userEmail}</strong>. 
              The user will receive instructions to confirm their email address and set up their password.
            </Typography>
          </Alert>
        )}

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
            Email
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {userEmail}
          </Typography>
        </Box>

        {!emailSent && (
          <Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
              Resend the invitation email to this user. They will receive a link to confirm their email address and set up their account password.
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2, mb: 2 }}>
              <li>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Confirm their email address
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Set up their account password
                </Typography>
              </li>
            </Box>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
              The invitation link will expire in 24 hours.
            </Typography>
          </Box>
        )}

        {emailSent && (
          <Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              The user will receive an email with a link to:
            </Typography>
            <Box component="ul" sx={{ mt: 1, pl: 2 }}>
              <li>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Confirm their email address
                </Typography>
              </li>
              <li>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Set up their account password
                </Typography>
              </li>
            </Box>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 1, display: 'block' }}>
              The invitation link will expire in 24 hours.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          onClick={handleClose}
          sx={{ 
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          {emailSent ? 'Done' : 'Cancel'}
        </Button>
        {!emailSent && (
          <Button
            onClick={handleResendInvite}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} sx={{ color: theme.palette.background.default }} /> : <EmailIcon />}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
              '&:disabled': {
                backgroundColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {loading ? 'Sending...' : 'Resend Invitation Email'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

