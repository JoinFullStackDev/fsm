'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  BugReport as BugReportIcon,
  Lightbulb as LightbulbIcon,
  Add as AddIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import SortableTable, { type Column } from '@/components/dashboard/SortableTable';
import RequestSubmissionDialog from '@/components/layout/RequestSubmissionDialog';
import UserRequestDetailDialog from '@/components/layout/UserRequestDetailDialog';
import type { FeatureBugRequest } from '@/types/requests';

type RequestTypeFilter = 'all' | 'feature' | 'bug';
type RequestStatusFilter = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

export default function MyRequestsPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [requests, setRequests] = useState<FeatureBugRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<RequestTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<RequestStatusFilter>('all');
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FeatureBugRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }
      setAuthLoading(false);
    };
    checkAuth();
  }, [router, supabase]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') {
        params.append('type', typeFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/requests/mine?${params}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load requests');
      }
      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => {
    if (!authLoading) {
      loadRequests();
    }
  }, [authLoading, loadRequests]);

  const handleViewRequest = (request: FeatureBugRequest) => {
    setSelectedRequest(request);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setSelectedRequest(null);
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'success' | 'secondary' => {
    switch (status) {
      case 'open': return 'default';
      case 'in_progress': return 'primary';
      case 'resolved': return 'success';
      case 'closed': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string): 'default' | 'info' | 'warning' | 'error' => {
    switch (priority) {
      case 'low': return 'default';
      case 'medium': return 'info';
      case 'high': return 'warning';
      case 'critical': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns: Column<FeatureBugRequest>[] = [
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: 120,
      render: (val: unknown, row: FeatureBugRequest) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {row.type === 'bug' ? (
            <BugReportIcon fontSize="small" sx={{ color: theme.palette.error.main }} />
          ) : (
            <LightbulbIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
          )}
          <Typography variant="body2" sx={{ textTransform: 'capitalize', color: theme.palette.text.primary }}>
            {row.type}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      render: (val: unknown, row: FeatureBugRequest) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
            {row.title}
          </Typography>
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block', mt: 0.5 }}>
            {row.description.substring(0, 80)}
            {row.description.length > 80 ? '...' : ''}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: 130,
      align: 'center',
      render: (val: unknown, row: FeatureBugRequest) => (
        <Chip
          label={row.status.replace('_', ' ')}
          color={getStatusColor(row.status)}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      width: 100,
      align: 'center',
      render: (val: unknown, row: FeatureBugRequest) => (
        <Chip
          label={row.priority}
          color={getPriorityColor(row.priority)}
          size="small"
          sx={{ textTransform: 'capitalize' }}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Submitted',
      sortable: true,
      width: 120,
      render: (val: unknown, row: FeatureBugRequest) => (
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
          {formatDate(row.created_at)}
        </Typography>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      width: 80,
      align: 'center',
      render: (val: unknown, row: FeatureBugRequest) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            handleViewRequest(row);
          }}
          title="View Details"
          sx={{ color: theme.palette.text.primary }}
        >
          <ViewIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  if (authLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: '1.5rem',
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 0.5,
            }}
          >
            My Requests
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Track your feature requests and bug reports
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setRequestDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          New Request
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={(e) => setTypeFilter(e.target.value as RequestTypeFilter)}
            sx={{
              color: theme.palette.text.primary,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider,
              },
            }}
          >
            <MenuItem value="all">All Types</MenuItem>
            <MenuItem value="feature">Feature Requests</MenuItem>
            <MenuItem value="bug">Bug Reports</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value as RequestStatusFilter)}
            sx={{
              color: theme.palette.text.primary,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider,
              },
            }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="open">Open</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="closed">Closed</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={loadRequests}
          disabled={loading}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Refresh
        </Button>
        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, ml: 'auto' }}>
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: theme.palette.text.primary }} />
        </Box>
      ) : requests.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            {typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No requests found matching your filters.'
              : "You haven't submitted any requests yet."}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setRequestDialogOpen(true)}
            sx={{
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Submit your first request
          </Button>
        </Box>
      ) : (
        <SortableTable
          data={requests}
          columns={columns}
          onRowClick={handleViewRequest}
          emptyMessage="No requests found"
        />
      )}

      <RequestSubmissionDialog
        open={requestDialogOpen}
        onClose={() => {
          setRequestDialogOpen(false);
          loadRequests();
        }}
      />

      {selectedRequest && (
        <UserRequestDetailDialog
          open={detailDialogOpen}
          onClose={handleCloseDetailDialog}
          request={selectedRequest}
        />
      )}
    </Box>
  );
}

