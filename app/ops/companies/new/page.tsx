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
  FormControlLabel,
  Switch,
  Divider,
  InputAdornment,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon, Handshake as HandshakeIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyStatus, CompanySize, RevenueBand, PartnerCompanyOption } from '@/types/ops';

export default function NewCompanyPage() {
  const theme = useTheme();
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
  // Partner tracking fields
  const [is_partner, setIsPartner] = useState(false);
  const [partner_commission_rate, setPartnerCommissionRate] = useState('');
  const [partner_contact_email, setPartnerContactEmail] = useState('');
  const [partner_notes, setPartnerNotes] = useState('');
  const [referred_by_company_id, setReferredByCompanyId] = useState('');
  const [partnerOptions, setPartnerOptions] = useState<PartnerCompanyOption[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Load partner options for dropdown
  useEffect(() => {
    const loadPartners = async () => {
      setLoadingPartners(true);
      try {
        const response = await fetch('/api/ops/partners?simple=true');
        if (response.ok) {
          const data = await response.json();
          setPartnerOptions(data);
        }
      } catch (err) {
        console.error('Error loading partners:', err);
      } finally {
        setLoadingPartners(false);
      }
    };
    loadPartners();
  }, []);

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
          // Partner tracking fields
          is_partner,
          partner_commission_rate: is_partner && partner_commission_rate ? parseFloat(partner_commission_rate) : null,
          partner_contact_email: is_partner && partner_contact_email.trim() ? partner_contact_email.trim() : null,
          partner_notes: is_partner && partner_notes.trim() ? partner_notes.trim() : null,
          referred_by_company_id: referred_by_company_id || null,
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
    <Container maxWidth="md" sx={{ mt: 4, mb: 4, px: { xs: 0, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton
          onClick={() => router.push('/ops/companies')}
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
          Create New Company
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
              onChange={(e) => setStatus(e.target.value as CompanyStatus)}
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
              <MenuItem value="prospect">Prospect</MenuItem>
              <MenuItem value="client">Client</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Company Size</InputLabel>
            <Select
              value={company_size}
              label="Company Size"
              onChange={(e) => setCompanySize(e.target.value as CompanySize)}
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
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Revenue Band</InputLabel>
            <Select
              value={revenue_band}
              label="Revenue Band"
              onChange={(e) => setRevenueBand(e.target.value as RevenueBand)}
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
            label="Street Address"
            value={address_street}
            onChange={(e) => setAddressStreet(e.target.value)}
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
              label="State"
              value={address_state}
              onChange={(e) => setAddressState(e.target.value)}
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
              label="ZIP Code"
              value={address_zip}
              onChange={(e) => setAddressZip(e.target.value)}
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
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
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
            label="Account Notes"
            value={account_notes}
            onChange={(e) => setAccountNotes(e.target.value)}
            multiline
            rows={3}
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

          {/* Partner Section */}
          <Divider sx={{ my: 3 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <HandshakeIcon sx={{ color: theme.palette.text.secondary }} />
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              Partnership Settings
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={is_partner}
                onChange={(e) => setIsPartner(e.target.checked)}
                disabled={loading}
              />
            }
            label="This company is a partner (refers clients to us)"
            sx={{ mb: 2, color: theme.palette.text.primary }}
          />

          {is_partner && (
            <Box sx={{ pl: 2, borderLeft: `3px solid ${theme.palette.primary.main}` }}>
              <TextField
                fullWidth
                label="Commission Rate (%)"
                type="number"
                value={partner_commission_rate}
                onChange={(e) => setPartnerCommissionRate(e.target.value)}
                margin="normal"
                disabled={loading}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                inputProps={{ min: 0, max: 100, step: 0.5 }}
                helperText="Default commission rate for referrals from this partner"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                  },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
                }}
              />
              <TextField
                fullWidth
                label="Partner Contact Email"
                type="email"
                value={partner_contact_email}
                onChange={(e) => setPartnerContactEmail(e.target.value)}
                margin="normal"
                disabled={loading}
                helperText="Primary contact for partnership-related communication"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                  },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
                }}
              />
              <TextField
                fullWidth
                label="Partner Notes"
                value={partner_notes}
                onChange={(e) => setPartnerNotes(e.target.value)}
                multiline
                rows={2}
                margin="normal"
                disabled={loading}
                helperText="Internal notes about this partnership"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    '& fieldset': { borderColor: theme.palette.divider },
                    '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                    '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                  },
                  '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
                  '& .MuiInputLabel-root.Mui-focused': { color: theme.palette.text.primary },
                }}
              />
            </Box>
          )}

          {/* Referred By Partner (for non-partner companies) */}
          {!is_partner && partnerOptions.length > 0 && (
            <FormControl fullWidth margin="normal">
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Referred By Partner</InputLabel>
              <Select
                value={referred_by_company_id}
                label="Referred By Partner"
                onChange={(e) => setReferredByCompanyId(e.target.value)}
                disabled={loading || loadingPartners}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.primary },
                  '& .MuiSvgIcon-root': { color: theme.palette.text.primary },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {partnerOptions.map((partner) => (
                  <MenuItem key={partner.id} value={partner.id}>
                    {partner.name}
                    {partner.partner_commission_rate && ` (${partner.partner_commission_rate}%)`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/ops/companies')}
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
              {loading ? 'Creating...' : 'Create Company'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
}

