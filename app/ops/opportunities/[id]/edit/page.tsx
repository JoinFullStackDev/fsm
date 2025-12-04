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
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityStatus, OpportunitySource } from '@/types/ops';

export default function EditOpportunityPage() {
  const theme = useTheme();
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
      <Container maxWidth="md" sx={{ mt: 4, mb: 4, px: { xs: 0, md: 3 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress sx={{ color: theme.palette.text.primary }} />
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
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
          }}
        >
          Edit Opportunity{companyName ? ` - ${companyName}` : ''}
        </Typography>
      </Box>

      <Card
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <CardContent>
          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 2,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
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
                  backgroundColor: theme.palette.background.default,
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
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
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
                  backgroundColor: theme.palette.background.default,
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
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
              }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as OpportunityStatus)}
                disabled={loading}
                renderValue={(selected) => {
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
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      '& .MuiMenuItem-root': {
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.hover,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.default,
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
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Source</InputLabel>
              <Select
                value={source}
                label="Source"
                onChange={(e) => setSource(e.target.value as OpportunitySource)}
                disabled={loading}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      '& .MuiMenuItem-root': {
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.hover,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.default,
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
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
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
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  fontWeight: 600,
                  border: `1px solid ${theme.palette.divider}`,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    borderColor: theme.palette.text.primary,
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

