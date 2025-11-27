'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  useTheme,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityStatus, OpportunitySource, Company } from '@/types/ops';

export default function NewOpportunityPage() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [name, setName] = useState('');
  const [value, setValue] = useState<string>('');
  const [status, setStatus] = useState<OpportunityStatus>('new');
  const [source, setSource] = useState<OpportunitySource>('Manual');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if company_id is in query params
    const companyIdParam = searchParams.get('company_id');
    if (companyIdParam) {
      setCompanyId(companyIdParam);
    }
    loadCompanies();
  }, [searchParams]);

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const response = await fetch('/api/ops/companies');
      if (response.ok) {
        const result = await response.json();
        // Ensure we always set an array, even if result.data is not an array
        setCompanies(Array.isArray(result.data) ? result.data : []);
      }
    } catch (err) {
      // Ignore errors, just show form
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Client-side validation
    if (!companyId) {
      setValidationErrors({ company_id: 'Company is required' });
      return;
    }
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
      const response = await fetch('/api/ops/opportunities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: companyId,
          name: name.trim(),
          value: value ? parseFloat(value) : null,
          status,
          source,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create opportunity');
      }

      const result = await response.json();
      
      // If opportunity was auto-converted to project, navigate to project page
      if (result.converted && result.project) {
        showSuccess('Opportunity created and converted to project successfully');
        router.push(`/project/${result.project.id}`);
      } else {
        showSuccess('Opportunity created successfully');
        router.push(`/ops/companies/${companyId}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create opportunity';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/opportunities')}
          sx={{
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
            color: theme.palette.text.primary,
          }}
        >
          Create New Opportunity
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
            <FormControl fullWidth margin="normal" required error={!!validationErrors.company_id}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Company</InputLabel>
              <Select
                value={companyId}
                label="Company"
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  if (validationErrors.company_id) {
                    setValidationErrors({ ...validationErrors, company_id: '' });
                  }
                }}
                disabled={loading || loadingCompanies}
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
                  backgroundColor: theme.palette.background.paper,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: validationErrors.company_id ? theme.palette.error.main : theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: validationErrors.company_id ? theme.palette.error.main : theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: validationErrors.company_id ? theme.palette.error.main : theme.palette.text.primary,
                  },
                  '& .MuiSvgIcon-root': {
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                {loadingCompanies ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} sx={{ color: theme.palette.text.primary }} />
                  </MenuItem>
                ) : (
                  companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))
                )}
              </Select>
              {validationErrors.company_id && (
                <Box sx={{ color: theme.palette.error.main, fontSize: '0.75rem', mt: 0.5, ml: 1.75 }}>
                  {validationErrors.company_id}
                </Box>
              )}
            </FormControl>
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
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: validationErrors.name ? theme.palette.error.main : theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: validationErrors.name ? theme.palette.error.main : theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: validationErrors.name ? theme.palette.error.main : theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiFormHelperText-root': {
                  color: validationErrors.name ? theme.palette.error.main : theme.palette.text.secondary,
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
                  backgroundColor: theme.palette.background.paper,
                  color: theme.palette.text.primary,
                  '& fieldset': {
                    borderColor: validationErrors.value ? theme.palette.error.main : theme.palette.divider,
                  },
                  '&:hover fieldset': {
                    borderColor: validationErrors.value ? theme.palette.error.main : theme.palette.text.secondary,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: validationErrors.value ? theme.palette.error.main : theme.palette.text.primary,
                  },
                },
                '& .MuiInputLabel-root': {
                  color: theme.palette.text.secondary,
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: theme.palette.text.primary,
                },
                '& .MuiInputBase-input': {
                  color: theme.palette.text.primary,
                },
                '& .MuiFormHelperText-root': {
                  color: validationErrors.value ? theme.palette.error.main : theme.palette.text.secondary,
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
                  backgroundColor: theme.palette.background.paper,
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
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                <MenuItem value="new">New</MenuItem>
                <MenuItem value="working">Working</MenuItem>
                <MenuItem value="negotiation">Negotiation</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="converted">Converted</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
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
                  backgroundColor: theme.palette.background.paper,
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
                    color: theme.palette.text.secondary,
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
                onClick={() => router.push('/ops/opportunities')}
                disabled={loading}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
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
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                sx={{
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.default,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                  },
                  '&.Mui-disabled': {
                    backgroundColor: theme.palette.divider,
                    color: theme.palette.text.secondary,
                  },
                }}
              >
                {loading ? 'Creating...' : 'Create Opportunity'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

