'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Alert,
  Chip,
  CircularProgress,
  Paper,
  Grid,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Build as BuildIcon,
  ContentCopy as ContentCopyIcon,
  AutoAwesome as AutoAwesomeIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import logger from '@/lib/utils/logger';
import type { ProjectTemplate } from '@/types/project';
import SortableTable from '@/components/dashboard/SortableTable';

export default function TemplatesPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { features, loading: orgLoading } = useOrganization();
  const { showSuccess, showError } = useNotification();
  const [templates, setTemplates] = useState<(ProjectTemplate & { usage_count?: number })[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; templateId: string | null }>({
    open: false,
    templateId: null,
  });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_public: false, // Visible to all organization members
    is_publicly_available: false, // Available to public
    category: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [publicFilter, setPublicFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get current user ID via API to avoid RLS recursion
      const userResponse = await fetch('/api/users/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData?.id) {
          setCurrentUserId(userData.id);
        }
      }

      const offset = (page - 1) * pageSize;
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });

      const response = await fetch(`/api/templates?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load templates');
      }

      setTemplates(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load templates';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError, page, pageSize]);

  useEffect(() => {
    logger.debug('[TemplatesPage] Access check:', { role, roleLoading, orgLoading, features });
    
    if (roleLoading || orgLoading) {
      logger.debug('[TemplatesPage] Still loading, waiting...');
      return; // Wait for role and org to load
    }

    // Check if organization has template access based on package limits
    // If features exist and max_templates is defined (null = unlimited, number = limited), they have access
    // Note: max_templates can be null (unlimited), a number (limited), or undefined (no access)
    const hasTemplateAccess = features !== null && features !== undefined && features.max_templates !== undefined;
    
    if (!hasTemplateAccess) {
      logger.debug('[TemplatesPage] Organization does not have template access, redirecting.', { 
        features, 
        maxTemplates: features?.max_templates 
      });
      router.push('/dashboard');
      return;
    }

    logger.debug('[TemplatesPage] Organization has template access, loading templates.');
    loadTemplates();
  }, [role, roleLoading, orgLoading, features, router, loadTemplates, page, pageSize]);

  const handleOpenDialog = (template?: ProjectTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        is_public: template.is_public,
        is_publicly_available: template.is_publicly_available || false,
        category: template.category || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        is_public: false,
        is_publicly_available: false,
        category: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      is_public: false,
      is_publicly_available: false,
      category: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Template name is required');
      return;
    }

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    if (editingTemplate) {
      // Check if template is global (cannot be edited)
      if (editingTemplate.is_publicly_available) {
        showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
        return;
      }

      // Update existing template via API endpoint
      try {
        const response = await fetch(`/api/templates/${editingTemplate.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            is_public: formData.is_public,
            category: formData.category || null,
            // Note: is_publicly_available cannot be changed via this endpoint
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update template');
        }

        showSuccess('Template updated successfully!');
        handleCloseDialog();
        loadTemplates();
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to update template');
      }
    } else {
      // Create new template via API route (handles organization_id and package limits)
      try {
        const response = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description || null,
            is_public: formData.is_public,
            is_publicly_available: formData.is_publicly_available,
            category: formData.category || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to create template');
        }

        const newTemplate = await response.json();
        showSuccess('Template created! Now add phase data.');
        handleCloseDialog();
        router.push(`/templates/${newTemplate.id}/edit`);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create template';
        showError(errorMessage);
        logger.error('[Templates Page] Error creating template:', err);
      }
    }
  };

  const handleDelete = (templateId: string) => {
    setDeleteConfirm({ open: true, templateId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.templateId) return;

    try {
      const response = await fetch(`/api/templates/${deleteConfirm.templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      showSuccess('Template deleted successfully');
      // Reset to first page if current page would be empty
      if (templates.length === 1 && page > 1) {
        setPage(1);
      } else {
        loadTemplates();
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete template');
    }

    setDeleteConfirm({ open: false, templateId: null });
  };

  // Filter templates (sorting is handled by SortableTable)
  // Note: For now, filtering is done client-side on paginated results
  // In the future, this could be moved to server-side for better performance
  const filteredTemplates = templates.filter((template) => {
    // Search filter
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.category || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Public filter
    const matchesPublic = 
      publicFilter === 'all' || 
      (publicFilter === 'public' && template.is_public) ||
      (publicFilter === 'private' && !template.is_public);
    
    return matchesSearch && matchesPublic;
  });

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [searchTerm, publicFilter]);

  const handleDuplicate = async (template: ProjectTemplate) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.error || 'Failed to duplicate template');
        return;
      }

      showSuccess('Template duplicated successfully!');
      setPage(1);
      loadTemplates();
    } catch (error) {
      logger.error('Error duplicating template:', error);
      showError('Failed to duplicate template');
    }
  };

  // Check if organization has template access
  const hasTemplateAccess = features !== null && features !== undefined && features.max_templates !== undefined;
  // AI features: true means enabled, null also means enabled (unlimited)
  const hasAIFeatures = features?.ai_features_enabled === true || features?.ai_features_enabled === null;
  
  if (!hasTemplateAccess) {
    return null;
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: { xs: 2, md: 0 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              fontWeight: 600,
              color: theme.palette.text.primary,
            }}
          >
            Project Templates
          </Typography>
          {!loading && (
            <Chip
              label={total}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                fontWeight: 500,
                height: 24,
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: { xs: '100%', md: 'auto' } }}>
          {hasAIFeatures && (
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => router.push('/templates/generate')}
              fullWidth={false}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                fontWeight: 600,
                width: { xs: '100%', md: 'auto' },
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Generate with AI
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
            fullWidth={false}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              width: { xs: '100%', md: 'auto' },
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Create Template
          </Button>
        </Box>
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
        >
          {error}
        </Alert>
      )}

          {templates.length > 0 && (
            <Box
              sx={{
                p: { xs: 1.5, md: 2 },
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
                    placeholder="Search templates..."
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
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Visibility</InputLabel>
                    <Select
                      value={publicFilter}
                      onChange={(e) => setPublicFilter(e.target.value)}
                      label="Visibility"
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
                      <MenuItem value="all">All Templates</MenuItem>
                      <MenuItem value="public">Public Only</MenuItem>
                      <MenuItem value="private">Private Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          )}

          {templates.length === 0 ? (
            <EmptyState
              icon={<AddIcon sx={{ fontSize: 64 }} />}
              title="No templates yet"
              description="Create your first template to help users get started faster. Templates allow you to pre-fill phase data for common project types."
              actionLabel="Create Template"
              onAction={() => handleOpenDialog()}
            />
          ) : filteredTemplates.length === 0 ? (
            <EmptyState
              icon={<AddIcon sx={{ fontSize: 64 }} />}
              title="No templates found"
              description={searchTerm || publicFilter !== 'all' 
                ? "Try adjusting your search or filter criteria."
                : "Create your first template to help users get started faster. Templates allow you to pre-fill phase data for common project types."}
              actionLabel={searchTerm || publicFilter !== 'all' ? undefined : "Create Template"}
              onAction={searchTerm || publicFilter !== 'all' ? undefined : () => handleOpenDialog()}
            />
          ) : (
            <SortableTable
              data={filteredTemplates}
              columns={[
                {
                  key: 'name',
                  label: 'Template Name',
                  sortable: true,
                  render: (value, template) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                        {value}
                      </Typography>
                      {(template as any)?.is_publicly_available && (
                        <Chip
                          label="Global"
                          size="small"
                          sx={{
                            backgroundColor: theme.palette.info.main,
                            color: theme.palette.background.default,
                            fontWeight: 600,
                          }}
                          title="Global template - cannot be edited or deleted. Duplicate to create your own copy."
                        />
                      )}
                    </Box>
                  ),
                },
                {
                  key: 'category',
                  label: 'Category',
                  sortable: true,
                  render: (value) => {
                    if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
                    return (
                      <Chip
                        label={String(value)}
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
                  key: 'is_public',
                  label: 'Organization Visibility',
                  sortable: true,
                  render: (value) => (
                    <Chip
                      label={value ? 'Organization' : 'Private'}
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
                  key: 'is_publicly_available',
                  label: 'Publicly Available',
                  sortable: true,
                  render: (value) => (
                    <Chip
                      label={value ? 'Yes' : 'No'}
                      size="small"
                      sx={{
                        backgroundColor: value ? theme.palette.success.main : theme.palette.action.hover,
                        color: value ? theme.palette.background.default : theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                        fontWeight: 500,
                      }}
                    />
                  ),
                },
                {
                  key: 'usage_count',
                  label: 'Usage',
                  sortable: true,
                  render: (value, template) => {
                    // Get usage_count from the template object
                    // value comes from row[column.key], template is the full row object
                    const count = (template as any)?.usage_count ?? value ?? 0;
                    logger.debug('[TemplatesPage] Rendering usage count:', { templateId: (template as any)?.id, templateName: (template as any)?.name, value, count });
                    return (
                      <Chip
                        label={String(count)}
                        size="small"
                        sx={{
                          backgroundColor: theme.palette.action.hover,
                          color: theme.palette.text.primary,
                          border: `1px solid ${theme.palette.divider}`,
                          fontWeight: 600,
                          minWidth: '50px',
                        }}
                      />
                    );
                  },
                },
                {
                  key: 'created_at',
                  label: 'Created',
                  sortable: true,
                  render: (value) => {
                    if (!value) return <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>-</Typography>;
                    const date = new Date(value);
                    return (
                      <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                        {date.toLocaleDateString()}
                      </Typography>
                    );
                  },
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  align: 'right',
                  render: (_, template) => (
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (template.is_publicly_available) {
                            showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
                            return;
                          }
                          router.push(`/templates/${template.id}/builder`);
                        }}
                        disabled={template.is_publicly_available}
                        onMouseDown={(e) => {
                          if (template.is_publicly_available) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        sx={{
                          color: template.is_publicly_available ? theme.palette.text.disabled : theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: template.is_publicly_available ? 'transparent' : theme.palette.action.hover,
                          },
                        }}
                        title={template.is_publicly_available ? 'Cannot edit global templates. Duplicate to create your own copy.' : 'Build Template'}
                        aria-label={`Build template ${template.name}`}
                      >
                        <BuildIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (template.is_publicly_available) {
                            showError('Cannot edit global templates. Please duplicate the template to create your own copy.');
                            return;
                          }
                          router.push(`/templates/${template.id}/edit`);
                        }}
                        disabled={template.is_publicly_available}
                        onMouseDown={(e) => {
                          if (template.is_publicly_available) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        sx={{
                          color: template.is_publicly_available ? theme.palette.text.disabled : theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: template.is_publicly_available ? 'transparent' : theme.palette.action.hover,
                          },
                        }}
                        title={template.is_publicly_available ? 'Cannot edit global templates. Duplicate to create your own copy.' : 'Edit Template'}
                        aria-label={`Edit template ${template.name}`}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(template);
                        }}
                        sx={{
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                        title="Duplicate Template"
                        aria-label={`Duplicate template ${template.name}`}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      {/* PMs can only delete templates they created, and cannot delete global templates */}
                      {(role === 'admin' || (role === 'pm' && template.created_by === currentUserId)) && !template.is_publicly_available && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id);
                          }}
                          sx={{
                            color: theme.palette.error.main,
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                          title="Delete Template"
                          aria-label={`Delete template ${template.name}`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  ),
                },
              ]}
              onRowClick={(template) => {
                router.push(`/templates/${template.id}/builder`);
              }}
              emptyMessage="No templates found"
            />
          )}

          {/* Pagination */}
          {total > 10 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 3,
                pt: 3,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total}
                </Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel sx={{ color: theme.palette.text.secondary }}>Per Page</InputLabel>
                  <Select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    label="Per Page"
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
                    <MenuItem value={10}>10</MenuItem>
                    <MenuItem value={25}>25</MenuItem>
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={75}>75</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Pagination
                count={Math.ceil(total / pageSize)}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: theme.palette.text.primary,
                    '&.Mui-selected': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  },
                }}
              />
            </Box>
          )}

          {/* Create/Edit Dialog */}
          <Dialog
            open={openDialog}
            onClose={handleCloseDialog}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogContent>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                margin="normal"
                required
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={3}
                margin="normal"
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                margin="normal"
                placeholder="e.g., SaaS, E-commerce, Mobile App"
                sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_public}
                    onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Visible to all organization members"
                sx={{ color: theme.palette.text.secondary }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_publicly_available}
                    onChange={(e) => setFormData({ ...formData, is_publicly_available: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.text.primary,
                      },
                    }}
                  />
                }
                label="Available to public (outside organization)"
                sx={{ color: theme.palette.text.secondary }}
              />
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button 
                onClick={handleCloseDialog} 
                sx={{ 
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="outlined"
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
                {editingTemplate ? 'Update' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <ConfirmModal
            open={deleteConfirm.open}
            onClose={() => setDeleteConfirm({ open: false, templateId: null })}
            onConfirm={handleDeleteConfirm}
            title="Delete Template"
            message={`Are you sure you want to delete this template? This action cannot be undone and will permanently delete the template and all associated field configurations.`}
            confirmText="Delete"
            cancelText="Cancel"
            severity="error"
          />
    </Box>
  );
}

