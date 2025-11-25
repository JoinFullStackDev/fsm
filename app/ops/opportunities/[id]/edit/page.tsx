'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityStatus, OpportunitySource } from '@/types/ops';

export default function EditOpportunityPage() {
  const router = useRouter();
  const params = useParams();
  const opportunityId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [name, setName] = useState('');
  const [value, setValue] = useState<string>('');
  const [status, setStatus] = useState<OpportunityStatus>('new');
  const [source, setSource] = useState<OpportunitySource>('Manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const loadOpportunity = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);

      const response = await fetch(`/api/ops/opportunities/${opportunityId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load opportunity');
      }

      const opportunity = await response.json();
      setName(opportunity.name);
      setValue(opportunity.value ? opportunity.value.toString() : '');
      setStatus(opportunity.status);
      setSource(opportunity.source || 'Manual');
      setCompanyId(opportunity.company_id);
      setCompanyName(opportunity.company?.name || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load opportunity';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoadingData(false);
    }
  }, [opportunityId, showError]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Client-side validation
    if (!name || name.trim().length === 0) {
      setValidationErrors({ name: 'Opportunity name is required' });
      return;
    }
    if (value && isNaN(parseFloat(value))) {
      setValidationErrors({ value: 'Value must be a valid number' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ops/opportunities/${opportunityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          value: value ? parseFloat(value) : null,
          status,
          source,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update opportunity');
      }

      const opportunity = await response.json();
      showSuccess('Opportunity updated successfully');
      if (companyId) {
        router.push(`/ops/companies/${companyId}`);
      } else {
        router.push('/ops/opportunities');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update opportunity';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => companyId ? router.push(`/ops/companies/${companyId}`) : router.push('/ops/opportunities')}
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
          component="h1"
          sx={{
            fontWeight: 700,
            background: '#00E5FF',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Edit Opportunity{companyName ? ` - ${companyName}` : ''}
        </Typography>
      </Box>

      <Card
        sx={{
          backgroundColor: '#000',
          border: '2px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 2,
        }}
      >
        <CardContent>
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                backgroundColor: 'rgba(255, 23, 68, 0.1)',
                border: '1px solid rgba(255, 23, 68, 0.3)',
                color: '#FF1744',
              }}
            >
              {error}
            </Alert>
          )}
          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Opportunity Name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (validationErrors.name) {
                  setValidationErrors({ ...validationErrors, name: '' });
                }
              }}
              required
              margin="normal"
              error={!!validationErrors.name}
              helperText={validationErrors.name}
              disabled={loading}
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
                '& .MuiInputLabel-root': {
                  color: '#B0B0B0',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#00E5FF',
                },
              }}
            />
            <TextField
              fullWidth
              label="Value ($)"
              type="number"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (validationErrors.value) {
                  setValidationErrors({ ...validationErrors, value: '' });
                }
              }}
              margin="normal"
              error={!!validationErrors.value}
              helperText={validationErrors.value}
              disabled={loading}
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
                '& .MuiInputLabel-root': {
                  color: '#B0B0B0',
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#00E5FF',
                },
              }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as OpportunityStatus)}
                disabled={loading}
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
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="qualified">Qualified</MenuItem>
                <MenuItem value="proposal">Proposal</MenuItem>
                <MenuItem value="negotiation">Negotiation</MenuItem>
                <MenuItem value="won">Won</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: '#B0B0B0' }}>Source</InputLabel>
              <Select
                value={source}
                label="Source"
                onChange={(e) => setSource(e.target.value as OpportunitySource)}
                disabled={loading}
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
                <MenuItem value="Manual">Manual</MenuItem>
                <MenuItem value="Converted">Converted</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => companyId ? router.push(`/ops/companies/${companyId}`) : router.push('/ops/opportunities')}
                disabled={loading}
                sx={{
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                  color: '#00E5FF',
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  backgroundColor: '#00E5FF',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#00B2CC',
                  },
                }}
              >
                {loading ? 'Updating...' : 'Update Opportunity'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

