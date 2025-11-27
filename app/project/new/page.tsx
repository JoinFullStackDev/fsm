'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
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
  Grid,
  Chip,
  OutlinedInput,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { getDefaultPhaseData } from '@/lib/phaseSchemas';
import { useNotification } from '@/components/providers/NotificationProvider';
import { validateProjectName } from '@/lib/utils/validation';
import type { ProjectStatus, PrimaryTool, ProjectTemplate } from '@/types/project';
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

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const { data, error: fetchError } = await supabase
      .from('project_templates')
      .select('*')
      .eq('is_public', true)
      .order('name', { ascending: true });

    if (!fetchError && data) {
      setTemplates(data);
    }
    setLoadingTemplates(false);
  }, [supabase]);

  const loadCompanies = useCallback(async () => {
    try {
      setLoadingCompanies(true);
      const response = await fetch('/api/ops/companies?limit=1000');
      if (response.ok) {
        const result = await response.json();
        // Handle paginated response format
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
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .order('name');

      if (!usersError && usersData) {
        setUsers(usersData);
      }
    } catch (err) {
      // Ignore errors, just show form without user selection
    } finally {
      setLoadingUsers(false);
    }
  }, [supabase]);

  // Load data on mount
  useEffect(() => {
    loadTemplates();
    loadCompanies();
    loadUsers();
  }, [loadTemplates, loadCompanies, loadUsers]);

  // Read query parameters and populate form fields
  useEffect(() => {
    const companyId = searchParams.get('company_id');
    const templateId = searchParams.get('template_id');

    if (companyId && companies.length > 0) {
      // Verify the company exists in the loaded list
      const companyExists = companies.some(c => c.id === companyId);
      if (companyExists) {
        setSelectedCompanyId(companyId);
      }
    }

    if (templateId && templates.length > 0) {
      // Verify the template exists in the loaded list
      const templateExists = templates.some(t => t.id === templateId);
      if (templateExists) {
        setSelectedTemplate(templateId);
      }
    }
  }, [searchParams, companies, templates]);

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

    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Get user record
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', session.user.id)
      .single();

    if (userError || !userData) {
      setError('Failed to load user data');
      setLoading(false);
      return;
    }

    // Create project
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .insert({
        owner_id: userData.id,
        name,
        description,
        status,
        primary_tool: primaryTool,
        template_id: selectedTemplate || null, // Set template_id if template was selected
        company_id: selectedCompanyId || null, // Set company_id if company was selected
        source: 'Manual', // Default for manually created projects
      })
      .select()
      .single();

    if (projectError || !projectData) {
      setError(projectError?.message || 'Failed to create project');
      setLoading(false);
      return;
    }

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
        templatePhases.forEach((templatePhase) => {
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

    const { error: phasesError } = await supabase
      .from('project_phases')
      .insert(phaseInserts);

    if (phasesError) {
      setError(phasesError.message);
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

    showSuccess('Project created successfully!');
    router.push(`/project/${projectData.id}`);
  };

  return (
    <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
            mb: 4,
          }}
        >
          Create New Project
        </Typography>

        <Paper
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            p: 4,
          }}
        >
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

          <Box component="form" onSubmit={handleSubmit}>
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

              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="outlined"
                    onClick={() => router.push('/dashboard')}
                    sx={{
                      borderColor: theme.palette.divider,
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.text.secondary,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{
                      backgroundColor: theme.palette.text.primary,
                      color: theme.palette.background.default,
                      fontWeight: 600,
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                        transform: 'translateY(-2px)',
                      },
                      '&:disabled': {
                        backgroundColor: theme.palette.action.disabledBackground,
                        color: theme.palette.action.disabled,
                      },
                    }}
                  >
                    {loading ? 'Creating...' : 'Create Project'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

