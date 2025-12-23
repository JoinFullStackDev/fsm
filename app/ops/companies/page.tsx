'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@mui/material/styles';
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
  DialogActions,
  Pagination,
} from '@mui/material';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Edit as EditIcon, Handshake as HandshakeIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { Business as BusinessIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyWithCounts } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';

export default function CompaniesPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyWithCounts | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', pageSize.toString());
      params.append('offset', offset.toString());

      const response = await fetch(`/api/ops/companies?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load companies');
      }

      const result = await response.json();
      // Ensure we always set an array, even if result.data is not an array
      setCompanies(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load companies';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, page, pageSize, showError]);

  useEffect(() => {
    setPage(1); // Reset to first page when filters change
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleCreateCompany = () => {
    router.push('/ops/companies/new');
  };

  const handleEditCompany = (company: CompanyWithCounts, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/ops/companies/${company.id}/edit`);
  };

  const handleDeleteCompany = (company: CompanyWithCounts, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompanyToDelete(company);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!companyToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/ops/companies/${companyToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete company');
      }

      showSuccess('Company deleted successfully');
      setDeleteDialogOpen(false);
      setCompanyToDelete(null);
      loadCompanies();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete company';
      showError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'prospect':
        return 'info';
      case 'client':
        return 'primary';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Company Name',
      sortable: true,
      render: (val: unknown, row: CompanyWithCounts) => {
        const name = val as string;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ color: theme.palette.text.primary }}>
              {name}
            </Typography>
            {row.is_partner && (
              <Chip
                icon={<HandshakeIcon sx={{ fontSize: 14 }} />}
                label="Partner"
                size="small"
                sx={{
                  backgroundColor: '#9C27B0',
                  color: '#fff',
                  height: 22,
                  '& .MuiChip-icon': { color: '#fff' },
                  '& .MuiChip-label': { px: 0.75, fontSize: '0.7rem' },
                }}
              />
            )}
          </Box>
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
            color={getStatusColor(value) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
            size="small"
          />
        );
      },
    },
    {
      key: 'contacts_count',
      label: 'Contacts',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return value || 0;
      },
    },
    {
      key: 'opportunities_count',
      label: 'Opportunities',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return value || 0;
      },
    },
    {
      key: 'projects_count',
      label: 'Projects',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return value || 0;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: unknown, row: CompanyWithCounts) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleEditCompany(row, e)}
            sx={{ color: theme.palette.text.primary }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteCompany(row, e)}
            sx={{ color: theme.palette.text.primary }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const filteredCompanies = companies; // Filtering is now done server-side
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: theme.palette.text.primary,
              fontSize: { xs: '1.25rem', md: '1.5rem' },
            }}
          >
            Companies
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateCompany}
          fullWidth={false}
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 600,
            border: `1px solid ${theme.palette.divider}`,
            width: { xs: '100%', md: 'auto' },
            '&:hover': {
              backgroundColor: theme.palette.background.default,
              transform: { xs: 'none', md: 'translateY(-2px)' },
            },
          }}
        >
          Create Company
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {companies.length > 0 && (
        <Paper
          sx={{
            p: { xs: 1.5, md: 2 },
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
                placeholder="Search companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.divider,
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
                    backgroundColor: theme.palette.background.paper,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '& .MuiSvgIcon-root': {
                      color: theme.palette.text.secondary,
                    },
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="prospect">Prospect</MenuItem>
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>
      )}

      {companies.length === 0 && !loading ? (
        <EmptyState
          icon={<BusinessIcon sx={{ fontSize: 64, color: theme.palette.text.secondary }} />}
          title="No Companies"
          description="Get started by creating your first company"
          actionLabel="Create Company"
          onAction={handleCreateCompany}
        />
      ) : (
        <>
          <SortableTable
            data={filteredCompanies}
            columns={columns}
            onRowClick={(company) => router.push(`/ops/companies/${company.id}`)}
            emptyMessage="No companies found"
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
                    backgroundColor: theme.palette.background.paper,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '& .MuiSvgIcon-root': {
                      color: theme.palette.text.secondary,
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
                Showing {companies.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, total)} of {total}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Company</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{companyToDelete?.name}&quot;? This will also delete all associated contacts, opportunities, projects, and tasks. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

