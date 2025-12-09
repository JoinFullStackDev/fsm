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
  Autocomplete,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Person as PersonIcon,
  Add as AddIcon,
  CheckCircle as CheckCircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOnboarding } from '../OnboardingProvider';
import type { CompanyContact, Company } from '@/types/ops';

interface ContactStepProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function ContactStep({ onComplete, onSkip }: ContactStepProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { saving: contextSaving } = useOnboarding();

  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    job_title: '',
    company_id: '',
  });

  const hasContacts = contacts.length > 0;

  // Load existing contacts and companies
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch contacts and companies in parallel
      const [contactsRes, companiesRes] = await Promise.all([
        fetch('/api/ops/contacts?limit=5'),
        fetch('/api/ops/companies?limit=50'),
      ]);

      if (contactsRes.ok) {
        const contactsData = await contactsRes.json();
        setContacts(contactsData.data || []);
      }

      if (companiesRes.ok) {
        const companiesData = await companiesRes.json();
        setCompanies(companiesData.data || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.first_name.trim()) {
      setError('First name is required');
      return;
    }
    if (!formData.company_id) {
      setError('Please select a company');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/ops/companies/${formData.company_id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: formData.first_name.trim(),
          last_name: formData.last_name.trim() || null,
          email: formData.email.trim() || null,
          job_title: formData.job_title.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create contact');
      }

      showSuccess('Contact created successfully');
      await loadData();
      setShowForm(false);
      setFormData({ first_name: '', last_name: '', email: '', job_title: '', company_id: '' });
      onComplete();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create contact';
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

  const noCompaniesAvailable = companies.length === 0;

  return (
    <Box>
      {error && !showForm && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Existing Contacts Summary */}
      {hasContacts && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {contacts.length} {contacts.length === 1 ? 'Contact' : 'Contacts'} Found
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
              {contacts.slice(0, 3).map((contact, index) => (
                <ListItem
                  key={contact.id}
                  sx={{
                    borderBottom:
                      index < Math.min(contacts.length - 1, 2)
                        ? `1px solid ${theme.palette.divider}`
                        : 'none',
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <PersonIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={`${contact.first_name} ${contact.last_name || ''}`.trim()}
                    secondary={contact.email || contact.job_title}
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
            {contacts.length > 3 && (
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
                +{contacts.length - 3} more
              </Typography>
            )}
          </Paper>
        </Box>
      )}

      {/* No Companies Warning */}
      {noCompaniesAvailable && !hasContacts && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You need to create a company first before adding contacts.
        </Alert>
      )}

      {/* Add Contact Button / Form Toggle */}
      {!noCompaniesAvailable && (
        <Button
          startIcon={showForm ? <ExpandLessIcon /> : hasContacts ? <AddIcon /> : <PersonIcon />}
          onClick={() => setShowForm(!showForm)}
          variant={hasContacts ? 'outlined' : 'contained'}
          fullWidth={!hasContacts}
          sx={
            hasContacts
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
          {showForm ? 'Hide Form' : hasContacts ? 'Add Another Contact' : 'Add Your First Contact'}
        </Button>
      )}

      {/* Add Contact Form */}
      <Collapse in={showForm && !noCompaniesAvailable}>
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

          <FormControl fullWidth margin="dense" size="small" sx={{ mb: 2 }} required>
            <InputLabel sx={{ color: theme.palette.text.secondary }}>Company</InputLabel>
            <Select
              value={formData.company_id}
              label="Company"
              onChange={(e) => setFormData((prev) => ({ ...prev, company_id: e.target.value }))}
              sx={{
                backgroundColor: theme.palette.action.hover,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
              }}
            >
              {companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              fullWidth
              label="First Name"
              value={formData.first_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
              required
              margin="dense"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
                  '& fieldset': { borderColor: theme.palette.divider },
                },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              }}
            />
            <TextField
              fullWidth
              label="Last Name"
              value={formData.last_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
              margin="dense"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: theme.palette.action.hover,
                  '& fieldset': { borderColor: theme.palette.divider },
                },
                '& .MuiInputLabel-root': { color: theme.palette.text.secondary },
              }}
            />
          </Box>

          <TextField
            fullWidth
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            margin="dense"
            size="small"
            placeholder="email@example.com"
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
            label="Job Title"
            value={formData.job_title}
            onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
            margin="dense"
            size="small"
            placeholder="e.g., CEO, Marketing Director"
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
              disabled={saving || !formData.first_name.trim() || !formData.company_id}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': { backgroundColor: theme.palette.text.secondary },
              }}
            >
              {saving ? <CircularProgress size={20} /> : 'Create Contact'}
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
          {hasContacts ? 'Skip' : 'Skip for Now'}
        </Button>
        {hasContacts && (
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

