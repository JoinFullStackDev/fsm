'use client';

import { useState, useEffect } from 'react';
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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Grid,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  Person as PersonIcon,
  CalendarToday as CalendarIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import type { FeatureBugRequestWithUser, RequestStatus, RequestPriority } from '@/types/requests';

interface RequestDetailDialogProps {
  open: boolean;
  onClose: () => void;
  request: FeatureBugRequestWithUser;
  onUpdate: () => void;
}

export default function RequestDetailDialog({
  open,
  onClose,
  request,
  onUpdate,
}: RequestDetailDialogProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RequestStatus>(request.status);
  const [priority, setPriority] = useState<RequestPriority>(request.priority);
  const [assignedTo, setAssignedTo] = useState<string | null>(request.assigned_to);
  const [resolutionNotes, setResolutionNotes] = useState<string>(request.resolution_notes || '');

  useEffect(() => {
    if (open && request) {
      setStatus(request.status);
      setPriority(request.priority);
      setAssignedTo(request.assigned_to);
      setResolutionNotes(request.resolution_notes || '');
      setError(null);
    }
  }, [open, request]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/global/admin/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          status,
          priority,
          assigned_to: assignedTo,
          resolution_notes: resolutionNotes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update request');
      }

      showSuccess('Request updated successfully');
      onUpdate();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update request';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

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
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          color: 'primary.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {isBugReport ? <BugReportIcon /> : <LightbulbIcon />}
          {isBugReport ? 'Bug Report Details' : 'Feature Request Details'}
        </Box>
        <Button onClick={onClose} sx={{ minWidth: 'auto', p: 0.5 }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Left Column - Request Details */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {request.title}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {request.description}
              </Typography>

              {isBugReport && (
                <>
                  {request.page_url && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LinkIcon fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
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
                          color: 'primary.main',
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
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Steps to Reproduce
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {request.steps_to_reproduce}
                      </Typography>
                    </Box>
                  )}

                  {request.expected_behavior && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Expected Behavior
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {request.expected_behavior}
                      </Typography>
                    </Box>
                  )}

                  {request.actual_behavior && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                        Actual Behavior
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                        {request.actual_behavior}
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </Paper>
          </Grid>

          {/* Right Column - Management */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Management
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RequestStatus)}
                  label="Status"
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="resolved">Resolved</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as RequestPriority)}
                  label="Priority"
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="critical">Critical</MenuItem>
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Assigned To (User ID)"
                value={assignedTo || ''}
                onChange={(e) => setAssignedTo(e.target.value || null)}
                placeholder="Enter user ID"
                sx={{ mb: 2 }}
                helperText="Optional: Assign to a specific user"
              />

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Resolution Notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Add notes about resolution..."
                sx={{ mb: 2 }}
              />
            </Paper>

            <Paper sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Information
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
                  Current Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={request.status.replace('_', ' ')}
                    color={getStatusColor(request.status) as any}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Current Priority
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={request.priority}
                    color={getPriorityColor(request.priority) as any}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <PersonIcon fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    Submitted By
                  </Typography>
                </Box>
                <Typography variant="body2">
                  {request.user?.name || request.user?.email || 'Unknown'}
                </Typography>
                {request.user?.email && request.user?.name && (
                  <Typography variant="caption" color="text.secondary">
                    {request.user.email}
                  </Typography>
                )}
              </Box>

              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <CalendarIcon fontSize="small" />
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                </Box>
                <Typography variant="body2">{formatDate(request.created_at)}</Typography>
              </Box>

              {request.resolved_at && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Resolved
                  </Typography>
                  <Typography variant="body2">{formatDate(request.resolved_at)}</Typography>
                  {request.resolved_user && (
                    <Typography variant="caption" color="text.secondary">
                      by {request.resolved_user.name || request.resolved_user.email}
                    </Typography>
                  )}
                </Box>
              )}

              {request.assigned_user && (
                <Box sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Assigned To
                  </Typography>
                  <Typography variant="body2">
                    {request.assigned_user.name || request.assigned_user.email}
                  </Typography>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={onClose}
          disabled={saving}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Close
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

