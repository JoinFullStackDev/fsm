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
            fontWeight: 700,
            background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateProject}
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#00B2CC',
              boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
              transform: 'translateY(-2px)',
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
            backgroundColor: 'rgba(255, 23, 68, 0.1)',
            border: '1px solid rgba(255, 23, 68, 0.3)',
            color: '#FF1744',
          }}
        >
          {error}
        </Alert>
      )}

      {projects.length > 0 && (
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
                <InputLabel sx={{ color: '#B0B0B0' }}>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
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
                  color: '#B0B0B0',
                  textAlign: { xs: 'left', md: 'right' },
                }}
              >
                {filteredProjects.length} of {projects.length} projects
              </Typography>
            </Grid>
          </Grid>
        </Paper>
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
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#00E5FF' }}>
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
                    backgroundColor: 'rgba(0, 255, 136, 0.15)',
                    color: '#00FF88',
                    border: '1px solid rgba(0, 255, 136, 0.3)',
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
              key: 'updated_at',
              label: 'Last Updated',
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
                        color: '#FF1744',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 23, 68, 0.1)',
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
                      borderColor: '#00E5FF',
                      color: '#00E5FF',
                      '&:hover': {
                        borderColor: '#00E5FF',
                        backgroundColor: 'rgba(0, 229, 255, 0.1)',
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
            backgroundColor: '#121633',
            border: '1px solid rgba(255, 23, 68, 0.3)',
          },
        }}
      >
        <DialogTitle sx={{ color: '#FF1744', fontWeight: 600 }}>
          Delete Project
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#B0B0B0' }}>
            Are you sure you want to delete &quot;{projectToDelete?.name}&quot;? This action cannot be undone and will permanently delete the project and all associated data.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 23, 68, 0.2)' }}>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
            sx={{
              color: '#B0B0B0',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="contained"
            sx={{
              backgroundColor: '#FF1744',
              color: '#fff',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#D50000',
              },
              '&.Mui-disabled': {
                backgroundColor: 'rgba(255, 23, 68, 0.3)',
                color: 'rgba(255, 255, 255, 0.5)',
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

