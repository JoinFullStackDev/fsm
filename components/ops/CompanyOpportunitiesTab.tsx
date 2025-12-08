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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
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
    },
    {
      key: 'value',
      label: 'Value',
      sortable: true,
      render: (val: unknown) => {
        const value = val as number | null;
        return value ? `$${value.toLocaleString()}` : '-';
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
        return value || 'Manual';
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string;
        return new Date(value).toLocaleDateString();
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: unknown, row: Opportunity) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleViewOpportunity(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
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

    </Box>
  );
}

