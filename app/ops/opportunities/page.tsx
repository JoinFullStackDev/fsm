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
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, Visibility as VisibilityIcon, ViewList as ViewListIcon, ViewKanban as ViewKanbanIcon } from '@mui/icons-material';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { TrendingUp as TrendingUpIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityWithCompany, OpportunityStatus } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';
import OpportunityKanban from '@/components/ops/OpportunityKanban';

export default function OpportunitiesPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [opportunities, setOpportunities] = useState<OpportunityWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');

  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      
      // In kanban mode, load all opportunities (no status filter, higher limit)
      if (viewMode === 'kanban') {
        params.append('limit', '500'); // Load more for kanban view
        params.append('offset', '0');
      } else {
        if (statusFilter !== 'all') params.append('status', statusFilter);
        const offset = (page - 1) * pageSize;
        params.append('limit', pageSize.toString());
        params.append('offset', offset.toString());
      }

      const response = await fetch(`/api/ops/opportunities?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunities');
      }

      const result = await response.json();
      setOpportunities(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunities';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page, pageSize, viewMode, showError]);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
  }, [searchTerm, statusFilter, viewMode]);

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

  const handleStatusChange = async (opportunityId: string, newStatus: OpportunityStatus) => {
    try {
      const response = await fetch(`/api/ops/opportunities/${opportunityId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      // Optimistically update the local state
      setOpportunities(prev => 
        prev.map(opp => 
          opp.id === opportunityId ? { ...opp, status: newStatus } : opp
        )
      );
      showSuccess(`Status updated to ${newStatus}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      showError(errorMessage);
      // Reload to get the correct state
      loadOpportunities();
    }
  };

  const handleKanbanView = (opportunity: OpportunityWithCompany) => {
    router.push(`/ops/opportunities/${opportunity.id}`);
  };

  const handleKanbanEdit = (opportunity: OpportunityWithCompany) => {
    router.push(`/ops/opportunities/${opportunity.id}/edit`);
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'new':
        return { backgroundColor: '#00BCD4', color: '#fff' }; // Cyan
      case 'working':
        return { backgroundColor: '#2196F3', color: '#fff' }; // Blue
      case 'negotiation':
        return { backgroundColor: '#FF9800', color: '#fff' }; // Orange
      case 'pending':
        return { backgroundColor: '#9C27B0', color: '#fff' }; // Purple
      case 'converted':
        return { backgroundColor: '#4CAF50', color: '#fff' }; // Green
      case 'lost':
        return { backgroundColor: '#F44336', color: '#fff' }; // Red
      default:
        return { backgroundColor: '#757575', color: '#fff' }; // Grey
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Opportunity Name',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string;
        return (
          <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
            {value}
          </Typography>
        );
      },
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (val: unknown) => {
        const value = val as { name?: string } | null;
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
      render: (val: unknown) => {
        const value = val as number | null;
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            ${String(value)}
          </Typography>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string;
        return (
          <Chip
            label={value.charAt(0).toUpperCase() + value.slice(1)}
            size="small"
            sx={{
              ...getStatusStyles(value),
              fontWeight: 500,
            }}
          />
        );
      },
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string;
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
      render: (val: unknown) => {
        const value = val as string;
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
      render: (_: unknown, row: OpportunityWithCompany) => (
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

  const filteredOpportunities = opportunities; // Filtering is now done server-side
  const totalPages = Math.ceil(total / pageSize);

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
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: { xs: 2, md: 0 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: { xs: '100%', md: 'auto' } }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Opportunities
          </Typography>
          {!loading && (
            <Chip
              label={total}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                fontWeight: 500,
                height: 24,
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: { xs: '100%', md: 'auto' } }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, newValue) => newValue && setViewMode(newValue)}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.secondary,
                '&.Mui-selected': {
                  backgroundColor: theme.palette.action.selected,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                },
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          >
            <ToggleButton value="list">
              <Tooltip title="List View">
                <ViewListIcon />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="kanban">
              <Tooltip title="Kanban View">
                <ViewKanbanIcon />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleCreateOpportunity}
            fullWidth={false}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              flex: { xs: 1, md: 'none' },
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Add Opportunity
          </Button>
        </Box>
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
            p: { xs: 1.5, md: 2 },
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={viewMode === 'kanban' ? 12 : 4}>
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
            {viewMode === 'list' && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                  renderValue={(selected) => {
                    if (selected === 'all') return 'All Statuses';
                    const styles: Record<string, { bg: string; label: string }> = {
                      new: { bg: '#00BCD4', label: 'New' },
                      working: { bg: '#2196F3', label: 'Working' },
                      negotiation: { bg: '#FF9800', label: 'Negotiation' },
                      pending: { bg: '#9C27B0', label: 'Pending' },
                      converted: { bg: '#4CAF50', label: 'Converted' },
                      lost: { bg: '#F44336', label: 'Lost' },
                    };
                    const style = styles[selected];
                    return style ? (
                      <Chip label={style.label} size="small" sx={{ backgroundColor: style.bg, color: '#fff', fontWeight: 500 }} />
                    ) : selected;
                  }}
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
                  <MenuItem value="new">
                    <Chip label="New" size="small" sx={{ backgroundColor: '#00BCD4', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                  <MenuItem value="working">
                    <Chip label="Working" size="small" sx={{ backgroundColor: '#2196F3', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                  <MenuItem value="negotiation">
                    <Chip label="Negotiation" size="small" sx={{ backgroundColor: '#FF9800', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                  <MenuItem value="pending">
                    <Chip label="Pending" size="small" sx={{ backgroundColor: '#9C27B0', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                  <MenuItem value="converted">
                    <Chip label="Converted" size="small" sx={{ backgroundColor: '#4CAF50', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                  <MenuItem value="lost">
                    <Chip label="Lost" size="small" sx={{ backgroundColor: '#F44336', color: '#fff', fontWeight: 500 }} />
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>
            )}
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
      ) : viewMode === 'kanban' ? (
        <OpportunityKanban
          opportunities={opportunities}
          onStatusChange={handleStatusChange}
          onView={handleKanbanView}
          onEdit={handleKanbanEdit}
        />
      ) : (
        <>
          <SortableTable
            data={filteredOpportunities}
            columns={columns}
            emptyMessage="No opportunities found"
          />
          {total > 10 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3 }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Per Page</InputLabel>
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  label="Per Page"
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
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={75}>75</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                }}
              >
                Showing {opportunities.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)} of {total}
              </Typography>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: theme.palette.text.primary,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                }}
              />
            </Box>
          )}
        </>
      )}

    </Box>
  );
}

