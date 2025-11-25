'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Alert,
} from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { getDefaultPhaseData } from '@/lib/phaseSchemas';
import { useNotification } from '@/components/providers/NotificationProvider';
import { validateProjectName } from '@/lib/utils/validation';
import type { ProjectStatus, PrimaryTool, ProjectTemplate } from '@/types/project';

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
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('idea');
  const [primaryTool, setPrimaryTool] = useState<PrimaryTool>('cursor');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
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

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

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

    router.push(`/project/${projectData.id}`);
  };

  return (
    <>
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Project
        </Typography>
        <Card>
          <CardContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={handleSubmit}>
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
                margin="normal"
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
              <TextField
                fullWidth
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={4}
                margin="normal"
              />
              <FormControl fullWidth margin="normal">
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
              <FormControl fullWidth margin="normal">
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
              <FormControl fullWidth margin="normal">
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
              {selectedTemplate && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  This project will be pre-filled with data from the selected template.
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/dashboard')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Project'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Container>
    </>
  );
}

