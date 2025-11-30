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
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Checkbox,
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
  Work as WorkIcon,
  Language as LanguageIcon,
  LinkedIn as LinkedInIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Schedule as ScheduleIcon,
  Star as StarIcon,
  Assignment as AssignmentIcon,
  Warning as WarningIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import TagManager from '@/components/ops/TagManager';
import InteractionHistory from '@/components/ops/InteractionHistory';
import AttachmentManager from '@/components/ops/AttachmentManager';
import type { CompanyContactWithCompany, ContactTag, ContactAttachment, ContactInteraction, LeadSource, LeadStatus, PipelineStage, PriorityLevel, LifecycleStage, FollowUpType, PreferredCommunication, ContactStatus } from '@/types/ops';
import type { User } from '@/types/project';

interface ContactDetailSlideoutProps {
  open: boolean;
  contactId: string | null;
  onClose: () => void;
  onDelete: (contactId: string) => void;
  onRefresh: () => void;
}

export default function ContactDetailSlideout({
  open,
  contactId,
  onClose,
  onDelete,
  onRefresh,
}: ContactDetailSlideoutProps) {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [contact, setContact] = useState<CompanyContactWithCompany | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [tags, setTags] = useState<ContactTag[]>([]);
  const [attachments, setAttachments] = useState<ContactAttachment[]>([]);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [isEditing, setIsEditing] = useState(true); // Start in edit mode for inline editing
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Editable form state
  const [formData, setFormData] = useState<Partial<CompanyContactWithCompany>>({});

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

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error loading users:', errorData.error || 'Failed to load users');
        showError(errorData.error || 'Failed to load users');
      }
    } catch (err) {
      console.error('Error loading users:', err);
      showError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [showError]);

  // Load contact when slideout opens or contactId changes
  useEffect(() => {
    if (open && contactId) {
      loadContact();
      loadRelatedData();
      loadUsers();
    } else if (!open) {
      // Reset state when slideout closes
      setContact(null);
      setError(null);
      setTags([]);
      setAttachments([]);
      setInteractions([]);
      setActiveTab(0);
      setIsEditing(true);
      setFormData({});
    }
  }, [open, contactId, loadContact, loadRelatedData, loadUsers]);

  // Initialize form data when contact loads
  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        phone_mobile: contact.phone_mobile || '',
        job_title: contact.job_title || '',
        website: contact.website || '',
        linkedin_url: contact.linkedin_url || '',
        address_street: contact.address_street || '',
        address_city: contact.address_city || '',
        address_state: contact.address_state || '',
        address_zip: contact.address_zip || '',
        address_country: contact.address_country || '',
        lead_source: contact.lead_source || null,
        campaign_initiative: contact.campaign_initiative || '',
        date_first_contacted: contact.date_first_contacted ? contact.date_first_contacted.split('T')[0] : '',
        original_inquiry_notes: contact.original_inquiry_notes || '',
        lead_status: contact.lead_status || null,
        pipeline_stage: contact.pipeline_stage || null,
        priority_level: contact.priority_level || null,
        assigned_to: contact.assigned_to || null,
        lifecycle_stage: contact.lifecycle_stage || null,
        last_contact_date: contact.last_contact_date ? contact.last_contact_date.split('T')[0] : '',
        next_follow_up_date: contact.next_follow_up_date ? contact.next_follow_up_date.split('T')[0] : '',
        follow_up_type: contact.follow_up_type || null,
        preferred_communication: contact.preferred_communication || null,
        is_decision_maker: contact.is_decision_maker ?? null,
        budget: contact.budget || '',
        timeline_urgency: contact.timeline_urgency || '',
        pain_points_needs: contact.pain_points_needs || '',
        risk_flags: contact.risk_flags || '',
        customer_since_date: contact.customer_since_date ? contact.customer_since_date.split('T')[0] : '',
        contract_start_date: contact.contract_start_date ? contact.contract_start_date.split('T')[0] : '',
        contract_end_date: contact.contract_end_date ? contact.contract_end_date.split('T')[0] : '',
        renewal_date: contact.renewal_date ? contact.renewal_date.split('T')[0] : '',
        subscription_level: contact.subscription_level || '',
        support_rep_csm: contact.support_rep_csm || null,
        health_score: contact.health_score || null,
        nps_score: contact.nps_score || null,
        notes: contact.notes || '',
        status: contact.status || 'active',
      });
    }
  }, [contact]);

  const handleSave = async () => {
    if (!contactId || !contact) return;

    // Validate required fields
    if (!formData.first_name || !formData.last_name) {
      showError('First name and last name are required');
      return;
    }

    setSaving(true);
    try {
      const updatePayload: any = {
        first_name: formData.first_name?.trim(),
        last_name: formData.last_name?.trim(),
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        phone_mobile: formData.phone_mobile?.trim() || null,
        job_title: formData.job_title?.trim() || null,
        website: formData.website?.trim() || null,
        linkedin_url: formData.linkedin_url?.trim() || null,
        address_street: formData.address_street?.trim() || null,
        address_city: formData.address_city?.trim() || null,
        address_state: formData.address_state?.trim() || null,
        address_zip: formData.address_zip?.trim() || null,
        address_country: formData.address_country?.trim() || null,
        lead_source: formData.lead_source || null,
        campaign_initiative: formData.campaign_initiative?.trim() || null,
        date_first_contacted: formData.date_first_contacted || null,
        original_inquiry_notes: formData.original_inquiry_notes?.trim() || null,
        lead_status: formData.lead_status || null,
        pipeline_stage: formData.pipeline_stage || null,
        priority_level: formData.priority_level || null,
        assigned_to: formData.assigned_to || null,
        lifecycle_stage: formData.lifecycle_stage || null,
        last_contact_date: formData.last_contact_date || null,
        next_follow_up_date: formData.next_follow_up_date || null,
        follow_up_type: formData.follow_up_type || null,
        preferred_communication: formData.preferred_communication || null,
        is_decision_maker: formData.is_decision_maker ?? null,
        budget: formData.budget?.trim() || null,
        timeline_urgency: formData.timeline_urgency?.trim() || null,
        pain_points_needs: formData.pain_points_needs?.trim() || null,
        risk_flags: formData.risk_flags?.trim() || null,
        customer_since_date: formData.customer_since_date || null,
        contract_start_date: formData.contract_start_date || null,
        contract_end_date: formData.contract_end_date || null,
        renewal_date: formData.renewal_date || null,
        subscription_level: formData.subscription_level?.trim() || null,
        support_rep_csm: formData.support_rep_csm || null,
        health_score: formData.health_score ? parseInt(formData.health_score.toString()) : null,
        nps_score: formData.nps_score ? parseInt(formData.nps_score.toString()) : null,
        notes: formData.notes?.trim() || null,
        status: formData.status || 'active',
      };

      const response = await fetch(`/api/ops/contacts/${contactId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update contact');
      }

      showSuccess('Contact updated successfully');
      await loadContact();
      onRefresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update contact';
      showError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to contact values
    if (contact) {
      setFormData({
        first_name: contact.first_name || '',
        last_name: contact.last_name || '',
        email: contact.email || '',
        phone: contact.phone || '',
        phone_mobile: contact.phone_mobile || '',
        job_title: contact.job_title || '',
        website: contact.website || '',
        linkedin_url: contact.linkedin_url || '',
        address_street: contact.address_street || '',
        address_city: contact.address_city || '',
        address_state: contact.address_state || '',
        address_zip: contact.address_zip || '',
        address_country: contact.address_country || '',
        lead_source: contact.lead_source || null,
        campaign_initiative: contact.campaign_initiative || '',
        date_first_contacted: contact.date_first_contacted ? contact.date_first_contacted.split('T')[0] : '',
        original_inquiry_notes: contact.original_inquiry_notes || '',
        lead_status: contact.lead_status || null,
        pipeline_stage: contact.pipeline_stage || null,
        priority_level: contact.priority_level || null,
        assigned_to: contact.assigned_to || null,
        lifecycle_stage: contact.lifecycle_stage || null,
        last_contact_date: contact.last_contact_date ? contact.last_contact_date.split('T')[0] : '',
        next_follow_up_date: contact.next_follow_up_date ? contact.next_follow_up_date.split('T')[0] : '',
        follow_up_type: contact.follow_up_type || null,
        preferred_communication: contact.preferred_communication || null,
        is_decision_maker: contact.is_decision_maker ?? null,
        budget: contact.budget || '',
        timeline_urgency: contact.timeline_urgency || '',
        pain_points_needs: contact.pain_points_needs || '',
        risk_flags: contact.risk_flags || '',
        customer_since_date: contact.customer_since_date ? contact.customer_since_date.split('T')[0] : '',
        contract_start_date: contact.contract_start_date ? contact.contract_start_date.split('T')[0] : '',
        contract_end_date: contact.contract_end_date ? contact.contract_end_date.split('T')[0] : '',
        renewal_date: contact.renewal_date ? contact.renewal_date.split('T')[0] : '',
        subscription_level: contact.subscription_level || '',
        support_rep_csm: contact.support_rep_csm || null,
        health_score: contact.health_score || null,
        nps_score: contact.nps_score || null,
        notes: contact.notes || '',
        status: contact.status || 'active',
      });
    }
  };

  // Helper function to render editable text field
  const renderEditableTextField = (
    label: string,
    fieldName: keyof CompanyContactWithCompany,
    icon?: React.ReactNode,
    multiline = false,
    type: string = 'text'
  ) => {
    const value = formData[fieldName] || '';
    if (isEditing) {
      return (
        <Box sx={{ mb: 2 }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {icon}
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                {label}
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            size="small"
            value={value}
            onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
            multiline={multiline}
            rows={multiline ? 3 : 1}
            type={type}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
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
        </Box>
      );
    }
    return null;
  };

  // Helper function to render editable select field
  const renderEditableSelectField = (
    label: string,
    fieldName: keyof CompanyContactWithCompany,
    options: { value: string; label: string }[],
    icon?: React.ReactNode
  ) => {
    const value = formData[fieldName] || '';
    if (isEditing) {
      return (
        <Box sx={{ mb: 2 }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {icon}
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                {label}
              </Typography>
            </Box>
          )}
          <FormControl fullWidth size="small">
            <Select
              value={value || ''}
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value || null })}
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
              }}
            >
              <MenuItem value="">None</MenuItem>
              {options.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      );
    }
    return null;
  };

  // Helper function to render editable user select field
  const renderEditableUserSelectField = (
    label: string,
    fieldName: 'assigned_to' | 'support_rep_csm',
    icon?: React.ReactNode
  ) => {
    const value = formData[fieldName] || '';
    if (isEditing) {
      return (
        <Box sx={{ mb: 2 }}>
          {icon && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              {icon}
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
                {label}
              </Typography>
            </Box>
          )}
          <FormControl fullWidth size="small">
            <Select
              value={value || ''}
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value || null })}
              disabled={loadingUsers}
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
              }}
            >
              <MenuItem value="">Unassigned</MenuItem>
              {users.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      );
    }
    return null;
  };

  // Helper function to render editable checkbox field
  const renderEditableCheckboxField = (
    label: string,
    fieldName: 'is_decision_maker'
  ) => {
    if (isEditing) {
      return (
        <Box sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData[fieldName] === true}
                onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.checked })}
                sx={{
                  color: theme.palette.text.primary,
                  '&.Mui-checked': {
                    color: theme.palette.text.primary,
                  },
                }}
              />
            }
            label={label}
            sx={{ color: theme.palette.text.primary }}
          />
        </Box>
      );
    }
    return null;
  };

  // Helper function to render a field with view/edit modes
  const renderField = (
    label: string,
    fieldName: keyof CompanyContactWithCompany,
    icon?: React.ReactNode,
    type: 'text' | 'email' | 'tel' | 'url' | 'date' | 'number' | 'textarea' = 'text',
    options?: { value: string; label: string }[],
    isUserSelect = false,
    showIfEmpty = false
  ) => {
    const value = isEditing ? (formData[fieldName] || '') : (contact?.[fieldName] || '');
    const shouldShow = showIfEmpty || value || isEditing;

    if (!shouldShow) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {icon && icon}
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
            {label}
          </Typography>
        </Box>
        {isEditing ? (
          type === 'textarea' ? (
            <TextField
              fullWidth
              multiline
              rows={3}
              value={value}
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                },
              }}
            />
          ) : options ? (
            <FormControl fullWidth size="small">
              <Select
                value={value || ''}
                onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value || null })}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.primary },
                }}
              >
                <MenuItem value="">None</MenuItem>
                {options.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : isUserSelect ? (
            <FormControl fullWidth size="small">
              <Select
                value={value || ''}
                onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value || null })}
                disabled={loadingUsers}
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) return 'Unassigned';
                  const selectedUser = users.find((u) => u.id === selected);
                  return selectedUser ? (selectedUser.name || selectedUser.email) : 'Unassigned';
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.divider },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.secondary },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.text.primary },
                }}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.id}>{user.name || user.email}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <TextField
              fullWidth
              type={type}
              value={value}
              onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                  '& fieldset': { borderColor: theme.palette.divider },
                  '&:hover fieldset': { borderColor: theme.palette.text.secondary },
                  '&.Mui-focused fieldset': { borderColor: theme.palette.text.primary },
                },
              }}
            />
          )
        ) : (
          type === 'url' && value ? (
            <Link
              href={String(value).startsWith('http') ? String(value) : `https://${value}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: theme.palette.text.primary,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline', opacity: 0.8 },
              }}
            >
              {String(value)}
            </Link>
          ) : type === 'email' && value ? (
            <Link
              href={`mailto:${value}`}
              sx={{
                color: theme.palette.text.primary,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline', opacity: 0.8 },
              }}
            >
              {String(value)}
            </Link>
          ) : type === 'tel' && value ? (
            <Link
              href={`tel:${value}`}
              sx={{
                color: theme.palette.text.primary,
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline', opacity: 0.8 },
              }}
            >
              {String(value)}
            </Link>
          ) : type === 'date' && value ? (
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {new Date(String(value)).toLocaleDateString()}
            </Typography>
          ) : (
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              {value ? String(value) : '—'}
            </Typography>
          )
        )}
      </Box>
    );
  };

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
          backgroundColor: theme.palette.background.default,
          borderLeft: `2px solid ${theme.palette.divider}`,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'calc(100vh - 60px)' }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            px: 4,
            pb: 2,
            borderBottom: `2px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            minHeight: '64px',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              fontWeight: 600,
              marginBottom: 0,
              lineHeight: 1.2,
            }}
          >
            Contact Details
          </Typography>
          <IconButton
            onClick={onClose}
            title="Close"
            sx={{
              color: theme.palette.text.secondary,
              padding: '8px',
              '&:hover': {
                color: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        {contact && (
          <Box sx={{ borderBottom: `2px solid ${theme.palette.divider}` }}>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{
                '& .MuiTab-root': {
                  color: theme.palette.text.secondary,
                  '&.Mui-selected': {
                    color: theme.palette.text.primary,
                  },
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: theme.palette.text.primary,
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
                    <Box sx={{ mb: 2 }}>
                      <TextField
                        fullWidth
                        label="First Name"
                        value={formData.first_name || ''}
                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                        required
                        size="small"
                        sx={{
                          mb: 2,
                          '& .MuiOutlinedInput-root': {
                            color: theme.palette.text.primary,
                            backgroundColor: theme.palette.action.hover,
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
                      <TextField
                        fullWidth
                        label="Last Name"
                        value={formData.last_name || ''}
                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                        required
                        size="small"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            color: theme.palette.text.primary,
                            backgroundColor: theme.palette.action.hover,
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
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                        <Select
                          value={formData.status || 'active'}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value as ContactStatus })}
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
                          }}
                        >
                          <MenuItem value="active">Active</MenuItem>
                          <MenuItem value="inactive">Inactive</MenuItem>
                          <MenuItem value="archived">Archived</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    {/* Display chips for lead status, pipeline, priority */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
                      {formData.lead_status && (
                        <Chip label={`Lead: ${formData.lead_status}`} size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary }} />
                      )}
                      {formData.pipeline_stage && (
                        <Chip label={`Pipeline: ${formData.pipeline_stage}`} size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary }} />
                      )}
                      {formData.priority_level && (
                        <Chip label={`Priority: ${formData.priority_level}`} size="small" sx={{ backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary }} />
                      )}
                    </Box>
                  </Box>

                  <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />

                  {/* Contact Information Section */}
                  <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                    Contact Information
                  </Typography>

                  {/* Company */}
                  {contact.company && (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <BusinessIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>
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
                          color: theme.palette.text.primary,
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

                  {renderField('Job Title', 'job_title', <WorkIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'text', undefined, false, true)}
                  {renderField('Email', 'email', <EmailIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'email', undefined, false, true)}
                  {renderField('Phone (Work)', 'phone', <PhoneIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'tel', undefined, false, true)}
                  {renderField('Phone (Mobile)', 'phone_mobile', <PhoneIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'tel', undefined, false, true)}
                  {renderField('Website', 'website', <LanguageIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'url', undefined, false, true)}
                  {renderField('LinkedIn', 'linkedin_url', <LinkedInIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'url', undefined, false, true)}
                  
                  {/* Address Fields */}
                  <>
                    {renderField('Address Street', 'address_street', <LocationIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'text', undefined, false, true)}
                    {renderField('Address City', 'address_city', undefined, 'text', undefined, false, true)}
                    {renderField('Address State', 'address_state', undefined, 'text', undefined, false, true)}
                    {renderField('Address ZIP', 'address_zip', undefined, 'text', undefined, false, true)}
                    {renderField('Address Country', 'address_country', undefined, 'text', undefined, false, true)}
                  </>

                  <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />

                  {/* Lead Source & Marketing Section */}
                  <>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                      Lead Source & Marketing
                    </Typography>

                      {renderField('Lead Source', 'lead_source', undefined, 'text', [
                        { value: 'Referral', label: 'Referral' },
                        { value: 'Website', label: 'Website' },
                        { value: 'Event', label: 'Event' },
                        { value: 'Social Media', label: 'Social Media' },
                        { value: 'Cold Outreach', label: 'Cold Outreach' },
                        { value: 'Partner', label: 'Partner' },
                        { value: 'Other', label: 'Other' },
                      ], false, true)}
                      {renderField('Campaign/Initiative', 'campaign_initiative', undefined, 'text', undefined, false, true)}
                      {renderField('Date First Contacted', 'date_first_contacted', undefined, 'date', undefined, false, true)}
                      {renderField('Original Inquiry Notes', 'original_inquiry_notes', undefined, 'textarea', undefined, false, true)}

                    <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  </>

                  {/* Status & Pipeline Section */}
                  <>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                      Status & Pipeline
                    </Typography>

                      {renderField('Lead Status', 'lead_status', undefined, 'text', [
                        { value: 'New', label: 'New' },
                        { value: 'Active', label: 'Active' },
                        { value: 'Unqualified', label: 'Unqualified' },
                        { value: 'Nurturing', label: 'Nurturing' },
                        { value: 'Qualified', label: 'Qualified' },
                        { value: 'Meeting Set', label: 'Meeting Set' },
                        { value: 'Proposal Sent', label: 'Proposal Sent' },
                        { value: 'Closed Won', label: 'Closed Won' },
                        { value: 'Closed Lost', label: 'Closed Lost' },
                      ], false, true)}
                      {renderField('Pipeline Stage', 'pipeline_stage', undefined, 'text', [
                        { value: 'Lead', label: 'Lead' },
                        { value: 'MQL', label: 'MQL' },
                        { value: 'SQL', label: 'SQL' },
                        { value: 'Meeting', label: 'Meeting' },
                        { value: 'Proposal', label: 'Proposal' },
                        { value: 'Negotiation', label: 'Negotiation' },
                        { value: 'Closed', label: 'Closed' },
                      ], false, true)}
                      {renderField('Priority Level', 'priority_level', undefined, 'text', [
                        { value: 'Low', label: 'Low' },
                        { value: 'Medium', label: 'Medium' },
                        { value: 'High', label: 'High' },
                        { value: 'Critical', label: 'Critical' },
                      ], false, true)}
                      {renderField('Lifecycle Stage', 'lifecycle_stage', undefined, 'text', [
                        { value: 'Lead', label: 'Lead' },
                        { value: 'MQL', label: 'MQL' },
                        { value: 'SQL', label: 'SQL' },
                        { value: 'Customer', label: 'Customer' },
                        { value: 'Advocate', label: 'Advocate' },
                      ], false, true)}
                      {renderField('Assigned To', 'assigned_to', <PersonIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'text', undefined, true, true)}

                    <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  </>

                  {/* Activity Tracking Section */}
                  <>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                      Activity Tracking
                    </Typography>

                      {renderField('Last Contact Date', 'last_contact_date', <ScheduleIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'date', undefined, false, true)}
                      {renderField('Next Follow-Up Date', 'next_follow_up_date', <ScheduleIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'date', undefined, false, true)}
                      {renderField('Follow-Up Type', 'follow_up_type', undefined, 'text', [
                        { value: 'Call', label: 'Call' },
                        { value: 'Email', label: 'Email' },
                        { value: 'Meeting', label: 'Meeting' },
                        { value: 'LinkedIn', label: 'LinkedIn' },
                        { value: 'Other', label: 'Other' },
                      ], false, true)}
                      {renderField('Preferred Communication', 'preferred_communication', undefined, 'text', [
                        { value: 'Email', label: 'Email' },
                        { value: 'SMS', label: 'SMS' },
                        { value: 'Phone', label: 'Phone' },
                        { value: 'LinkedIn', label: 'LinkedIn' },
                        { value: 'Other', label: 'Other' },
                      ], false, true)}

                    <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  </>

                  {/* Preferences & Details Section */}
                  <>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                      Preferences & Details
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={formData.is_decision_maker === true}
                            onChange={(e) => setFormData({ ...formData, is_decision_maker: e.target.checked })}
                            sx={{
                              color: theme.palette.text.primary,
                              '&.Mui-checked': {
                                color: theme.palette.text.primary,
                              },
                            }}
                          />
                        }
                        label="Decision Maker"
                        sx={{ color: theme.palette.text.primary }}
                      />
                    </Box>

                      {renderField('Budget', 'budget', undefined, 'text', undefined, false, true)}
                      {renderField('Timeline/Urgency', 'timeline_urgency', undefined, 'text', undefined, false, true)}
                      {renderField('Pain Points/Needs', 'pain_points_needs', undefined, 'textarea', undefined, false, true)}
                      {renderField('Risk Flags', 'risk_flags', <WarningIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'textarea', undefined, false, true)}

                    <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  </>

                  {/* Customer-Specific Data Section */}
                  <>
                    <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 600 }}>
                      Customer Data
                    </Typography>

                      {renderField('Customer Since', 'customer_since_date', undefined, 'date', undefined, false, true)}
                      {renderField('Contract Start Date', 'contract_start_date', undefined, 'date', undefined, false, true)}
                      {renderField('Contract End Date', 'contract_end_date', undefined, 'date', undefined, false, true)}
                      {renderField('Renewal Date', 'renewal_date', undefined, 'date', undefined, false, true)}
                      {renderField('Subscription Level', 'subscription_level', undefined, 'text', undefined, false, true)}
                      {renderField('Support Rep/CSM', 'support_rep_csm', <PersonIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'text', undefined, true, true)}
                      {renderField('Health Score', 'health_score', <StarIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'number', undefined, false, true)}
                      {renderField('NPS Score', 'nps_score', <TrendingUpIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'number', undefined, false, true)}

                    <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  </>

                  {/* Notes */}
                  {renderField('Notes', 'notes', <NotesIcon sx={{ fontSize: 20, color: theme.palette.text.primary }} />, 'textarea', undefined, false, true)}

                  {/* Metadata */}
                  <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                      Created: {new Date(contact.created_at).toLocaleDateString()}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
              borderTop: `2px solid ${theme.palette.divider}`,
              display: 'flex',
              gap: 2,
            }}
          >
            <Button
              variant="outlined"
              startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || !contact || loading}
              sx={{
                flex: 1,
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
                '&:disabled': {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
            >
              Save
            </Button>
            <Button
              variant="outlined"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              sx={{
                flex: 1,
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
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

