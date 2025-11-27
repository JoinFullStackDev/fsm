'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  CircularProgress,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Search as SearchIcon,
  Visibility as ViewIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import type { Organization } from '@/types/organization';

interface OrganizationWithDetails extends Organization {
  subscription?: {
    id: string;
    package_id: string;
    status: string;
    current_period_start: string;
    current_period_end: string;
  } | null;
  package?: {
    id: string;
    name: string;
    price_per_user_monthly: number;
    features: Record<string, any>;
  } | null;
  user_count?: number;
  project_count?: number;
}

export default function OrganizationsPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [organizations, setOrganizations] = useState<OrganizationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/global/admin/organizations');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load organizations');
      }
      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load organizations';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch = org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || org.subscription_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const paginatedOrganizations = filteredOrganizations.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleViewOrganization = (orgId: string) => {
    router.push(`/global/admin/organizations/${orgId}`);
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
          Organizations
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/global/admin/organizations/new')}
        >
          Create Organization
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="trial">Trial</MenuItem>
              <MenuItem value="past_due">Past Due</MenuItem>
              <MenuItem value="canceled">Canceled</MenuItem>
            </Select>
          </FormControl>
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
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Package</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Projects</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedOrganizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No organizations found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrganizations.map((org) => (
                  <TableRow key={org.id} hover>
                    <TableCell>{org.name}</TableCell>
                    <TableCell>
                      <Chip label={org.slug} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={org.subscription_status}
                        size="small"
                        color={
                          org.subscription_status === 'active'
                            ? 'success'
                            : org.subscription_status === 'trial'
                            ? 'info'
                            : org.subscription_status === 'past_due'
                            ? 'warning'
                            : 'error'
                        }
                      />
                    </TableCell>
                    <TableCell>{org.package?.name || 'None'}</TableCell>
                    <TableCell>{org.user_count || 0}</TableCell>
                    <TableCell>{org.project_count || 0}</TableCell>
                    <TableCell>
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => handleViewOrganization(org.id)}
                        aria-label="View organization"
                      >
                        <ViewIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && filteredOrganizations.length > rowsPerPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 1 }}>
          <Button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Typography sx={{ alignSelf: 'center', px: 2 }}>
            Page {page + 1} of {Math.ceil(filteredOrganizations.length / rowsPerPage)}
          </Typography>
          <Button
            disabled={page >= Math.ceil(filteredOrganizations.length / rowsPerPage) - 1}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </Box>
      )}
    </Box>
  );
}

