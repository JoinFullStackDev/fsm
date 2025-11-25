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
import type { ContactStatus, Company } from '@/types/ops';

export default function NewContactPage() {
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
          Create New Contact
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
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
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
              label="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              margin="normal"
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
                onChange={(e) => setStatus(e.target.value as ContactStatus)}
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
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => router.push('/ops/contacts')}
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
                {loading ? 'Creating...' : 'Create Contact'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

