'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityWithCompany } from '@/types/ops';

export default function OpportunityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const opportunityId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [opportunity, setOpportunity] = useState<OpportunityWithCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const loadOpportunity = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/opportunities/${opportunityId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunity');
      }

      const data = await response.json();
      setOpportunity(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunity';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [opportunityId, showError]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  const handleEdit = () => {
    router.push(`/ops/opportunities/${opportunityId}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!opportunity) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/ops/opportunities/${opportunityId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete opportunity');
      }

      showSuccess('Opportunity deleted successfully');
      router.push('/ops/opportunities');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete opportunity';
      showError(errorMessage);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleConvert = () => {
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (!opportunity) return;

    try {
      setConverting(true);
      const response = await fetch(`/api/ops/opportunities/${opportunityId}/convert`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert opportunity');
      }

      const project = await response.json();
      showSuccess('Opportunity converted to project successfully');
      setConvertDialogOpen(false);
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
      case 'qualified':
        return 'info';
      case 'proposal':
        return 'warning';
      case 'negotiation':
        return 'primary';
      case 'won':
        return 'success';
      case 'lost':
        return 'error';
      case 'archived':
        return 'default';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !opportunity) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Opportunity not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/opportunities')}
          sx={{
            color: '#00E5FF',
            border: '1px solid',
            borderColor: '#00E5FF',
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          sx={{
            flex: 1,
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {opportunity.name}
        </Typography>
        {opportunity.status !== 'lost' && opportunity.status !== 'converted' && (
          <Button
            variant="contained"
            startIcon={<CheckCircleIcon />}
            onClick={handleConvert}
            disabled={converting}
            sx={{
              backgroundColor: '#4CAF50',
              color: '#FFF',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#45A049',
              },
            }}
          >
            {converting ? 'Converting...' : 'Convert to Project'}
          </Button>
        )}
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleEdit}
          sx={{
            borderColor: '#00E5FF',
            color: '#00E5FF',
            '&:hover': {
              borderColor: '#00B2CC',
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          Edit
        </Button>
        <Button
          variant="outlined"
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
          sx={{
            borderColor: '#FF1744',
            color: '#FF1744',
            '&:hover': {
              borderColor: '#D50000',
              backgroundColor: 'rgba(255, 23, 68, 0.1)',
            },
          }}
        >
          Delete
        </Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main Details */}
        <Grid item xs={12} md={8}>
          <Paper
            sx={{
              backgroundColor: '#000',
              border: '2px solid rgba(0, 229, 255, 0.2)',
              borderRadius: 2,
              p: 3,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#00E5FF',
                fontWeight: 600,
                mb: 3,
              }}
            >
              Details
            </Typography>

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Status
                  </Typography>
                  <Chip
                    label={opportunity.status.charAt(0).toUpperCase() + opportunity.status.slice(1)}
                    color={getStatusColor(opportunity.status) as any}
                    size="medium"
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Source
                  </Typography>
                  <Chip
                    label={opportunity.source || 'Manual'}
                    size="medium"
                    variant="outlined"
                  />
                </Box>
              </Grid>
              {opportunity.value && (
                <Grid item xs={12} sm={6}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Value
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        color: '#00E5FF',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <AttachMoneyIcon />
                      {opportunity.value.toLocaleString()}
                    </Typography>
                  </Box>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Created
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                    {new Date(opportunity.created_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                    Updated
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#E0E0E0' }}>
                    {new Date(opportunity.updated_at).toLocaleDateString()}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Company Info */}
        <Grid item xs={12} md={4}>
          {opportunity.company && (
            <Card
              sx={{
                backgroundColor: '#000',
                border: '2px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.3s',
                '&:hover': {
                  borderColor: '#00E5FF',
                  transform: 'translateY(-2px)',
                },
              }}
              onClick={() => router.push(`/ops/companies/${opportunity.company!.id}`)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <BusinessIcon sx={{ fontSize: 32, color: '#00E5FF' }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                      Company
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{
                        color: '#00E5FF',
                        fontWeight: 600,
                      }}
                    >
                      {opportunity.company.name}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
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
          onClick={() => setDeleteDialogOpen(false)}
        >
          <Paper
            sx={{
              p: 3,
              maxWidth: 400,
              backgroundColor: '#000',
              border: '1px solid rgba(255, 23, 68, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Typography variant="h6" sx={{ mb: 2, color: '#FF1744', fontWeight: 600 }}>
              Delete Opportunity
            </Typography>
            <Typography sx={{ mb: 3, color: '#B0B0B0' }}>
              Are you sure you want to delete &quot;{opportunity.name}&quot;? This action cannot be undone.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
                sx={{ color: '#B0B0B0' }}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDelete}
                variant="contained"
                disabled={deleting}
                sx={{
                  backgroundColor: '#FF1744',
                  color: '#fff',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#D50000',
                  },
                  '&.Mui-disabled': {
                    backgroundColor: 'rgba(255, 23, 68, 0.3)',
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </Box>
          </Paper>
        </Box>
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
              Are you sure you want to convert &quot;{opportunity.name}&quot; to a project? This will create a new project and mark the opportunity as converted.
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
    </Container>
  );
}

