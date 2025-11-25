'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Link,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Business as BusinessIcon,
  Notes as NotesIcon,
  Label as LabelIcon,
  History as HistoryIcon,
  AttachFile as AttachFileIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import TagManager from '@/components/ops/TagManager';
import InteractionHistory from '@/components/ops/InteractionHistory';
import AttachmentManager from '@/components/ops/AttachmentManager';
import type { CompanyContactWithCompany, ContactTag, ContactAttachment, ContactInteraction } from '@/types/ops';

interface ContactDetailSlideoutProps {
  open: boolean;
  contactId: string | null;
  onClose: () => void;
  onEdit: (contactId: string) => void;
  onDelete: (contactId: string) => void;
  onRefresh: () => void;
}

export default function ContactDetailSlideout({
  open,
  contactId,
  onClose,
  onEdit,
  onDelete,
  onRefresh,
}: ContactDetailSlideoutProps) {
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [contact, setContact] = useState<CompanyContactWithCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const loadContact = useCallback(async () => {
    if (!contactId) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/contacts/${contactId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load contact');
      }

      const data = await response.json();
      setContact(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contact';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [contactId, showError]);

  const loadRelatedData = useCallback(async () => {
    if (!contactId) return;

    setLoadingRelated(true);
    try {
      // Load tags, attachments, and interactions in parallel
      const [tagsRes, attachmentsRes, interactionsRes] = await Promise.all([
        fetch(`/api/ops/contacts/${contactId}/tags`),
        fetch(`/api/ops/contacts/${contactId}/attachments`),
        fetch(`/api/ops/contacts/${contactId}/interactions`),
      ]);

      if (tagsRes.ok) {
        const tagsData = await tagsRes.json();
        setTags(tagsData || []);
      }

      if (attachmentsRes.ok) {
        const attachmentsData = await attachmentsRes.json();
        setAttachments(attachmentsData || []);
      }

      if (interactionsRes.ok) {
        const interactionsData = await interactionsRes.json();
        setInteractions(interactionsData || []);
      }
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }, [contactId]);

  const handleDelete = async () => {
    if (!contact) return;

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
      onDelete(contact.id);
      onRefresh();
      onClose();
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

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: '75%', md: '700px' },
          backgroundColor: '#000',
          borderLeft: '2px solid rgba(0, 229, 255, 0.2)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: '#00E5FF',
              fontWeight: 600,
            }}
          >
            Contact Details
          </Typography>
          <IconButton
            onClick={onClose}
            sx={{
              color: '#B0B0B0',
              '&:hover': {
                color: '#00E5FF',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        {contact && (
          <Box sx={{ borderBottom: '2px solid rgba(0, 229, 255, 0.2)' }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{
                '& .MuiTab-root': {
                  color: '#B0B0B0',
                  '&.Mui-selected': {
                    color: '#00E5FF',
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#00E5FF',
                },
              }}
            >
              <Tab label="Overview" />
              <Tab label="Tags" icon={<LabelIcon />} iconPosition="start" />
              <Tab label="Interactions" icon={<HistoryIcon />} iconPosition="start" />
              <Tab label="Attachments" icon={<AttachFileIcon />} iconPosition="start" />
            </Tabs>
          </Box>
        )}

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : contact ? (
            <>
              {activeTab === 0 && (
                <>
                  {/* Name and Status */}
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="h5"
                      sx={{
                        color: '#E0E0E0',
                        fontWeight: 600,
                        mb: 1,
                      }}
                    >
                      {contact.first_name} {contact.last_name}
                    </Typography>
                    <Chip
                      label={contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                      color={getStatusColor(contact.status) as any}
                      size="small"
                    />
                  </Box>

                  <Divider sx={{ my: 3, borderColor: 'rgba(0, 229, 255, 0.2)' }} />

                  {/* Company */}
                  {contact.company && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <BusinessIcon sx={{ fontSize: 20, color: '#00E5FF' }} />
                        <Typography variant="body2" sx={{ color: '#B0B0B0', fontWeight: 600 }}>
                          Company
                        </Typography>
                      </Box>
                      <Link
                        href={`/ops/companies/${contact.company.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          router.push(`/ops/companies/${contact.company!.id}`);
                          onClose();
                        }}
                        sx={{
                          color: '#00E5FF',
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {contact.company.name}
                      </Link>
                    </Box>
                  )}

                  {/* Email */}
                  {contact.email && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <EmailIcon sx={{ fontSize: 20, color: '#00E5FF' }} />
                        <Typography variant="body2" sx={{ color: '#B0B0B0', fontWeight: 600 }}>
                          Email
                        </Typography>
                      </Box>
                      <Link
                        href={`mailto:${contact.email}`}
                        sx={{
                          color: '#E0E0E0',
                          textDecoration: 'none',
                          '&:hover': {
                            color: '#00E5FF',
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {contact.email}
                      </Link>
                    </Box>
                  )}

                  {/* Phone */}
                  {contact.phone && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <PhoneIcon sx={{ fontSize: 20, color: '#00E5FF' }} />
                        <Typography variant="body2" sx={{ color: '#B0B0B0', fontWeight: 600 }}>
                          Phone
                        </Typography>
                      </Box>
                      <Link
                        href={`tel:${contact.phone}`}
                        sx={{
                          color: '#E0E0E0',
                          textDecoration: 'none',
                          '&:hover': {
                            color: '#00E5FF',
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {contact.phone}
                      </Link>
                    </Box>
                  )}

                  {/* Notes */}
                  {contact.notes && (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <NotesIcon sx={{ fontSize: 20, color: '#00E5FF' }} />
                        <Typography variant="body2" sx={{ color: '#B0B0B0', fontWeight: 600 }}>
                          Notes
                        </Typography>
                      </Box>
                      <Typography
                        variant="body1"
                        sx={{
                          color: '#E0E0E0',
                          whiteSpace: 'pre-wrap',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          p: 2,
                          borderRadius: 1,
                        }}
                      >
                        {contact.notes}
                      </Typography>
                    </Box>
                  )}

                  {/* Metadata */}
                  <Divider sx={{ my: 3, borderColor: 'rgba(0, 229, 255, 0.2)' }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                      Created: {new Date(contact.created_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
                      Updated: {new Date(contact.updated_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </>
              )}

              {activeTab === 1 && contactId && (
                <TagManager
                  contactId={contactId}
                  tags={tags}
                  onTagsChange={loadRelatedData}
                />
              )}

              {activeTab === 2 && contactId && (
                <InteractionHistory
                  contactId={contactId}
                  interactions={interactions}
                  onInteractionsChange={loadRelatedData}
                />
              )}

              {activeTab === 3 && contactId && (
                <AttachmentManager
                  contactId={contactId}
                  attachments={attachments}
                  onAttachmentsChange={loadRelatedData}
                />
              )}
            </>
          ) : null}
        </Box>

        {/* Footer Actions */}
        {contact && (
          <Box
            sx={{
              p: 2,
              borderTop: '2px solid rgba(0, 229, 255, 0.2)',
              display: 'flex',
              gap: 2,
            }}
          >
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => {
                onEdit(contact.id);
                onClose();
              }}
              sx={{
                flex: 1,
                borderColor: '#00E5FF',
                color: '#00E5FF',
                '&:hover': {
                  borderColor: '#00B2CC',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              sx={{
                flex: 1,
                borderColor: '#FF1744',
                color: '#FF1744',
                '&:hover': {
                  borderColor: '#D50000',
                  backgroundColor: 'rgba(255, 23, 68, 0.1)',
                },
              }}
            >
              Delete
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

