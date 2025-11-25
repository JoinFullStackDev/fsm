'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, CheckCircle as CheckCircleIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityWithCompany } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';

export default function OpportunitiesPage() {
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [opportunities, setOpportunities] = useState<OpportunityWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [opportunityToConvert, setOpportunityToConvert] = useState<OpportunityWithCompany | null>(null);
  const [converting, setConverting] = useState(false);

  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/ops/opportunities?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunities');
      }

      const data = await response.json();
      setOpportunities(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunities';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, showError]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleCreateOpportunity = () => {
    router.push('/ops/opportunities/new');
  };

  const handleViewOpportunity = (opportunity: OpportunityWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/ops/opportunities/${opportunity.id}`);
  };

  const handleEditOpportunity = (opportunity: OpportunityWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/ops/opportunities/${opportunity.id}/edit`);
  };

  const handleDeleteOpportunity = async (opportunity: OpportunityWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${opportunity.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ops/opportunities/${opportunity.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete opportunity');
      }

      showSuccess('Opportunity deleted successfully');
      loadOpportunities();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete opportunity';
      showError(errorMessage);
    }
  };

  const handleConvertOpportunity = (opportunity: OpportunityWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpportunityToConvert(opportunity);
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (!opportunityToConvert) return;

    try {
      setConverting(true);
      const response = await fetch(`/api/ops/opportunities/${opportunityToConvert.id}/convert`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert opportunity');
      }

      const project = await response.json();
      showSuccess('Opportunity converted to project successfully');
      setConvertDialogOpen(false);
      setOpportunityToConvert(null);
      loadOpportunities();
      router.push(`/project/${project.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to convert opportunity';
      showError(errorMessage);
    } finally {
      setConverting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'default';
      case 'working':
        return 'info';
      case 'negotiation':
        return 'warning';
      case 'pending':
        return 'primary';
      case 'converted':
        return 'success';
      case 'lost':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Opportunity Name',
      sortable: true,
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (value: any) => value?.name || '-',
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (value: number | null) => value ? `$${value.toLocaleString()}` : '-',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          color={getStatusColor(value) as any}
          size="small"
        />
      ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (value: string) => value || 'Manual',
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: any, row: OpportunityWithCompany) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleViewOpportunity(row, e)}
            sx={{ color: '#00E5FF' }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          {row.status !== 'converted' && (
            <IconButton
              size="small"
              onClick={(e) => handleConvertOpportunity(row, e)}
              sx={{ color: '#4CAF50' }}
              title="Convert to Project"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => handleEditOpportunity(row, e)}
            sx={{ color: '#00E5FF' }}
            title="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteOpportunity(row, e)}
            sx={{ color: '#FF1744' }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredOpportunities = opportunities.filter((opportunity) => {
    const matchesSearch = !searchTerm || 
      opportunity.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || opportunity.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Skeleton variant="text" width="200px" height={48} />
          <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
        </Box>
        <LoadingSkeleton variant="dashboard" count={6} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Opportunities
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateOpportunity}
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#00B2CC',
              boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          Add Opportunity
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: 'rgba(255, 23, 68, 0.1)',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            color: '#FF1744',
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {opportunities.length > 0 && (
        <Paper
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: '#000',
            border: '2px solid rgba(0, 229, 255, 0.2)',
            borderRadius: 2,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search opportunities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: '#00E5FF' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: '#E0E0E0',
                    '& fieldset': {
                      borderColor: 'rgba(0, 229, 255, 0.3)',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(0, 229, 255, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#00E5FF',
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                  sx={{
                    color: '#E0E0E0',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(0, 229, 255, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(0, 229, 255, 0.5)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#00E5FF',
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#00E5FF',
                    },
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="new">New</MenuItem>
                  <MenuItem value="working">Working</MenuItem>
                  <MenuItem value="negotiation">Negotiation</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="converted">Converted</MenuItem>
                  <MenuItem value="lost">Lost</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography
                variant="body2"
                sx={{
                  color: '#B0B0B0',
                  textAlign: { xs: 'left', md: 'right' },
                }}
              >
                {filteredOpportunities.length} of {opportunities.length} opportunities
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {opportunities.length === 0 && !loading ? (
        <EmptyState
          icon={<TrendingUpIcon sx={{ fontSize: 64, color: '#00E5FF' }} />}
          title="No Opportunities"
          description="Get started by creating your first opportunity"
          actionLabel="Add Opportunity"
          onAction={handleCreateOpportunity}
        />
      ) : (
        <SortableTable
          data={filteredOpportunities}
          columns={columns}
          emptyMessage="No opportunities found"
        />
      )}

      {/* Convert Confirmation Dialog */}
      {convertDialogOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
          onClick={() => setConvertDialogOpen(false)}
        >
          <Paper
            sx={{
              p: 3,
              maxWidth: 400,
              backgroundColor: '#000',
              border: '1px solid rgba(76, 175, 80, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2, color: '#4CAF50', fontWeight: 600 }}>
              Convert to Project
            </Typography>
            <Typography sx={{ mb: 3, color: '#B0B0B0' }}>
              Are you sure you want to convert &quot;{opportunityToConvert?.name}&quot; to a project? This will create a new project and mark the opportunity as converted.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setConvertDialogOpen(false)}
                disabled={converting}
                sx={{ color: '#B0B0B0' }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmConvert}
                variant="contained"
                disabled={converting}
                sx={{
                  backgroundColor: '#4CAF50',
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#45A049',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(76, 175, 80, 0.3)',
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                {converting ? 'Converting...' : 'Convert'}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

