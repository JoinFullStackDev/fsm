'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Grid,
  Chip,
  OutlinedInput,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { getDefaultPhaseData } from '@/lib/phaseSchemas';
import { useNotification } from '@/components/providers/NotificationProvider';
import { validateProjectName } from '@/lib/utils/validation';
import { getCsrfHeaders } from '@/lib/utils/csrfClient';
import type { ProjectStatus, PrimaryTool, ProjectTemplate, Project } from '@/types/project';
import type { Company } from '@/types/ops';

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

const PHASE_NAMES = [
  'Concept Framing',
  'Product Strategy',
  'Rapid Prototype Definition',
  'Analysis & User Stories',
  'Build Accelerator',
  'QA & Hardening',
];

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  initialCompanyId?: string;
  initialTemplateId?: string;
}

export default function CreateProjectDialog({
  open,
  onClose,
  onSuccess,
  initialCompanyId,
  initialTemplateId,
}: CreateProjectDialogProps) {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('idea');
  const [primaryTool, setPrimaryTool] = useState<PrimaryTool>('cursor');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [packageLimits, setPackageLimits] = useState<{ current: number; limit: number | null; allowed: boolean } | null>(null);
  const [loadingLimits, setLoadingLimits] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const response = await fetch('/api/admin/templates?limit=100');
      if (response.ok) {
        const data = await response.json();
        const templatesData = data.data || [];
        setTemplates(templatesData);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const response = await fetch('/api/ops/companies?limit=1000');
      if (response.ok) {
        const result = await response.json();
        const companiesData = result.data || result;
        setCompanies(Array.isArray(companiesData) ? companiesData : []);
      }
    } catch (err) {
      // Ignore errors, just show form without company selection
    } finally {
      setLoadingCompanies(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/users');
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData || []);
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadPackageLimits = useCallback(async () => {
    try {
      setLoadingLimits(true);
      const response = await fetch('/api/organization/limits');
      if (response.ok) {
        const limits = await response.json();
        if (limits.projects) {
          setPackageLimits({
            current: limits.projects.current ?? 0,
            limit: limits.projects.limit ?? null,
            allowed: limits.projects.allowed ?? true,
          });
        } else {
          setPackageLimits({ current: 0, limit: null, allowed: true });
        }
      } else {
        setPackageLimits({ current: 0, limit: null, allowed: true });
      }
    } catch (err) {
      console.error('Error loading package limits:', err);
      setPackageLimits({ current: 0, limit: null, allowed: true });
    } finally {
      setLoadingLimits(false);
    }
  }, []);

  // Load data when modal opens
  useEffect(() => {
    if (open) {
      loadTemplates();
      loadCompanies();
      loadUsers();
      loadPackageLimits();
    }
  }, [open, loadTemplates, loadCompanies, loadUsers, loadPackageLimits]);

  // Set initial values from props
  useEffect(() => {
    if (open) {
      if (initialCompanyId && companies.length > 0) {
        const companyExists = companies.some(c => c.id === initialCompanyId);
        if (companyExists) {
          setSelectedCompanyId(initialCompanyId);
        }
      }
      if (initialTemplateId && templates.length > 0) {
        const templateExists = templates.some(t => t.id === initialTemplateId);
        if (templateExists) {
          setSelectedTemplate(initialTemplateId);
        }
      }
    }
  }, [open, initialCompanyId, initialTemplateId, companies, templates]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setStatus('idea');
      setPrimaryTool('cursor');
      setSelectedTemplate('');
      setSelectedCompanyId('');
      setSelectedMemberIds([]);
      setError(null);
      setValidationErrors({});
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    // Client-side validation
    const nameValidation = validateProjectName(name);
    if (!nameValidation.valid) {
      setValidationErrors({ name: nameValidation.error || 'Invalid project name' });
      return;
    }

    // Check package limits before submitting
    if (packageLimits && !packageLimits.allowed) {
      const limitText = packageLimits.limit === null ? 'unlimited' : packageLimits.limit.toString();
      setError(`Project limit reached. You have ${packageLimits.current} of ${limitText} projects. Please upgrade your plan to create more projects.`);
      return;
    }

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showError('You must be logged in to create a project');
      setLoading(false);
      return;
    }

    // Create project via API route (handles organization_id and package limits)
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: getCsrfHeaders(),
        body: JSON.stringify({
          name,
          description,
          status,
          primary_tool: primaryTool,
          company_id: selectedCompanyId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to create project');
      }

      const projectData = await response.json();

      // Create phase entries - use template data if selected, otherwise use defaults
      const phaseInserts = [];
      
      if (selectedTemplate) {
        // Load template phases (ordered by display_order, only active)
        const { data: templatePhases, error: templatePhasesError } = await supabase
          .from('template_phases')
          .select('*')
          .eq('template_id', selectedTemplate)
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (templatePhasesError) {
          setError('Failed to load template phases: ' + templatePhasesError.message);
          setLoading(false);
          return;
        }

        // Create phases from template (copying all metadata)
        if (templatePhases && templatePhases.length > 0) {
          templatePhases.forEach((templatePhase: any) => {
            phaseInserts.push({
              project_id: projectData.id,
              phase_number: templatePhase.phase_number,
              phase_name: templatePhase.phase_name,
              display_order: templatePhase.display_order,
              data: templatePhase.data || {},
              completed: false,
              is_active: true,
            });
          });
        } else {
          // Fallback: Create default 6 phases if template has none
          for (let i = 1; i <= 6; i++) {
            phaseInserts.push({
              project_id: projectData.id,
              phase_number: i,
              phase_name: PHASE_NAMES[i - 1] || `Phase ${i}`,
              display_order: i,
              data: getDefaultPhaseData(i),
              completed: false,
              is_active: true,
            });
          }
        }
      } else {
        // Create default phase entries (6 phases)
        for (let i = 1; i <= 6; i++) {
          phaseInserts.push({
            project_id: projectData.id,
            phase_number: i,
            phase_name: PHASE_NAMES[i - 1] || `Phase ${i}`,
            display_order: i,
            data: getDefaultPhaseData(i),
            completed: false,
            is_active: true,
          });
        }
      }

      // Use API route to create phases (bypasses RLS)
      const phasesResponse = await fetch(`/api/projects/${projectData.id}/phases/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getCsrfHeaders()),
        },
        body: JSON.stringify({ phases: phaseInserts }),
      });

      if (!phasesResponse.ok) {
        const errorData = await phasesResponse.json().catch(() => ({ error: 'Failed to create phases' }));
        setError(errorData.error || 'Failed to create phases');
        setLoading(false);
        return;
      }

      // Add project members if any were selected
      if (selectedMemberIds.length > 0) {
        // Use API route to add members (handles RLS and permissions)
        const memberPromises = selectedMemberIds.map((userId) =>
          fetch(`/api/projects/${projectData.id}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: userId,
              role: 'engineer',
            }),
          })
        );

        const results = await Promise.allSettled(memberPromises);
        const failures = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok));

        if (failures.length > 0) {
          console.error('Failed to add some project members:', failures);
          showError(`Project created but failed to add ${failures.length} member(s)`);
        }
      }

      // Refresh package limits after creating project
      await loadPackageLimits();

      showSuccess('Project created successfully!');
      onSuccess(projectData);
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create project';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
          Create New Project
        </Typography>
        <IconButton
          onClick={onClose}
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
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

        {packageLimits && !loadingLimits && (
          <Alert
            severity={packageLimits.allowed ? 'info' : 'warning'}
            sx={{
              mb: 3,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            {packageLimits.allowed ? (
              <>
                Project limit: {packageLimits.current} of {packageLimits.limit === null ? 'unlimited' : packageLimits.limit} projects used.
              </>
            ) : (
              <>
                Project limit reached: {packageLimits.current} of {packageLimits.limit} projects. Please upgrade your plan to create more projects.
              </>
            )}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} id="create-project-form">
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project Name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Clear validation error when user types
                  if (validationErrors.name) {
                    setValidationErrors({ ...validationErrors, name: '' });
                  }
                }}
                required
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={4}
                size="small"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={status}
                  label="Status"
                  onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                >
                  <MenuItem value="idea">Idea</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="blueprint_ready">Blueprint Ready</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Primary Tool</InputLabel>
                <Select
                  value={primaryTool}
                  label="Primary Tool"
                  onChange={(e) => setPrimaryTool(e.target.value as PrimaryTool)}
                >
                  <MenuItem value="cursor">Cursor</MenuItem>
                  <MenuItem value="replit">Replit</MenuItem>
                  <MenuItem value="lovable">Lovable</MenuItem>
                  <MenuItem value="base44">Base44</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Company (Optional)</InputLabel>
                <Select
                  value={selectedCompanyId}
                  label="Company (Optional)"
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  disabled={loading || loadingCompanies}
                >
                  <MenuItem value="">None</MenuItem>
                  {companies.map((company) => (
                    <MenuItem key={company.id} value={company.id}>
                      {company.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Start from Template (Optional)</InputLabel>
                <Select
                  value={selectedTemplate}
                  label="Start from Template (Optional)"
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  disabled={loadingTemplates}
                >
                  <MenuItem value="">None - Start from scratch</MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                      {template.category && ` (${template.category})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Project Members (Optional)</InputLabel>
                <Select
                  multiple
                  value={selectedMemberIds}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedMemberIds(typeof value === 'string' ? value.split(',') : value);
                  }}
                  input={<OutlinedInput label="Project Members (Optional)" />}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((userId) => {
                        const user = users.find(u => u.id === userId);
                        return (
                          <Chip
                            key={userId}
                            label={user ? `${user.name}${user.email ? ` (${user.email})` : ''}` : userId}
                            size="small"
                            sx={{
                              backgroundColor: theme.palette.action.hover,
                              color: theme.palette.text.primary,
                              border: `1px solid ${theme.palette.divider}`,
                            }}
                          />
                        );
                      })}
                    </Box>
                  )}
                  disabled={loading || loadingUsers}
                >
                  {users.map((user) => (
                    <MenuItem key={user.id} value={user.id}>
                      {user.name || user.email}
                      {user.name && user.email && ` (${user.email})`}
                      {user.role && (
                        <Chip
                          label={user.role}
                          size="small"
                          sx={{
                            ml: 1,
                            height: 20,
                            fontSize: '0.7rem',
                            backgroundColor: theme.palette.action.hover,
                            color: theme.palette.text.secondary,
                          }}
                        />
                      )}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {selectedTemplate && (
              <Grid item xs={12}>
                <Alert
                  severity="info"
                  sx={{
                    backgroundColor: theme.palette.action.hover,
                    border: `1px solid ${theme.palette.divider}`,
                    color: theme.palette.text.primary,
                  }}
                >
                  This project will be pre-filled with data from the selected template.
                </Alert>
              </Grid>
            )}
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button
          onClick={onClose}
          disabled={loading}
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
          type="submit"
          form="create-project-form"
          variant="contained"
          disabled={!!(loading || loadingLimits || (packageLimits && !(packageLimits.allowed ?? false)))}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            fontWeight: 600,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
            '&:disabled': {
              backgroundColor: theme.palette.action.disabledBackground,
              color: theme.palette.action.disabled,
            },
          }}
        >
          {loading ? 'Creating...' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

