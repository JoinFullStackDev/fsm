'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CheckCircle as CheckCircleIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Opportunity } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';

interface CompanyOpportunitiesTabProps {
  companyId: string;
}

export default function CompanyOpportunitiesTab({ companyId }: CompanyOpportunitiesTabProps) {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [opportunityToConvert, setOpportunityToConvert] = useState<Opportunity | null>(null);
  const [converting, setConverting] = useState(false);

  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/opportunities?company_id=${companyId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunities');
      }

      const result = await response.json();
      // Ensure we always set an array, even if result.data is not an array
      setOpportunities(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunities';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  const handleCreateOpportunity = () => {
    router.push(`/ops/opportunities/new?company_id=${companyId}`);
  };

  const handleViewOpportunity = (opportunity: Opportunity, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/ops/opportunities/${opportunity.id}`);
  };

  const handleEditOpportunity = (opportunity: Opportunity, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/ops/opportunities/${opportunity.id}/edit`);
  };

  const handleDeleteOpportunity = async (opportunity: Opportunity, e: React.MouseEvent) => {
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

  const handleConvertOpportunity = (opportunity: Opportunity, e: React.MouseEvent) => {
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
      // Navigate to the new project
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
      render: (_: any, row: Opportunity) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleViewOpportunity(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          {row.status !== 'converted' && (
            <IconButton
              size="small"
              onClick={(e) => handleConvertOpportunity(row, e)}
              sx={{ color: theme.palette.text.primary }}
              title="Convert to Project"
            >
              <CheckCircleIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={(e) => handleEditOpportunity(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="Edit"
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteOpportunity(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
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
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Add Opportunity
        </Button>
      </Box>

      {opportunities.length === 0 ? (
        <Alert severity="info">
          No opportunities yet. Add an opportunity to get started.
        </Alert>
      ) : (
        <SortableTable
          data={opportunities}
          columns={columns}
          emptyMessage="No opportunities found"
        />
      )}

      {/* Convert Confirmation Dialog */}
      <Dialog open={convertDialogOpen} onClose={() => setConvertDialogOpen(false)}>
        <DialogTitle>Convert Opportunity to Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to convert &quot;{opportunityToConvert?.name}&quot; to a project? This will create a new project and mark the opportunity as converted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConvertDialogOpen(false)} disabled={converting}>
            Cancel
          </Button>
          <Button
            onClick={confirmConvert}
            color="primary"
            variant="contained"
            disabled={converting}
          >
            {converting ? 'Converting...' : 'Convert'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

