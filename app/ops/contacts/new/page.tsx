'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { ContactStatus, Company } from '@/types/ops';

export default function NewContactPage() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [companyId, setCompanyId] = useState<string>('');
  const [first_name, setFirstName] = useState('');
  const [last_name, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ContactStatus>('active');
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
    if (!first_name || first_name.trim().length === 0) {
      setValidationErrors({ first_name: 'First name is required' });
      return;
    }
    if (!last_name || last_name.trim().length === 0) {
      setValidationErrors({ last_name: 'Last name is required' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ops/companies/${companyId}/contacts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          status,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }

      const contact = await response.json();
      showSuccess('Contact created successfully');
      router.push(`/ops/companies/${companyId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create contact';
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
          onClick={() => router.push('/ops/contacts')}
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
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Create New Contact
        </Typography>
      </Box>

      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
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
            label="First Name"
            value={first_name}
            onChange={(e) => {
              setFirstName(e.target.value);
              if (validationErrors.first_name) {
                setValidationErrors({ ...validationErrors, first_name: '' });
              }
            }}
            required
            margin="normal"
            error={!!validationErrors.first_name}
            helperText={validationErrors.first_name}
            disabled={loading}
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
            label="Last Name"
            value={last_name}
            onChange={(e) => {
              setLastName(e.target.value);
              if (validationErrors.last_name) {
                setValidationErrors({ ...validationErrors, last_name: '' });
              }
            }}
            required
            margin="normal"
            error={!!validationErrors.last_name}
            helperText={validationErrors.last_name}
            disabled={loading}
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
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            disabled={loading}
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
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            margin="normal"
            disabled={loading}
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
              onChange={(e) => setStatus(e.target.value as ContactStatus)}
              disabled={loading}
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
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={4}
            margin="normal"
            disabled={loading}
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
              '& .MuiInputLabel-root': {
                color: theme.palette.text.secondary,
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: theme.palette.text.primary,
              },
            }}
          />
          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/ops/contacts')}
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
              variant="outlined"
              disabled={loading}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                fontWeight: 600,
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
              {loading ? 'Creating...' : 'Create Contact'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

