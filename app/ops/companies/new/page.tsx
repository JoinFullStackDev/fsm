'use client';

import { useState } from 'react';
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
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyStatus, CompanySize, RevenueBand } from '@/types/ops';

export default function NewCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<CompanyStatus>('active');
  const [notes, setNotes] = useState('');
  const [company_size, setCompanySize] = useState<CompanySize | ''>('');
  const [industry, setIndustry] = useState('');
  const [revenue_band, setRevenueBand] = useState<RevenueBand | ''>('');
  const [website, setWebsite] = useState('');
  const [address_street, setAddressStreet] = useState('');
  const [address_city, setAddressCity] = useState('');
  const [address_state, setAddressState] = useState('');
  const [address_zip, setAddressZip] = useState('');
  const [address_country, setAddressCountry] = useState('');
  const [account_notes, setAccountNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Client-side validation
    if (!name || name.trim().length === 0) {
      setValidationErrors({ name: 'Company name is required' });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/ops/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          status,
          notes: notes.trim() || null,
          company_size: company_size || null,
          industry: industry.trim() || null,
          revenue_band: revenue_band || null,
          website: website.trim() || null,
          address_street: address_street.trim() || null,
          address_city: address_city.trim() || null,
          address_state: address_state.trim() || null,
          address_zip: address_zip.trim() || null,
          address_country: address_country.trim() || null,
          account_notes: account_notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create company');
      }

      const company = await response.json();
      showSuccess('Company created successfully');
      router.push(`/ops/companies/${company.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create company';
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
          onClick={() => router.push('/ops/companies')}
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
          Create New Company
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
              label="Company Name"
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
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
              <Select
                value={status}
                label="Status"
                onChange={(e) => setStatus(e.target.value as CompanyStatus)}
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
                <MenuItem value="prospect">Prospect</MenuItem>
                <MenuItem value="client">Client</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: '#B0B0B0' }}>Company Size</InputLabel>
              <Select
                value={company_size}
                label="Company Size"
                onChange={(e) => setCompanySize(e.target.value as CompanySize)}
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
                <MenuItem value="">None</MenuItem>
                <MenuItem value="1-10">1-10</MenuItem>
                <MenuItem value="11-50">11-50</MenuItem>
                <MenuItem value="51-200">51-200</MenuItem>
                <MenuItem value="201-500">201-500</MenuItem>
                <MenuItem value="501-1000">501-1000</MenuItem>
                <MenuItem value="1000+">1000+</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
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
              <InputLabel sx={{ color: '#B0B0B0' }}>Revenue Band</InputLabel>
              <Select
                value={revenue_band}
                label="Revenue Band"
                onChange={(e) => setRevenueBand(e.target.value as RevenueBand)}
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
                <MenuItem value="">None</MenuItem>
                <MenuItem value="<$1M">&lt;$1M</MenuItem>
                <MenuItem value="$1M-$10M">$1M-$10M</MenuItem>
                <MenuItem value="$10M-$50M">$10M-$50M</MenuItem>
                <MenuItem value="$50M-$100M">$50M-$100M</MenuItem>
                <MenuItem value="$100M+">$100M+</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
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
              label="Street Address"
              value={address_street}
              onChange={(e) => setAddressStreet(e.target.value)}
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                fullWidth
                label="City"
                value={address_city}
                onChange={(e) => setAddressCity(e.target.value)}
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
                label="State"
                value={address_state}
                onChange={(e) => setAddressState(e.target.value)}
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
                label="ZIP Code"
                value={address_zip}
                onChange={(e) => setAddressZip(e.target.value)}
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
            </Box>
            <TextField
              fullWidth
              label="Country"
              value={address_country}
              onChange={(e) => setAddressCountry(e.target.value)}
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
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              multiline
              rows={3}
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
              label="Account Notes"
              value={account_notes}
              onChange={(e) => setAccountNotes(e.target.value)}
              multiline
              rows={3}
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
                onClick={() => router.push('/ops/companies')}
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
                {loading ? 'Creating...' : 'Create Company'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Container>
  );
}

