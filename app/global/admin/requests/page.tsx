'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Visibility as ViewIcon,
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import RequestDetailDialog from '@/components/global-admin/RequestDetailDialog';
import type { FeatureBugRequestWithUser } from '@/types/requests';

type RequestTypeFilter = 'all' | 'feature' | 'bug';
type RequestStatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

export default function RequestsPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [requests, setRequests] = useState<FeatureBugRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all');
  const [selectedRequest, setSelectedRequest] = useState<FeatureBugRequestWithUser | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/global/admin/requests?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load requests');
      }
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load requests';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, showError]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleViewRequest = (request: FeatureBugRequestWithUser) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedRequest(null);
  };

  const handleRequestUpdated = () => {
    loadRequests();
    handleCloseDialog();
    showSuccess('Request updated successfully');
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.75rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Feature Requests & Bug Reports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Total: {requests.length}
        </Typography>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value as RequestTypeFilter)}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="feature">Feature Requests</MenuItem>
              <MenuItem value="bug">Bug Reports</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="open">Open</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="resolved">Resolved</MenuItem>
              <MenuItem value="closed">Closed</MenuItem>
            </Select>
          </FormControl>
          <Button variant="outlined" onClick={loadRequests} disabled={loading}>
            Refresh
          </Button>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Submitted By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No requests found matching your filters.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((request) => (
                  <TableRow key={request.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {request.type === 'bug' ? (
                          <BugReportIcon fontSize="small" color="error" />
                        ) : (
                          <LightbulbIcon fontSize="small" color="primary" />
                        )}
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {request.type}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {request.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {request.description.substring(0, 60)}
                        {request.description.length > 60 ? '...' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.status.replace('_', ' ')}
                        color={getStatusColor(request.status) as any}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={request.priority}
                        color={getPriorityColor(request.priority) as any}
                        size="small"
                        sx={{ textTransform: 'capitalize' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {request.user?.name || request.user?.email || 'Unknown'}
                      </Typography>
                      {request.user?.email && request.user?.name && (
                        <Typography variant="caption" color="text.secondary">
                          {request.user.email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(request.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleViewRequest(request)}
                        title="View Details"
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {selectedRequest && (
        <RequestDetailDialog
          open={detailDialogOpen}
          onClose={handleCloseDialog}
          request={selectedRequest}
          onUpdate={handleRequestUpdated}
        />
      )}
    </Box>
  );
}

