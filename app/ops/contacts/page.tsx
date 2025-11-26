'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { Contacts as ContactsIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyContactWithCompany } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';
import ContactDetailSlideout from '@/components/ops/ContactDetailSlideout';

export default function ContactsPage() {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [contacts, setContacts] = useState<CompanyContactWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>('all');
  const [pipelineStageFilter, setPipelineStageFilter] = useState<string>('all');
  const [leadSourceFilter, setLeadSourceFilter] = useState<string>('all');
  const [slideoutOpen, setSlideoutOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (leadStatusFilter !== 'all') params.append('lead_status', leadStatusFilter);
      if (pipelineStageFilter !== 'all') params.append('pipeline_stage', pipelineStageFilter);
      if (leadSourceFilter !== 'all') params.append('lead_source', leadSourceFilter);

      const response = await fetch(`/api/ops/contacts?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load contacts');
      }

      const data = await response.json();
      setContacts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, leadStatusFilter, pipelineStageFilter, leadSourceFilter, showError]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleCreateContact = () => {
    router.push('/ops/contacts/new');
  };

  const handleViewContact = (contact: CompanyContactWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContactId(contact.id);
    setSlideoutOpen(true);
  };

  const handleDeleteFromSlideout = (contactId: string) => {
    // Contact will be deleted by the slideout, just refresh the list
  };

  const handleDeleteContact = async (contact: CompanyContactWithCompany, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${contact.first_name} ${contact.last_name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ops/contacts/${contact.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete contact');
      }

      showSuccess('Contact deleted successfully');
      loadContacts();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete contact';
      showError(errorMessage);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_: any, row: CompanyContactWithCompany) => (
        <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          {`${row.first_name} ${row.last_name}`}
        </Typography>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (value: any) => {
        if (!value?.name) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
            {value.name}
          </Typography>
        );
      },
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value: string | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {value}
          </Typography>
        );
      },
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (value: string | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {value}
          </Typography>
        );
      },
    },
    {
      key: 'lead_status',
      label: 'Lead Status',
      sortable: true,
      render: (value: string | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Chip
            label={value}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              fontWeight: 500,
            }}
          />
        );
      },
    },
    {
      key: 'pipeline_stage',
      label: 'Pipeline Stage',
      sortable: true,
      render: (value: string | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Chip
            label={value}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              fontWeight: 500,
            }}
          />
        );
      },
    },
    {
      key: 'next_follow_up_date',
      label: 'Next Follow-Up',
      sortable: true,
      render: (value: string | null) => {
        if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
        return (
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {new Date(value).toLocaleDateString()}
          </Typography>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          size="small"
          sx={{
            backgroundColor: theme.palette.action.hover,
            color: theme.palette.text.primary,
            border: `1px solid ${theme.palette.divider}`,
            fontWeight: 500,
          }}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: any, row: CompanyContactWithCompany) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleViewContact(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteContact(row, e)}
            sx={{ color: theme.palette.text.primary }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  // Filtering is now done server-side via API
  const filteredContacts = contacts;

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Skeleton variant="text" width="200px" height={48} />
          <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
        </Box>
        <LoadingSkeleton variant="dashboard" count={6} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Contacts
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleCreateContact}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Add Contact
        </Button>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {contacts.length > 0 && (
        <Box
          sx={{
            p: 2,
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: theme.palette.text.primary }} />
                    </InputAdornment>
                  ),
                }}
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
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
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
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Lead Status</InputLabel>
                <Select
                  value={leadStatusFilter}
                  onChange={(e) => setLeadStatusFilter(e.target.value)}
                  label="Lead Status"
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
                  <MenuItem value="all">All Lead Statuses</MenuItem>
                  <MenuItem value="New">New</MenuItem>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Qualified">Qualified</MenuItem>
                  <MenuItem value="Meeting Set">Meeting Set</MenuItem>
                  <MenuItem value="Proposal Sent">Proposal Sent</MenuItem>
                  <MenuItem value="Closed Won">Closed Won</MenuItem>
                  <MenuItem value="Closed Lost">Closed Lost</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Pipeline Stage</InputLabel>
                <Select
                  value={pipelineStageFilter}
                  onChange={(e) => setPipelineStageFilter(e.target.value)}
                  label="Pipeline Stage"
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
                  <MenuItem value="all">All Stages</MenuItem>
                  <MenuItem value="Lead">Lead</MenuItem>
                  <MenuItem value="MQL">MQL</MenuItem>
                  <MenuItem value="SQL">SQL</MenuItem>
                  <MenuItem value="Meeting">Meeting</MenuItem>
                  <MenuItem value="Proposal">Proposal</MenuItem>
                  <MenuItem value="Negotiation">Negotiation</MenuItem>
                  <MenuItem value="Closed">Closed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Lead Source</InputLabel>
                <Select
                  value={leadSourceFilter}
                  onChange={(e) => setLeadSourceFilter(e.target.value)}
                  label="Lead Source"
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
                  <MenuItem value="all">All Sources</MenuItem>
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Website">Website</MenuItem>
                  <MenuItem value="Event">Event</MenuItem>
                  <MenuItem value="Social Media">Social Media</MenuItem>
                  <MenuItem value="Cold Outreach">Cold Outreach</MenuItem>
                  <MenuItem value="Partner">Partner</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  textAlign: { xs: 'left', md: 'right' },
                }}
              >
                {contacts.length} contacts
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {contacts.length === 0 && !loading ? (
        <EmptyState
          icon={<ContactsIcon sx={{ fontSize: 64 }} />}
          title="No Contacts"
          description="Get started by creating your first contact"
          actionLabel="Add Contact"
          onAction={handleCreateContact}
        />
      ) : (
        <SortableTable
          data={filteredContacts}
          columns={columns}
          emptyMessage="No contacts found"
        />
      )}

      <ContactDetailSlideout
        open={slideoutOpen}
        contactId={selectedContactId}
        onClose={() => {
          setSlideoutOpen(false);
          setSelectedContactId(null);
        }}
        onDelete={handleDeleteFromSlideout}
        onRefresh={loadContacts}
      />
    </Box>
  );
}

