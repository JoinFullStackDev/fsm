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
} from '@mui/material';
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
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import logger from '@/lib/utils/logger';
import type { ProjectTemplate } from '@/types/project';
import SortableTable from '@/components/dashboard/SortableTable';

export default function TemplatesPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { showSuccess, showError } = useNotification();
  const [templates, setTemplates] = useState<(ProjectTemplate & { usage_count?: number })[]>([]);
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
    is_public: false,
    category: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [publicFilter, setPublicFilter] = useState<string>('all');

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    
    // Load templates with usage counts
    const { data: templatesData, error: templatesError } = await supabase
      .from('project_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (templatesError) {
      setError(templatesError.message);
      showError('Failed to load templates');
      setLoading(false);
      return;
    }

    // Get usage counts for each template
    const templatesWithUsage = await Promise.all(
      (templatesData || []).map(async (template) => {
        const { count, error: countError } = await supabase
          .from('projects')
          .select('*', { count: 'exact', head: true })
          .eq('template_id', template.id);

        if (countError) {
          logger.error('Error counting template usage:', countError);
          return { ...template, usage_count: 0 };
        }

        const usageCount = count || 0;
        logger.debug('[TemplatesPage] Template usage count:', { templateId: template.id, templateName: template.name, usageCount });
        return { ...template, usage_count: usageCount };
      })
    );

    logger.debug('[TemplatesPage] Loaded templates with usage:', templatesWithUsage.map(t => ({ id: t.id, name: t.name, usage_count: (t as any).usage_count })));
    setTemplates(templatesWithUsage);
    setLoading(false);
  }, [supabase, showError]);

  useEffect(() => {
    logger.debug('[TemplatesPage] Role check:', { role, roleLoading });
    
    if (roleLoading) {
      logger.debug('[TemplatesPage] Still loading role, waiting...');
      return; // Wait for role to load
    }

    if (role !== 'admin') {
      logger.debug('[TemplatesPage] User is not admin, redirecting. Role:', role);
      router.push('/dashboard');
      return;
    }

    logger.debug('[TemplatesPage] User is admin, loading templates');
    loadTemplates();
  }, [role, roleLoading, router, loadTemplates]);

  const handleOpenDialog = (template?: ProjectTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        is_public: template.is_public,
        category: template.category || '',
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        is_public: false,
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
      category: '',
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showError('Template name is required');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (editingTemplate) {
      // Update existing template
      const { error: updateError } = await supabase
        .from('project_templates')
        .update({
          name: formData.name,
          description: formData.description || null,
          is_public: formData.is_public,
          category: formData.category || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTemplate.id);

      if (updateError) {
        showError('Failed to update template: ' + updateError.message);
      } else {
        showSuccess('Template updated successfully!');
        handleCloseDialog();
        loadTemplates();
      }
    } else {
      // Create new template
      const { data: newTemplate, error: createError } = await supabase
        .from('project_templates')
        .insert({
          name: formData.name,
          description: formData.description || null,
          created_by: userData?.id || null,
          is_public: formData.is_public,
          category: formData.category || null,
        })
        .select()
        .single();

      if (createError) {
        showError('Failed to create template: ' + createError.message);
      } else if (newTemplate) {
        showSuccess('Template created! Now add phase data.');
        handleCloseDialog();
        router.push(`/admin/templates/${newTemplate.id}/edit`);
      }
    }
  };

  const handleDelete = (templateId: string) => {
    setDeleteConfirm({ open: true, templateId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.templateId) return;

    try {
      const response = await fetch(`/api/admin/templates/${deleteConfirm.templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }

      showSuccess('Template deleted successfully');
      loadTemplates();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete template');
    }

    setDeleteConfirm({ open: false, templateId: null });
  };

  // Filter templates (sorting is handled by SortableTable)
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

  const handleDuplicate = async (template: ProjectTemplate) => {
    try {
      const response = await fetch(`/api/admin/templates/${template.id}/duplicate`, {
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
      loadTemplates();
    } catch (error) {
      logger.error('Error duplicating template:', error);
      showError('Failed to duplicate template');
    }
  };

  if (role !== 'admin') {
    return null;
  }

  if (loading) {
    return (
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: '#0A0E27', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Project Templates
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={() => router.push('/admin/templates/generate')}
                sx={{
                  borderColor: '#E91E63',
                  color: '#E91E63',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: '#C2185B',
                    backgroundColor: 'rgba(233, 30, 99, 0.1)',
                    boxShadow: '0 6px 25px rgba(233, 30, 99, 0.3)',
                  },
                }}
              >
                Generate with AI
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
                sx={{
                  backgroundColor: '#00E5FF',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#00B2CC',
                    boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
                  },
                }}
              >
                Create Template
              </Button>
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {templates.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 3,
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
                borderRadius: 2,
              }}
            >
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search templates..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#00E5FF' }} />
                        </InputAdornment>
                      ),
                    }}
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
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel sx={{ color: '#B0B0B0' }}>Visibility</InputLabel>
                    <Select
                      value={publicFilter}
                      onChange={(e) => setPublicFilter(e.target.value)}
                      label="Visibility"
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
                      <MenuItem value="all">All Templates</MenuItem>
                      <MenuItem value="public">Public Only</MenuItem>
                      <MenuItem value="private">Private Only</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#B0B0B0',
                      textAlign: { xs: 'left', md: 'right' },
                    }}
                  >
                    {filteredTemplates.length} of {templates.length} templates
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
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
                  render: (value) => (
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#00E5FF' }}>
                      {value}
                    </Typography>
                  ),
                },
                {
                  key: 'category',
                  label: 'Category',
                  sortable: true,
                  render: (value) => {
                    if (!value) return <Typography variant="body2" sx={{ color: '#B0B0B0' }}>-</Typography>;
                    return (
                      <Chip
                        label={String(value)}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(233, 30, 99, 0.15)',
                          color: '#E91E63',
                          border: '1px solid rgba(233, 30, 99, 0.3)',
                          fontWeight: 500,
                        }}
                      />
                    );
                  },
                },
                {
                  key: 'is_public',
                  label: 'Visibility',
                  sortable: true,
                  render: (value) => (
                    <Chip
                      label={value ? 'Public' : 'Private'}
                      size="small"
                      sx={{
                        backgroundColor: value ? 'rgba(0, 255, 136, 0.15)' : 'rgba(176, 176, 176, 0.15)',
                        color: value ? '#00FF88' : '#B0B0B0',
                        border: `1px solid ${value ? 'rgba(0, 255, 136, 0.3)' : 'rgba(176, 176, 176, 0.3)'}`,
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
                          backgroundColor: count > 0 ? 'rgba(0, 255, 136, 0.15)' : 'rgba(176, 176, 176, 0.15)',
                          color: count > 0 ? '#00FF88' : '#B0B0B0',
                          border: `1px solid ${count > 0 ? 'rgba(0, 255, 136, 0.3)' : 'rgba(176, 176, 176, 0.3)'}`,
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
                    if (!value) return <Typography variant="body2" sx={{ color: '#B0B0B0' }}>-</Typography>;
                    const date = new Date(value);
                    return (
                      <Typography variant="body2" sx={{ color: '#B0B0B0' }}>
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
                          router.push(`/admin/templates/${template.id}/builder`);
                        }}
                        sx={{
                          color: '#00E5FF',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          },
                        }}
                        title="Build Template"
                        aria-label={`Build template ${template.name}`}
                      >
                        <BuildIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/templates/${template.id}/edit`);
                        }}
                        sx={{
                          color: '#00E5FF',
                          '&:hover': {
                            backgroundColor: 'rgba(0, 229, 255, 0.1)',
                          },
                        }}
                        title="Edit Template"
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
                          color: '#9C27B0',
                          '&:hover': {
                            backgroundColor: 'rgba(156, 39, 176, 0.1)',
                          },
                        }}
                        title="Duplicate Template"
                        aria-label={`Duplicate template ${template.name}`}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(template.id);
                        }}
                        sx={{
                          color: '#FF1744',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 23, 68, 0.1)',
                          },
                        }}
                        title="Delete Template"
                        aria-label={`Delete template ${template.name}`}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ),
                },
              ]}
              onRowClick={(template) => {
                router.push(`/admin/templates/${template.id}/builder`);
              }}
              emptyMessage="No templates found"
            />
          )}

          {/* Create/Edit Dialog */}
          <Dialog
            open={openDialog}
            onClose={handleCloseDialog}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              sx: {
                backgroundColor: '#121633',
                border: '1px solid rgba(0, 229, 255, 0.2)',
              },
            }}
          >
            <DialogTitle sx={{ color: '#00E5FF', fontWeight: 600 }}>
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
                        color: '#00E5FF',
                      },
                    }}
                  />
                }
                label="Make template public (visible to all users)"
                sx={{ color: '#B0B0B0' }}
              />
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(0, 229, 255, 0.1)' }}>
              <Button onClick={handleCloseDialog} sx={{ color: '#B0B0B0' }}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                variant="contained"
                sx={{
                  backgroundColor: '#00E5FF',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#00B2CC',
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
        </Container>
      </Box>
    </>
  );
}

