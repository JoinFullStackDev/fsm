'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Project, ProjectStatus, PrimaryTool, ProjectTemplate } from '@/types/project';

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createSupabaseClient();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('idea');
  const [primaryTool, setPrimaryTool] = useState<PrimaryTool>('cursor');
  const [templateId, setTemplateId] = useState<string>('');
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [originalTemplateId, setOriginalTemplateId] = useState<string>('');

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      const { data, error: fetchError } = await supabase
        .from('project_templates')
        .select('*')
        .order('name', { ascending: true });

      if (!fetchError && data) {
        setTemplates(data);
      }
      setLoadingTemplates(false);
    };

    loadTemplates();
  }, [supabase]);

  useEffect(() => {
    const loadProject = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        setError(projectError?.message || 'Project not found');
        setLoading(false);
        return;
      }

      setProject(projectData);
      setName(projectData.name);
      setDescription(projectData.description || '');
      setStatus(projectData.status);
      setPrimaryTool(projectData.primary_tool || 'cursor');
      const currentTemplateId = (projectData as any).template_id || '';
      setTemplateId(currentTemplateId);
      setOriginalTemplateId(currentTemplateId);
      setLoading(false);
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, router, supabase]);

  const handleSave = async () => {
    // Check if template changed
    const templateChanged = originalTemplateId !== (templateId || '');
    
    if (templateChanged && templateId) {
      // Show confirmation dialog
      setShowTemplateConfirm(true);
      return;
    }

    // No template change, proceed with save
    await performSave();
  };

  const performSave = async () => {
    setSaving(true);
    setError(null);
    setShowTemplateConfirm(false);

    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        status,
        primary_tool: primaryTool,
        template_id: templateId || null,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to update project');
      setSaving(false);
      return;
    }

    const updatedProject = await response.json();
    setProject(updatedProject);
    setOriginalTemplateId(templateId || '');
    setSaving(false);
    
    // Show success message if template was changed
    const templateChanged = originalTemplateId !== (templateId || '');
    if (templateChanged && templateId) {
      const selectedTemplate = templates.find(t => t.id === templateId);
      if (selectedTemplate) {
        // Store success message in sessionStorage to show after redirect
        sessionStorage.setItem('templateChangeSuccess', `Template changed to "${selectedTemplate.name}". Project phases have been regenerated from the new template.`);
        // Store a refresh flag to force reload
        sessionStorage.setItem('projectRefreshNeeded', 'true');
      }
    }
    
    // Refresh router to ensure data is reloaded, then navigate
    router.refresh();
    router.push(`/project/${projectId}`);
  };

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

  if (error && !project) {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            {error}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: 'background.default', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="md" sx={{ pt: 4, pb: 4 }}>
          <Breadcrumbs
            items={[
              { label: project?.name || 'Project', href: `/project/${projectId}` },
              { label: 'Settings' },
            ]}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push(`/project/${projectId}`)}
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.light',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              Back to Project
            </Button>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                flex: 1,
                fontWeight: 700,
                background: '#00E5FF',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Project Settings
            </Typography>
          </Box>
          <Card
            sx={{
              border: '2px solid',
              borderColor: 'primary.main',
              backgroundColor: 'background.paper',
            }}
          >
            <CardContent>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form">
              <TextField
                fullWidth
                label="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                margin="normal"
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
                <InputLabel>Template</InputLabel>
                <Select
                  value={templateId}
                  label="Template"
                  onChange={(e) => setTemplateId(e.target.value)}
                  disabled={loadingTemplates}
                >
                  <MenuItem value="">None - Use default template</MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                      {template.category && ` (${template.category})`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {templateId && originalTemplateId !== templateId && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  <strong>Warning:</strong> Changing the template will completely overwrite your existing project phases and field data. You will need to start from scratch with the new template structure.
                </Alert>
              )}
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => router.push(`/project/${projectId}`)}
                  sx={{
                    borderColor: 'text.secondary',
                    color: 'text.secondary',
                    '&:hover': {
                      borderColor: 'text.primary',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                  sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': {
                      backgroundColor: 'primary.dark',
                    },
                  }}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
        </Container>
      </Box>
      <ConfirmModal
        open={showTemplateConfirm}
        onClose={() => setShowTemplateConfirm(false)}
        onConfirm={performSave}
        title="Confirm Template Change"
        message={
          <>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Changing the template will <strong>completely overwrite</strong> your existing project phases and all field data.
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              This action cannot be undone. You will need to start from scratch with the new template structure.
            </Typography>
            <Typography variant="body2">
              Are you sure you want to proceed?
            </Typography>
          </>
        }
        confirmText="Yes, Change Template"
        cancelText="Cancel"
        severity="error"
      />
    </>
  );
}

