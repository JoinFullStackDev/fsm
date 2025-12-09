'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Business as BusinessIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOnboarding } from '../OnboardingProvider';
import type { Company, CompanyStatus } from '@/types/ops';

interface CompanyStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function CompanyStep({ onComplete, onSkip }: CompanyStepProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { saving: contextSaving } = useOnboarding();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    status: 'active' as CompanyStatus,
    industry: '',
    website: '',
  });

  const hasCompanies = companies.length > 0;

  // Load existing companies
  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ops/companies?limit=5');
      if (!response.ok) {
        throw new Error('Failed to load companies');
      }
      const data = await response.json();
      setCompanies(data.data || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Company name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/ops/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          status: formData.status,
          industry: formData.industry.trim() || null,
          website: formData.website.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create company');
      }

      showSuccess('Company created successfully');
      await loadCompanies();
      setShowForm(false);
      setFormData({ name: '', status: 'active', industry: '', website: '' });
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create company';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && !showForm && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Existing Companies Summary */}
      {hasCompanies && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {companies.length} {companies.length === 1 ? 'Company' : 'Companies'} Found
            </Typography>
          </Box>

          <Paper
            sx={{
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              overflow: 'hidden',
            }}
          >
            <List dense disablePadding>
              {companies.slice(0, 3).map((company, index) => (
                <ListItem
                  key={company.id}
                  sx={{
                    borderBottom:
                      index < Math.min(companies.length - 1, 2)
                        ? `1px solid ${theme.palette.divider}`
                        : 'none',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <BusinessIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={company.name}
                    secondary={company.industry || company.status}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                    }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      color: theme.palette.text.secondary,
                    }}
                  />
                </ListItem>
              ))}
            </List>
            {companies.length > 3 && (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  p: 1,
                  textAlign: 'center',
                  color: theme.palette.text.secondary,
                  borderTop: `1px solid ${theme.palette.divider}`,
                }}
              >
                +{companies.length - 3} more
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* Add Company Button / Form Toggle */}
      <Button
        startIcon={showForm ? <ExpandLessIcon /> : hasCompanies ? <AddIcon /> : <BusinessIcon />}
        onClick={() => setShowForm(!showForm)}
        variant={hasCompanies ? 'outlined' : 'contained'}
        fullWidth={!hasCompanies}
        sx={
          hasCompanies
            ? {
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                mb: 2,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }
            : {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px dashed ${theme.palette.divider}`,
                mb: 2,
                py: 2,
                '&:hover': {
                  backgroundColor: theme.palette.action.selected,
                  borderColor: theme.palette.text.primary,
                },
              }
        }
      >
        {showForm ? 'Hide Form' : hasCompanies ? 'Add Another Company' : 'Add Your First Company'}
      </Button>

      {/* Add Company Form */}
      <Collapse in={showForm}>
        <Paper
          component="form"
          onSubmit={handleSubmit}
          sx={{
            p: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            mb: 2,
          }}
        >
          {error && showForm && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <TextField
            fullWidth
            label="Company Name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            required
            margin="dense"
            size="small"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
                '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />

          <FormControl fullWidth margin="dense" size="small" sx={{ mb: 2 }}>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
            <Select
              value={formData.status}
              label="Status"
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as CompanyStatus }))}
              sx={{
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="prospect">Prospect</MenuItem>
              <MenuItem value="client">Client</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Industry"
            value={formData.industry}
            onChange={(e) => setFormData((prev) => ({ ...prev, industry: e.target.value }))}
            margin="dense"
            size="small"
            placeholder="e.g., Technology, Healthcare"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />

          <TextField
            fullWidth
            label="Website"
            value={formData.website}
            onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
            margin="dense"
            size="small"
            placeholder="https://example.com"
            sx={{
              mb: 2,
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.action.hover,
                '& fieldset': { borderColor: theme.palette.divider },
              },
              '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
            }}
          />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              type="button"
              onClick={() => setShowForm(false)}
              disabled={saving}
              sx={{ color: theme.palette.text.secondary }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !formData.name.trim()}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': { backgroundColor: theme.palette.text.secondary },
              }}
            >
              {saving ? <CircularProgress size={20} /> : 'Create Company'}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Button
          variant="outlined"
          onClick={onSkip}
          disabled={saving || contextSaving}
          sx={{
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          {hasCompanies ? 'Skip' : 'Skip for Now'}
        </Button>
        {hasCompanies && (
          <Button
            variant="contained"
            onClick={onComplete}
            disabled={saving || contextSaving}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              '&:hover': {
                backgroundColor: theme.palette.text.secondary,
              },
            }}
          >
            Continue
          </Button>
        )}
      </Box>
    </Box>
  );
}

