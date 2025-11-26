'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { CompanyContact } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';
import ContactDetailSlideout from './ContactDetailSlideout';

interface CompanyContactsTabProps {
  companyId: string;
}

export default function CompanyContactsTab({ companyId }: CompanyContactsTabProps) {
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideoutOpen, setSlideoutOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/companies/${companyId}/contacts`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load contacts');
      }

      const data = await response.json();
      setContacts(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contacts';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleCreateContact = () => {
    router.push(`/ops/companies/${companyId}/contacts/new`);
  };

  const handleViewContact = (contact: CompanyContact, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContactId(contact.id);
    setSlideoutOpen(true);
  };

  const handleDeleteFromSlideout = (contactId: string) => {
    // Contact will be deleted by the slideout, just refresh the list
  };

  const handleDeleteContact = async (contact: CompanyContact, e: React.MouseEvent) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const getLeadStatusColor = (status: string | null | undefined) => {
    if (!status) return 'default';
    switch (status.toLowerCase()) {
      case 'new':
      case 'active':
        return 'info';
      case 'qualified':
      case 'meeting set':
        return 'success';
      case 'closed won':
        return 'success';
      case 'closed lost':
      case 'unqualified':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPipelineStageColor = (stage: string | null | undefined) => {
    if (!stage) return 'default';
    switch (stage.toLowerCase()) {
      case 'lead':
      case 'mql':
        return 'info';
      case 'sql':
      case 'meeting':
        return 'warning';
      case 'proposal':
      case 'negotiation':
        return 'success';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (_: any, row: CompanyContact) => `${row.first_name} ${row.last_name}`,
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'phone',
      label: 'Phone',
      sortable: true,
      render: (value: string | null) => value || '-',
    },
    {
      key: 'lead_status',
      label: 'Lead Status',
      sortable: true,
      render: (value: string | null) =>
        value ? (
          <Chip
            label={value}
            color={getLeadStatusColor(value) as any}
            size="small"
          />
        ) : (
          '-'
        ),
    },
    {
      key: 'pipeline_stage',
      label: 'Pipeline Stage',
      sortable: true,
      render: (value: string | null) =>
        value ? (
          <Chip
            label={value}
            color={getPipelineStageColor(value) as any}
            size="small"
          />
        ) : (
          '-'
        ),
    },
    {
      key: 'next_follow_up_date',
      label: 'Next Follow-Up',
      sortable: true,
      render: (value: string | null) =>
        value ? new Date(value).toLocaleDateString() : '-',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <Chip
          label={value.charAt(0).toUpperCase() + value.slice(1)}
          color={getStatusColor(value) as any}
          size="small"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: any, row: CompanyContact) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleViewContact(row, e)}
            sx={{ color: '#00E5FF' }}
            title="View Details"
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteContact(row, e)}
            sx={{ color: '#FF1744' }}
            title="Delete"
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: '#00E5FF',
            fontWeight: 600,
          }}
        >
          Contacts
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateContact}
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#00B2CC',
            },
          }}
        >
          Add Contact
        </Button>
      </Box>

      {contacts.length === 0 ? (
        <Alert severity="info">
          No contacts yet. Add a contact to get started.
        </Alert>
      ) : (
        <SortableTable
          data={contacts}
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

