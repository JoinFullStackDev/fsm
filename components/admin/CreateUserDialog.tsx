'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
  CircularProgress,
  useTheme,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useReturnFocus, useFocusOnError } from '@/lib/hooks/useFocusManagement';
import { validateEmail, validateUserName } from '@/lib/utils/validation';
import logger from '@/lib/utils/logger';
import type { UserRole } from '@/types/project';

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onUserCreated: () => void;
}

export default function CreateUserDialog({
  open,
  onClose,
  onUserCreated,
}: CreateUserDialogProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { organization } = useOrganization();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('pm');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<{
    email: string;
    invitationSent: boolean;
  } | null>(null);
  const [shouldFocusOnError, setShouldFocusOnError] = useState(false);
  const [costConfirmed, setCostConfirmed] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    perUserPrice: number | null;
    billingInterval: 'month' | 'year' | null;
    pricingModel: 'per_user' | 'flat_rate' | null;
  } | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const roleSelectRef = useRef<HTMLDivElement>(null);

  // Return focus when modal closes
  useReturnFocus(open);

  // Load subscription info when dialog opens
  useEffect(() => {
    if (open && !createdUser && organization?.id) {
      const loadSubscriptionInfo = async () => {
        try {
          const response = await fetch('/api/organization/subscription');
          if (response.ok) {
            const data = await response.json();
            const sub = data.subscription;
            if (sub?.package) {
              const packageData = sub.package;
              const billingInterval = sub.billing_interval || 'month';
              const pricingModel = packageData.pricing_model || 'per_user';
              
              let perUserPrice: number | null = null;
              if (pricingModel === 'per_user') {
                perUserPrice = billingInterval === 'month' 
                  ? packageData.price_per_user_monthly 
                  : packageData.price_per_user_yearly;
              }

              setSubscriptionInfo({
                perUserPrice,
                billingInterval,
                pricingModel,
              });
            }
          }
        } catch (err) {
          logger.debug('[CreateUserDialog] Error loading subscription info:', err);
        }
      };
      loadSubscriptionInfo();
    }
  }, [open, createdUser, organization?.id]);

  // Focus on first field when modal opens
  useEffect(() => {
    if (open && !createdUser) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
      // Reset focus on error flag when dialog opens
      setShouldFocusOnError(false);
    }
  }, [open, createdUser]);

  // Client-side validation
  const nameValidation = validateUserName(name);
  const emailValidation = validateEmail(email);
  
  // Focus on first error field when error occurs (only after submission attempt)
  const errorFields = {
    name: !nameValidation.valid ? nameValidation.error : undefined,
    email: !emailValidation.valid ? emailValidation.error : undefined,
    general: error && nameValidation.valid && emailValidation.valid ? error : undefined,
  };
  const fieldRefs = {
    name: nameInputRef,
    email: emailInputRef,
  };
  // Only focus on errors if shouldFocusOnError is true AND there are actual errors
  // AND user is not currently typing
  const hasErrors = Object.values(errorFields).some(err => !!err);
  const activeElement = typeof document !== 'undefined' ? document.activeElement : null;
  const isTyping = activeElement && (
    activeElement.tagName === 'INPUT' ||
    activeElement.tagName === 'TEXTAREA' ||
    activeElement.getAttribute('contenteditable') === 'true'
  );
  useFocusOnError(errorFields, fieldRefs, shouldFocusOnError && hasErrors && !isTyping);

  // Debug: Log when createdUser changes
  useEffect(() => {
    if (createdUser) {
      logger.debug('[CreateUserDialog] createdUser state updated:', createdUser);
    }
  }, [createdUser]);

  const handleClose = () => {
    if (!loading) {
      // If a user was created, refresh the list before closing
      if (createdUser) {
        onUserCreated();
      }
      
      setName('');
      setEmail('');
      setRole('pm');
      setError(null);
      setCreatedUser(null);
      setCostConfirmed(false);
      setSubscriptionInfo(null);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double submission
    if (loading) {
      logger.debug('[CreateUserDialog] Already submitting, ignoring...');
      return;
    }
    
    // Client-side validation
    const nameValidation = validateUserName(name);
    const emailValidation = validateEmail(email);
    
    if (!nameValidation.valid || !emailValidation.valid) {
      setError(nameValidation.error || emailValidation.error || 'Please fix the errors above');
      setLoading(false);
      // Enable focus on error after submission attempt
      setShouldFocusOnError(true);
      return;
    }

    // Check cost confirmation for per-user pricing
    if (subscriptionInfo?.pricingModel === 'per_user' && subscriptionInfo.perUserPrice && !costConfirmed) {
      setError('Please confirm that you understand adding this user will increase your subscription cost');
      setLoading(false);
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      logger.debug('[CreateUserDialog] Submitting user creation:', { name, email, role });
      
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role }),
      });

      const data = await response.json();
      logger.debug('[CreateUserDialog] API response:', { status: response.status, data });

      if (!response.ok) {
        const errorMsg = data.error || 'Failed to create user';
        logger.error('[CreateUserDialog] API error:', errorMsg);
        setError(errorMsg);
        setLoading(false);
        return;
      }

      // Verify we have the required data
      if (!data.user) {
        logger.error('[CreateUserDialog] Invalid response format:', data);
        setError('Invalid response from server. User may not have been created.');
        setLoading(false);
        return;
      }

      logger.debug('[CreateUserDialog] Setting createdUser state:', {
        email: data.user.email,
        invitationSent: data.invitationSent,
      });

      // Set the created user state to show success message
      // Don't call onUserCreated yet - wait until user closes the dialog
      setCreatedUser({
        email: data.user.email,
        invitationSent: data.invitationSent || false,
      });
      
      showSuccess('User created successfully');
      
      // Note: We don't call onUserCreated here - we'll call it when dialog closes
      // This prevents the dialog from closing/reloading
    } catch (err) {
      logger.error('[CreateUserDialog] Exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to create user');
      setLoading(false);
    } finally {
      setLoading(false);
    }
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
          {createdUser ? 'User Created Successfully' : 'Create New User'}
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
        {createdUser ? (
          <Box>
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
                User created successfully!
              </Typography>
              {createdUser.invitationSent ? (
                <Typography variant="body2">
                  An invitation email has been sent to <strong>{createdUser.email}</strong>. 
                  The user will receive instructions to confirm their email address and set up their password.
                </Typography>
              ) : (
                <Typography variant="body2">
                  User account created for <strong>{createdUser.email}</strong>. 
                  However, the invitation email could not be sent. The user can request a password reset to set up their account.
                </Typography>
              )}
            </Alert>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                Email
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                {createdUser.email}
              </Typography>
            </Box>

            {createdUser.invitationSent && (
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
          </Box>
        ) : (
          <Box 
            component="form" 
            onSubmit={(e) => {
              logger.debug('[CreateUserDialog] Form onSubmit triggered');
              handleSubmit(e);
            }}
            sx={{ mt: 1 }}
          >
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

            {subscriptionInfo?.pricingModel === 'per_user' && subscriptionInfo.perUserPrice && (
              <Alert 
                severity="info" 
                sx={{ 
                  mb: 2, 
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Adding a user will increase your subscription cost
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  Adding this user will increase your monthly subscription by{' '}
                  <strong>${subscriptionInfo.perUserPrice.toFixed(2)}/{subscriptionInfo.billingInterval === 'year' ? 'year' : 'month'}</strong>.
                </Typography>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={costConfirmed}
                      onChange={(e) => setCostConfirmed(e.target.checked)}
                      sx={{
                        color: theme.palette.text.secondary,
                        '&.Mui-checked': {
                          color: theme.palette.text.primary,
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                      I understand that adding this user will increase my subscription cost
                    </Typography>
                  }
                />
              </Alert>
            )}

            <TextField
              fullWidth
              inputRef={nameInputRef}
              label="Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Clear validation error when user types
                if (errorFields.name) {
                  setError(null);
                }
                // Disable auto-focus while user is typing
                setShouldFocusOnError(false);
              }}
              required
              margin="normal"
              disabled={loading}
              error={!!errorFields.name}
              helperText={errorFields.name}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: errorFields.name ? theme.palette.error.main : theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: errorFields.name ? theme.palette.error.main : theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: errorFields.name ? theme.palette.error.main : theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiFormHelperText-root': {
                  color: errorFields.name ? theme.palette.error.main : theme.palette.text.secondary,
                },
              }}
            />

            <TextField
              fullWidth
              inputRef={emailInputRef}
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Clear validation error when user types
                if (errorFields.email) {
                  setError(null);
                }
                // Disable auto-focus while user is typing
                setShouldFocusOnError(false);
              }}
              required
              margin="normal"
              disabled={loading}
              error={!!errorFields.email}
              helperText={errorFields.email}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: errorFields.email ? theme.palette.error.main : theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: errorFields.email ? theme.palette.error.main : theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: errorFields.email ? theme.palette.error.main : theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiFormHelperText-root': {
                  color: errorFields.email ? theme.palette.error.main : theme.palette.text.secondary,
                },
              }}
            />

            <FormControl fullWidth margin="normal" required>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Role</InputLabel>
              <Select
                value={role}
                label="Role"
                onChange={(e) => setRole(e.target.value as UserRole)}
                disabled={loading}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      '& .MuiMenuItem-root': {
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.hover,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.paper,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.primary,
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                <MenuItem value="pm">Product Manager</MenuItem>
                <MenuItem value="designer">Designer</MenuItem>
                <MenuItem value="engineer">Engineer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        {createdUser ? (
          <Button
            onClick={handleClose}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button
              onClick={handleClose}
              disabled={loading}
              sx={{ 
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={
                loading || 
                !name.trim() || 
                !email.trim() || 
                !role ||
                !!(subscriptionInfo?.pricingModel === 'per_user' && subscriptionInfo.perUserPrice && !costConfirmed)
              }
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                logger.debug('[CreateUserDialog] Button clicked:', {
                  loading,
                  name: name.trim(),
                  email: email.trim(),
                  role,
                  costConfirmed,
                  disabled: loading || !name.trim() || !email.trim() || !role || (subscriptionInfo?.pricingModel === 'per_user' && subscriptionInfo.perUserPrice && !costConfirmed),
                });
                
                const canSubmit = !loading && 
                  name.trim() && 
                  email.trim() && 
                  role &&
                  (!subscriptionInfo?.pricingModel || 
                   subscriptionInfo.pricingModel !== 'per_user' || 
                   !subscriptionInfo.perUserPrice || 
                   costConfirmed);
                
                if (canSubmit) {
                  // Create a synthetic form event
                  const syntheticEvent = {
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    currentTarget: null,
                    target: null,
                  } as unknown as React.FormEvent<HTMLFormElement>;
                  handleSubmit(syntheticEvent);
                } else {
                  logger.warn('[CreateUserDialog] Button clicked but form is invalid or loading');
                }
              }}
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
              {loading ? (
                <>
                  <CircularProgress size={16} sx={{ mr: 1, color: theme.palette.background.default }} />
                  Creating...
                </>
              ) : (
                'Create User'
              )}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

