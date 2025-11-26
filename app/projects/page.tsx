'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Chip,
  Alert,
  Skeleton,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Add as AddIcon, Search as SearchIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FolderOpen as FolderIcon } from '@mui/icons-material';
import { useRole } from '@/lib/hooks/useRole';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Project } from '@/types/project';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton,
} from '@mui/material';
import SortableTable from '@/components/dashboard/SortableTable';

export default function ProjectsPage() {
  const theme = useTheme();
  const router = useRouter();
  const supabase = createSupabaseClient();
  const { role, loading: roleLoading } = useRole();
  const { showSuccess, showError } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      // Wait a bit for session to be fully established
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try multiple times to get session (in case of timing issues)
      let session = null;
      let attempts = 0;
      while (!session && attempts < 5) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        session = data.session;
        
        if (!session && attempts < 4) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        attempts++;
      }

      if (!session) {
        setError('Session not found. Please try signing in again.');
        setLoading(false);
        return;
      }

      // Get user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('auth_id', session.user.id)
        .single();

      if (userError || !userData) {
        setError('Failed to load user data');
        setLoading(false);
        return;
      }

      let allProjects: Project[] = [];

      // If user is admin, load all projects
      if (userData.role === 'admin') {
        const { data: allProjectsData, error: allProjectsError } = await supabase
          .from('projects')
          .select('*')
          .order('updated_at', { ascending: false });

        if (allProjectsError) {
          setError(allProjectsError.message || 'Failed to load projects');
          setLoading(false);
          return;
        }

        allProjects = (allProjectsData || []) as Project[];
      } else {
        // Get projects where user is owner
        const { data: ownedProjects, error: ownedError } = await supabase
          .from('projects')
          .select('*')
          .eq('owner_id', userData.id)
          .order('updated_at', { ascending: false });

        // Get projects where user is a member
        const { data: memberProjects, error: memberError } = await supabase
          .from('project_members')
          .select('project_id, projects(*)')
          .eq('user_id', userData.id);

        if (ownedError || memberError) {
          setError(ownedError?.message || memberError?.message || 'Failed to load projects');
          setLoading(false);
          return;
        }

        // Combine owned projects and member projects
        const owned = ownedProjects || [];
        const member = (memberProjects || []).map((mp: any) => mp.projects).filter(Boolean);
        allProjects = [...owned, ...member];
        
        // Remove duplicates
        allProjects = Array.from(
          new Map(allProjects.map((p: any) => [p.id, p])).values()
        ) as Project[];
      }
      
      setProjects(allProjects);
      setLoading(false);
    };

    // Only load projects if role is loaded (or if we're not using role-based filtering)
    if (!roleLoading) {
      loadProjects();
    }
  }, [router, supabase, roleLoading]);

  const handleCreateProject = () => {
    router.push('/project/new');
  };

  const handleDeleteClick = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project');
      }

      showSuccess('Project deleted successfully');
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      
      // Remove from local state
      setProjects(projects.filter(p => p.id !== projectToDelete.id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      showError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setProjectToDelete(null);
  };

  // Filter projects (sorting is handled by SortableTable)
  const filteredProjects = projects.filter((project) => {
    // Search filter
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Skeleton variant="text" width="200px" height={48} />
          <Skeleton variant="rectangular" width={150} height={40} sx={{ borderRadius: 1 }} />
        </Box>
        <LoadingSkeleton variant="dashboard" count={6} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.5rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Projects
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleCreateProject}
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
          Create Project
        </Button>
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

      {projects.length > 0 && (
        <Box
          sx={{
            p: 2,
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
                placeholder="Search projects..."
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
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                    '& .MuiSvgIcon-root': {
                      color: theme.palette.text.primary,
                    },
                  }}
                >
                  <MenuItem value="all">All Statuses</MenuItem>
                  <MenuItem value="idea">Idea</MenuItem>
                  <MenuItem value="in_progress">In Progress</MenuItem>
                  <MenuItem value="blueprint_ready">Blueprint Ready</MenuItem>
                  <MenuItem value="archived">Archived</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  textAlign: { xs: 'left', md: 'right' },
                }}
              >
                {filteredProjects.length} of {projects.length} projects
              </Typography>
            </Grid>
          </Grid>
        </Box>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon sx={{ fontSize: 64 }} />}
          title="No projects yet"
          description="Get started by creating your first project and begin applying The FullStack Method™ to build your product."
          actionLabel="Create Project"
          onAction={handleCreateProject}
        />
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon sx={{ fontSize: 64 }} />}
          title="No projects found"
          description={searchTerm || statusFilter !== 'all' 
            ? "Try adjusting your search or filter criteria."
            : "Get started by creating your first project and begin applying The FullStack Method™ to build your product."}
          actionLabel={searchTerm || statusFilter !== 'all' ? undefined : "Create Project"}
          onAction={searchTerm || statusFilter !== 'all' ? undefined : handleCreateProject}
        />
      ) : (
        <SortableTable
          data={filteredProjects}
          columns={[
            {
              key: 'name',
              label: 'Project Name',
              sortable: true,
              render: (value) => (
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                  {value}
                </Typography>
              ),
            },
            {
              key: 'status',
              label: 'Status',
              sortable: true,
              render: (value) => (
                <Chip
                  label={String(value).replace('_', ' ')}
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
              key: 'primary_tool',
              label: 'Primary Tool',
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
              key: 'updated_at',
              label: 'Last Updated',
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
              render: (_, project) => (
                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                  {role === 'admin' && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(project);
                      }}
                      sx={{
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                      title="Delete project"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/project/${project.id}`);
                    }}
                    variant="outlined"
                    sx={{
                      borderColor: theme.palette.text.primary,
                      color: theme.palette.text.primary,
                      '&:hover': {
                        borderColor: theme.palette.text.primary,
                        backgroundColor: theme.palette.action.hover,
                      },
                    }}
                  >
                    Open
                  </Button>
                </Box>
              ),
            },
          ]}
          onRowClick={(project) => {
            router.push(`/project/${project.id}`);
          }}
          emptyMessage="No projects found"
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
          Delete Project
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.text.secondary }}>
            Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action cannot be undone and will permanently delete the project and all associated data.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
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
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="outlined"
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontWeight: 600,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
              },
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

