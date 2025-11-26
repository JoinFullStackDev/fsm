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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, CheckCircle as CheckCircleIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityWithCompany } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';

export default function OpportunitiesPage() {
  const theme = useTheme();
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
      render: (value: string) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          {value}
        </Typography>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (value: any) => {
        if (!value?.name) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            {value.name}
          </Typography>
        );
      },
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (value: number | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            ${value.toLocaleString()}
          </Typography>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          size="small"
          sx={{
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            fontWeight: 500,
          }}
        />
      ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (value: string) => {
        const displayValue = value || 'Manual';
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {displayValue}
          </Typography>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {new Date(value).toLocaleDateString()}
          </Typography>
        );
      },
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
            sx={{ 
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          {row.status !== 'converted' && (
            <IconButton
              size="small"
              onClick={(e) => handleConvertOpportunity(row, e)}
              sx={{ 
                color: theme.palette.text.primary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              title="Convert to Project"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => handleEditOpportunity(row, e)}
            sx={{ 
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
            title="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteOpportunity(row, e)}
            sx={{ 
              color: theme.palette.text.primary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
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
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Opportunities
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleCreateOpportunity}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
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
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {opportunities.length > 0 && (
        <Box
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
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
                      <SearchIcon sx={{ color: theme.palette.text.primary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                  sx={{
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
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
                      color: theme.palette.text.primary,
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
            <Grid item xs={12} md={5}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  textAlign: { xs: 'left', md: 'right' },
                }}
              >
                {filteredOpportunities.length} of {opportunities.length} opportunities
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {opportunities.length === 0 && !loading ? (
        <EmptyState
          icon={<TrendingUpIcon sx={{ fontSize: 64 }} />}
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
      <Dialog
        open={convertDialogOpen}
        onClose={() => setConvertDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Convert to Project
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.text.secondary }}>
            Are you sure you want to convert &quot;{opportunityToConvert?.name}&quot; to a project? This will create a new project and mark the opportunity as converted.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setConvertDialogOpen(false)}
            disabled={converting}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmConvert}
            variant="outlined"
            disabled={converting}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {converting ? 'Converting...' : 'Convert'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

