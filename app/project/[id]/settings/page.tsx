'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  CircularProgress,
  IconButton,
  Grid,
  Chip,
  Avatar,
  Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ArrowBack as ArrowBackIcon, Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Project, ProjectStatus, PrimaryTool, ProjectTemplate, UserRole } from '@/types/project';

interface ProjectMember {
  id: string;
  user_id: string;
  role: UserRole;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

export default function ProjectSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
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
  
  // Team members state
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('engineer');
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

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

  const loadMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      // Load project members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select(`
          id,
          user_id,
          role,
          user:users!project_members_user_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('project_id', projectId);

      if (membersError) {
        console.error('Error loading members:', membersError);
        return;
      }

      setMembers((membersData || []) as any);

      // Get current user's organization_id to filter users
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoadingMembers(false);
        return;
      }

      const { data: currentUser } = await supabase
        .from('users')
        .select('organization_id, role, is_super_admin')
        .eq('auth_id', session.user.id)
        .single();

      // Load users from the same organization (or all users if super admin)
      let usersQuery = supabase
        .from('users')
        .select('id, name, email, role')
        .order('name');

      // Filter by organization unless user is super admin
      if (currentUser && !(currentUser.role === 'admin' && currentUser.is_super_admin === true)) {
        if (currentUser.organization_id) {
          usersQuery = usersQuery.eq('organization_id', currentUser.organization_id);
        } else {
          // User has no organization, show no users
          setAvailableUsers([]);
          setLoadingMembers(false);
          return;
        }
      }

      const { data: usersData } = await usersQuery;

      if (usersData) {
        // Filter out users who are already members
        const memberUserIds = new Set(membersData?.map((m: any) => m.user_id) || []);
        setAvailableUsers(usersData.filter(u => !memberUserIds.has(u.id)) as User[]);
      }
    } catch (err) {
      console.error('Error loading members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [projectId, supabase]);

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
      
      // Load members after project loads
      loadMembers();
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, router, supabase, loadMembers]);

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

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        showError('Failed to add member: ' + (error.error || 'Unknown error'));
        return;
      }

      showSuccess('Member added successfully');
      setSelectedUserId('');
      setSelectedRole('engineer');
      // Reload members
      loadMembers();
    } catch (error) {
      showError('Failed to add member: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const { error: removeError } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberToRemove);

    if (removeError) {
      showError('Failed to remove member: ' + removeError.message);
      setShowRemoveConfirm(false);
      setMemberToRemove(null);
      return;
    }

    showSuccess('Member removed successfully');
    setShowRemoveConfirm(false);
    setMemberToRemove(null);
    // Reload members
    loadMembers();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error"
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, pt: 4, pb: 4 }}>
          <Breadcrumbs
            items={[
              { label: project?.name || 'Project', href: `/project/${projectId}` },
              { label: 'Settings' },
            ]}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <IconButton
              onClick={() => router.push(`/project/${projectId}`)}
              sx={{
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                flex: 1,
                fontWeight: 700,
                fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                color: theme.palette.text.primary,
              }}
            >
              Project Settings
            </Typography>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 3,
                  backgroundColor: theme.palette.background.paper,
                }}
              >
                {error && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 3,
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {error}
                  </Alert>
                )}
                <Box component="form">
                  <Grid container spacing={3}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Project Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
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
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
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
                    </Grid>
                    {templateId && originalTemplateId !== templateId && (
                      <Grid item xs={12}>
                        <Alert 
                          severity="warning"
                          sx={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            color: theme.palette.text.primary,
                          }}
                        >
                          <strong>Warning:</strong> Changing the template will completely overwrite your existing project phases and field data. You will need to start from scratch with the new template structure.
                        </Alert>
                      </Grid>
                    )}
                    <Grid item xs={12}>
                      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <Button
                          variant="outlined"
                          onClick={() => router.push(`/project/${projectId}`)}
                          sx={{
                            borderColor: theme.palette.divider,
                            color: theme.palette.text.secondary,
                            '&:hover': {
                              borderColor: theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
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
                            backgroundColor: theme.palette.text.primary,
                            color: theme.palette.background.default,
                            fontWeight: 600,
                            '&:hover': {
                              backgroundColor: theme.palette.text.secondary,
                            },
                            '&.Mui-disabled': {
                              backgroundColor: theme.palette.divider,
                              color: theme.palette.text.secondary,
                            },
                          }}
                        >
                          {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>
            
            {/* Team Members Section */}
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 3,
                  backgroundColor: theme.palette.background.paper,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    fontWeight: 600,
                    fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                    color: theme.palette.text.primary,
                  }}
                >
                  Team Members
                </Typography>

                {/* Existing Members */}
                {members.length > 0 && (
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        mb: 2,
                        color: theme.palette.text.secondary,
                        fontWeight: 500,
                      }}
                    >
                      Current Members ({members.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                      {members.map((member) => (
                        <Chip
                          key={member.id}
                          avatar={
                            <Avatar sx={{ bgcolor: theme.palette.action.hover, color: theme.palette.text.primary }}>
                              {member.user?.name?.charAt(0).toUpperCase() || member.user?.email?.charAt(0).toUpperCase() || '?'}
                            </Avatar>
                          }
                          label={
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
                                {member.user?.name || member.user?.email || 'Unknown'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, display: 'block' }}>
                                {member.role.toUpperCase()}
                              </Typography>
                            </Box>
                          }
                          onDelete={() => {
                            setMemberToRemove(member.id);
                            setShowRemoveConfirm(true);
                          }}
                          deleteIcon={<DeleteIcon />}
                          sx={{
                            backgroundColor: theme.palette.action.hover,
                            border: `1px solid ${theme.palette.divider}`,
                            height: 'auto',
                            py: 1,
                            '& .MuiChip-label': {
                              px: 1.5,
                            },
                            '& .MuiChip-deleteIcon': {
                              color: theme.palette.text.secondary,
                              '&:hover': {
                                color: theme.palette.text.primary,
                              },
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {members.length === 0 && (
                  <Alert
                    severity="info"
                    sx={{
                      mb: 3,
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      color: theme.palette.text.primary,
                    }}
                  >
                    No team members added yet. Add members below to collaborate on this project.
                  </Alert>
                )}

                <Divider sx={{ my: 3, borderColor: theme.palette.divider }} />

                {/* Add Member Form */}
                <Typography
                  variant="subtitle2"
                  sx={{
                    mb: 2,
                    fontWeight: 600,
                    color: theme.palette.text.primary,
                  }}
                >
                  Add Team Member
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>User</InputLabel>
                      <Select
                        value={selectedUserId}
                        label="User"
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        disabled={loadingMembers || availableUsers.length === 0}
                      >
                        {availableUsers.length === 0 ? (
                          <MenuItem disabled>No users available</MenuItem>
                        ) : (
                          availableUsers.map((user) => (
                            <MenuItem key={user.id} value={user.id}>
                              {user.name || user.email}
                              {user.name && user.email && ` (${user.email})`}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Role</InputLabel>
                      <Select
                        value={selectedRole}
                        label="Role"
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                      >
                        <MenuItem value="pm">Product Manager</MenuItem>
                        <MenuItem value="designer">Designer</MenuItem>
                        <MenuItem value="engineer">Engineer</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={2}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={handleAddMember}
                      disabled={!selectedUserId || loadingMembers}
                      fullWidth
                      sx={{
                        backgroundColor: theme.palette.text.primary,
                        color: theme.palette.background.default,
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: theme.palette.text.secondary,
                        },
                        '&.Mui-disabled': {
                          backgroundColor: theme.palette.divider,
                          color: theme.palette.text.secondary,
                        },
                      }}
                    >
                      Add
                    </Button>
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        </Box>
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
      <ConfirmModal
        open={showRemoveConfirm}
        onClose={() => {
          setShowRemoveConfirm(false);
          setMemberToRemove(null);
        }}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        message="Are you sure you want to remove this member from the project? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        severity="warning"
      />
    </>
  );
}

