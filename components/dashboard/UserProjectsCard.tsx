'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardActionArea,
  Chip,
  Button,
  Skeleton,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import type { Project } from '@/types/project';

interface UserProjectsCardProps {
  initialProjects?: Project[];
}

/**
 * UserProjectsCard Component
 * Displays a grid of projects the user is involved with
 */
export default function UserProjectsCard({ initialProjects }: UserProjectsCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>(initialProjects || []);
  const [loading, setLoading] = useState(!initialProjects);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProjects) return;

    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/projects?limit=8');
        if (response.ok) {
          const data = await response.json();
          setProjects(data.data || []);
        } else {
          setError('Failed to load projects');
        }
      } catch (err) {
        setError('Failed to load projects');
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [initialProjects]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress':
        return { bg: theme.palette.info.main + '20', color: theme.palette.info.main };
      case 'blueprint_ready':
        return { bg: theme.palette.success.main + '20', color: theme.palette.success.main };
      case 'archived':
        return { bg: theme.palette.text.disabled + '20', color: theme.palette.text.disabled };
      default:
        return { bg: theme.palette.warning.main + '20', color: theme.palette.warning.main };
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (loading) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Skeleton variant="text" width={120} height={32} />
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} key={i}>
              <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          height: '100%',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Paper>
    );
  }

  return (
    <Paper
      sx={{
        p: 3,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          My Projects
        </Typography>
        <Button
          size="small"
          onClick={() => router.push('/projects')}
          sx={{ color: theme.palette.text.secondary }}
        >
          View All
        </Button>
      </Box>

      {projects.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No projects yet. Create your first project to get started!
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {projects.slice(0, 6).map((project) => {
            const statusStyle = getStatusColor(project.status);
            return (
              <Grid item xs={12} sm={6} key={project.id}>
                <Card
                  sx={{
                    backgroundColor: theme.palette.background.default,
                    border: `1px solid ${theme.palette.divider}`,
                    '&:hover': {
                      borderColor: theme.palette.text.primary,
                    },
                  }}
                >
                  <CardActionArea
                    onClick={() => router.push(`/project/${project.id}`)}
                    sx={{ p: 2 }}
                  >
                    <Typography
                      variant="subtitle2"
                      sx={{
                        fontWeight: 600,
                        color: theme.palette.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 1,
                      }}
                    >
                      {project.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Chip
                        label={formatStatus(project.status)}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          backgroundColor: statusStyle.bg,
                          color: statusStyle.color,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {project.updated_at
                          ? format(new Date(project.updated_at), 'MMM d')
                          : 'No updates'}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Paper>
  );
}

