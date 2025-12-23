'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Alert,
  Container,
  Skeleton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import ProjectContextNav from '@/components/project/ProjectContextNav';
import MediaLibrary from '@/components/project/MediaLibrary';
import type { Project, ProjectUploadWithUploader } from '@/types/project';

export default function UploadsPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { showError } = useNotification();
  const [project, setProject] = useState<Project | null>(null);
  const [uploads, setUploads] = useState<ProjectUploadWithUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to load project');
      }
      const projectData = await response.json();
      setProject(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setLoading(false);
    }
  }, [projectId]);

  const loadUploads = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/uploads`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load uploads');
      }
      const data = await response.json();
      setUploads(data.uploads || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load uploads');
      showError(err instanceof Error ? err.message : 'Failed to load uploads');
    } finally {
      setLoading(false);
    }
  }, [projectId, showError]);

  const loadTaskCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks?limit=1`);
      if (response.ok) {
        const data = await response.json();
        setTaskCount(data.total || 0);
      }
    } catch {
      // Ignore errors for task count
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadTaskCount();
  }, [loadProject, loadTaskCount]);

  useEffect(() => {
    if (project) {
      loadUploads();
    }
  }, [project, loadUploads]);

  const handleUploadsChange = () => {
    loadUploads();
  };

  if (loading && !project) {
    return (
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="xl" sx={{ pt: 4, pb: 4, px: { xs: 2, md: 3 } }}>
          <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
          <Skeleton variant="rectangular" height={200} sx={{ mb: 3, borderRadius: 2 }} />
          <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
        </Container>
      </Box>
    );
  }

  if (error && !project) {
    return (
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
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
        <Button
          onClick={() => router.push(`/project/${projectId}`)}
          startIcon={<ArrowBackIcon />}
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
          Back to Project
        </Button>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 6 }}>
        <Container maxWidth="xl" sx={{ pt: { xs: 2, md: 4 }, pb: 4, px: { xs: 2, md: 3 } }}>
          {/* Breadcrumbs */}
          <Box sx={{ mb: { xs: 2, md: 3 } }}>
            <Breadcrumbs
              items={[
                { label: project?.name || 'Project', href: `/project/${projectId}` },
                { label: 'Media Library' },
              ]}
            />
          </Box>

          {/* Project Context Navigation */}
          <Box sx={{ mb: { xs: 3, md: 4 } }}>
            <ProjectContextNav
              projectId={projectId}
              projectName={project?.name || 'Project'}
              activeView="uploads"
              taskCount={taskCount}
            />
          </Box>

          {/* Media Library Component */}
          <MediaLibrary
            projectId={projectId}
            uploads={uploads}
            loading={loading}
            onUploadsChange={handleUploadsChange}
          />
        </Container>
      </Box>
    </ErrorBoundary>
  );
}

