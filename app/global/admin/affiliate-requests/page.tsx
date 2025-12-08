'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  useTheme,
  alpha,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { AffiliateApplicationWithUser } from '@/types/affiliate';

interface StatusCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export default function AffiliateRequestsPage() {
  const theme = useTheme();
  const [applications, setApplications] = useState<AffiliateApplicationWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  
  // Dialog state
  const [selectedApp, setSelectedApp] = useState<AffiliateApplicationWithUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');
  const [commissionPercentage, setCommissionPercentage] = useState(10);
  const [actionLoading, setActionLoading] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/global/admin/affiliate-requests?status=${statusFilter}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch applications');
      }
      const data = await response.json();
      setApplications(data.applications || []);
      setCounts(data.counts || { pending: 0, approved: 0, rejected: 0, total: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleViewDetails = (app: AffiliateApplicationWithUser) => {
    setSelectedApp(app);
    setDialogOpen(true);
  };

  const handleAction = (app: AffiliateApplicationWithUser, action: 'approve' | 'reject') => {
    setSelectedApp(app);
    setActionType(action);
    setAdminNotes('');
    setCommissionPercentage(10);
    setActionDialogOpen(true);
  };

  const submitAction = async () => {
    if (!selectedApp) return;
    
    setActionLoading(true);
    try {
      const response = await fetch(`/api/global/admin/affiliate-requests/${selectedApp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          admin_notes: adminNotes,
          commission_percentage: commissionPercentage,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Action failed');
      }

      setActionDialogOpen(false);
      loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'approved':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Affiliate Applications
        </Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={loadApplications}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
              {counts.pending}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending Review
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.success.main }}>
              {counts.approved}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
              {counts.rejected}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rejected
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* Filter Tabs */}
      <Tabs
        value={statusFilter}
        onChange={(_, newValue) => setStatusFilter(newValue)}
        sx={{ mb: 2 }}
      >
        <Tab label={`Pending (${counts.pending})`} value="pending" />
        <Tab label={`Approved (${counts.approved})`} value="approved" />
        <Tab label={`Rejected (${counts.rejected})`} value="rejected" />
        <Tab label={`All (${counts.total})`} value="all" />
      </Tabs>

      {/* Applications Table */}
      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell sx={{ fontWeight: 600 }}>Applicant</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Company</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Audience</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Applied</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No applications found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <TableRow
                  key={app.id}
                  hover
                  sx={{
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.03),
                    },
                  }}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {app.name}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell>{app.company_name || '-'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                      {app.audience_size}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={app.status}
                      color={getStatusColor(app.status)}
                      size="small"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton size="small" onClick={() => handleViewDetails(app)}>
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {app.status === 'pending' && (
                      <>
                        <Tooltip title="Approve">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => handleAction(app, 'approve')}
                          >
                            <ApproveIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reject">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleAction(app, 'reject')}
                          >
                            <RejectIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* View Details Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          Application Details
        </DialogTitle>
        <DialogContent>
          {selectedApp && (
            <Stack spacing={3} sx={{ mt: 2 }}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Personal Information
                  </Typography>
                  <Typography><strong>Name:</strong> {selectedApp.name}</Typography>
                  <Typography><strong>Email:</strong> {selectedApp.email}</Typography>
                  {selectedApp.company_name && (
                    <Typography><strong>Company:</strong> {selectedApp.company_name}</Typography>
                  )}
                  {selectedApp.website && (
                    <Typography>
                      <strong>Website:</strong>{' '}
                      <a href={selectedApp.website} target="_blank" rel="noopener noreferrer">
                        {selectedApp.website}
                      </a>
                    </Typography>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Audience
                  </Typography>
                  <Typography><strong>Size:</strong> {selectedApp.audience_size}</Typography>
                  {selectedApp.audience_description && (
                    <Typography><strong>Description:</strong> {selectedApp.audience_description}</Typography>
                  )}
                  {selectedApp.social_media_links && selectedApp.social_media_links.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Typography><strong>Social Links:</strong></Typography>
                      {selectedApp.social_media_links.map((link: string, i: number) => (
                        <Typography key={i} variant="body2" sx={{ ml: 2 }}>
                          <LinkIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                          <a href={link} target="_blank" rel="noopener noreferrer">{link}</a>
                        </Typography>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Promotion Methods
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedApp.promotion_methods?.map((method: string) => (
                      <Chip key={method} label={method} size="small" />
                    ))}
                  </Box>
                  {selectedApp.motivation && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        Motivation
                      </Typography>
                      <Typography variant="body2">{selectedApp.motivation}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {selectedApp.admin_notes && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Admin Notes
                    </Typography>
                    <Typography variant="body2">{selectedApp.admin_notes}</Typography>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {selectedApp?.status === 'pending' && (
            <>
              <Button
                color="error"
                onClick={() => {
                  setDialogOpen(false);
                  handleAction(selectedApp, 'reject');
                }}
              >
                Reject
              </Button>
              <Button
                color="success"
                variant="contained"
                onClick={() => {
                  setDialogOpen(false);
                  handleAction(selectedApp, 'approve');
                }}
              >
                Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onClose={() => setActionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {actionType === 'approve' && (
              <TextField
                fullWidth
                type="number"
                label="Commission Percentage"
                value={commissionPercentage}
                onChange={(e) => setCommissionPercentage(Number(e.target.value))}
                inputProps={{ min: 0, max: 100 }}
                helperText="Percentage of referred subscription revenue paid as commission"
              />
            )}
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Admin Notes (Optional)"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={
                actionType === 'approve'
                  ? 'Notes about the approval...'
                  : 'Reason for rejection...'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActionDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionType === 'approve' ? 'success' : 'error'}
            onClick={submitAction}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <CircularProgress size={20} color="inherit" />
            ) : actionType === 'approve' ? (
              'Approve'
            ) : (
              'Reject'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

