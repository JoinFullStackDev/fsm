'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  Grid,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  CalendarToday as CalendarIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { FeatureBugRequest } from '@/types/requests';

interface UserRequestDetailDialogProps {
  open: boolean;
  onClose: () => void;
  request: FeatureBugRequest;
}

export default function UserRequestDetailDialog({
  open,
  onClose,
  request,
}: UserRequestDetailDialogProps) {
  const theme = useTheme();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'default';
      case 'in_progress':
        return 'primary';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'default';
      case 'medium':
        return 'info';
      case 'high':
        return 'warning';
      case 'critical':
        return 'error';
      default:
        return 'default';
    }
  };

  const isBugReport = request.type === 'bug';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: theme.palette.text.primary,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isBugReport ? (
            <BugReportIcon sx={{ color: theme.palette.error.main }} />
          ) : (
            <LightbulbIcon sx={{ color: theme.palette.primary.main }} />
          )}
          {isBugReport ? 'Bug Report Details' : 'Feature Request Details'}
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 'auto', p: 0.5, color: theme.palette.text.secondary }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        <Grid container spacing={3}>
          {/* Left Column - Request Details */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, mb: 2, backgroundColor: theme.palette.background.default, border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
                {request.title}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap', color: theme.palette.text.primary }}>
                {request.description}
              </Typography>

              {isBugReport && (
                <>
                  {request.page_url && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LinkIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                          Page URL
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        component="a"
                        href={request.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          color: theme.palette.primary.main,
                          textDecoration: 'none',
                          wordBreak: 'break-all',
                          '&:hover': { textDecoration: 'underline' },
                        }}
                      >
                        {request.page_url}
                      </Typography>
                    </Box>
                  )}

                  {request.steps_to_reproduce && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
                        Steps to Reproduce
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: theme.palette.text.secondary }}>
                        {request.steps_to_reproduce}
                      </Typography>
                    </Box>
                  )}

                  {request.expected_behavior && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
                        Expected Behavior
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: theme.palette.text.secondary }}>
                        {request.expected_behavior}
                      </Typography>
                    </Box>
                  )}

                  {request.actual_behavior && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
                        Actual Behavior
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: theme.palette.text.secondary }}>
                        {request.actual_behavior}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          {/* Right Column - Status Info */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, backgroundColor: theme.palette.background.default, border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.primary }}>
                Status Information
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={request.type}
                    icon={isBugReport ? <BugReportIcon /> : <LightbulbIcon />}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={request.status.replace('_', ' ')}
                    color={getStatusColor(request.status) as 'default' | 'primary' | 'success' | 'secondary'}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Priority
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={request.priority}
                    color={getPriorityColor(request.priority) as 'default' | 'info' | 'warning' | 'error'}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2, borderColor: theme.palette.divider }} />

              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CalendarIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />
                  <Typography variant="caption" color="text.secondary">
                    Submitted
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                  {formatDate(request.created_at)}
                </Typography>
              </Box>

              {request.resolved_at && (
                <Box sx={{ mb: 1, mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Resolved
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.success.main }}>
                    {formatDate(request.resolved_at)}
                  </Typography>
                </Box>
              )}

              {request.resolution_notes && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Resolution Notes
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.primary, mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {request.resolution_notes}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

