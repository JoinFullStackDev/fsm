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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpportunityStatus, OpportunitySource, Company } from '@/types/ops';

export default function NewOpportunityPage() {
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
        const data = await response.json();
        setCompanies(data);
      }
    } catch (err) {
      // Ignore errors, just show form
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
          Create New Opportunity
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
            <FormControl fullWidth margin="normal" required error={!!validationErrors.company_id}>
              <InputLabel sx={{ color: '#B0B0B0' }}>Company</InputLabel>
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
                {loadingCompanies ? (
                  <MenuItem disabled>
                    <CircularProgress size={20} />
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
                <Box sx={{ color: '#FF1744', fontSize: '0.75rem', mt: 0.5, ml: 1.75 }}>
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
                <MenuItem value="working">Working</MenuItem>
                <MenuItem value="negotiation">Negotiation</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="converted">Converted</MenuItem>
                <MenuItem value="lost">Lost</MenuItem>
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
                onClick={() => router.push('/ops/opportunities')}
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
                {loading ? 'Creating...' : 'Create Opportunity'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

