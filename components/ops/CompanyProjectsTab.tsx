'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { OpenInNew as OpenIcon, Delete as DeleteIcon, Folder as FolderIcon } from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { Project } from '@/types/project';
import SortableTable from '@/components/dashboard/SortableTable';
import EmptyState from '@/components/ui/EmptyState';
import { getCsrfToken } from '@/lib/utils/csrfClient';

interface CompanyProjectsTabProps {
  companyId: string;
}

export default function CompanyProjectsTab({ companyId }: CompanyProjectsTabProps) {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/projects?company_id=${companyId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to load projects' }));
        throw new Error(errorData.error || `Failed to load projects: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      // Ensure we always set an array, even if result.data is not an array
      setProjects(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load projects';
      setError(errorMessage);
      showError(errorMessage);
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  }, [companyId, showError]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleOpenProject = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/project/${project.id}`);
  };

  const handleDeleteProject = async (project: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${project.name}"?`)) {
      return;
    }

    try {
      const csrfToken = getCsrfToken();
      const headers: HeadersInit = {};
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete project');
      }

      showSuccess('Project deleted successfully');
      loadProjects();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      showError(errorMessage);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idea':
        return 'default';
      case 'in_progress':
        return 'primary';
      case 'blueprint_ready':
        return 'success';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Project Name',
      sortable: true,
    },
    {
      key: 'company',
      label: 'Company',
      sortable: false,
      render: (value: any) => value?.name || '-',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value: string) => (
        <Chip
          label={value.replace(/_/g, ' ')}
          color={getStatusColor(value) as any}
          size="small"
        />
      ),
    },
    {
      key: 'source',
      label: 'Source',
      sortable: true,
      render: (value: string | null) => (
        <Chip
          label={value || 'Manual'}
          size="small"
          variant="outlined"
          color={value === 'Converted' ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: any, row: Project) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleOpenProject(row, e)}
            sx={{ color: theme.palette.text.primary }}
          >
            <OpenIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteProject(row, e)}
            sx={{ color: theme.palette.text.primary }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
          }}
        >
          Projects
        </Typography>
      </Box>

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon sx={{ fontSize: 64 }} />}
          title="No projects yet"
          description="Projects are created by converting opportunities."
        />
      ) : (
        <SortableTable
          data={projects}
          columns={columns}
          emptyMessage="No projects found"
        />
      )}
    </Box>
  );
}

