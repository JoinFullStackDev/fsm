'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  History as HistoryIcon,
  Assignment as AssignmentIcon,
  Delete as DeleteIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { LinearProgress } from '@mui/material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { generateCursorMasterPrompt } from '@/lib/exportHandlers/cursorBundle';
import { calculatePhaseProgress } from '@/lib/phases/calculatePhaseProgress';
import { useRole } from '@/lib/hooks/useRole';
import type { Project, PhaseSummary } from '@/types/project';

const PHASE_NAMES = [
  'Concept Framing',
  'Product Strategy',
  'Rapid Prototype Definition',
  'Analysis & User Stories',
  'Build Accelerator',
  'QA & Hardening',
];

export default function ProjectPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { role, loading: roleLoading } = useRole();
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<PhaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [cursorPrompt, setCursorPrompt] = useState<string | null>(null);
  const [showCursorDialog, setShowCursorDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBlueprintWarning, setShowBlueprintWarning] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth/signin');
        return;
      }

      // Check for template change success message
      const templateChangeSuccess = sessionStorage.getItem('templateChangeSuccess');
      const refreshNeeded = sessionStorage.getItem('projectRefreshNeeded');
      
      if (templateChangeSuccess) {
        sessionStorage.removeItem('templateChangeSuccess');
        showSuccess(templateChangeSuccess);
      }
      
      if (refreshNeeded) {
        sessionStorage.removeItem('projectRefreshNeeded');
        // Small delay to ensure database changes are committed
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Load project
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

      // Load phases with data for progress calculation (ordered by display_order)
      // Add a small retry mechanism if refresh was needed
      let phasesData = null;
      let phasesError = null;
      let attempts = refreshNeeded ? 3 : 1;
      
      for (let i = 0; i < attempts; i++) {
        const result = await supabase
          .from('project_phases')
          .select('phase_number, phase_name, display_order, completed, updated_at, data')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('display_order', { ascending: true });
        
        phasesData = result.data;
        phasesError = result.error;
        
        if (!phasesError && phasesData && phasesData.length > 0) {
          break; // Success, exit retry loop
        }
        
        if (i < attempts - 1) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (phasesError) {
        console.error('Error loading phases:', phasesError);
        setError(phasesError.message);
      } else {
        console.log('Loaded phases:', phasesData?.length || 0, 'phases');
        setPhases(phasesData || []);
        if (refreshNeeded && (!phasesData || phasesData.length === 0)) {
          console.warn('No phases found after template change');
          setError('Phases were not found after template change. Please refresh the page.');
        }
      }
      setLoading(false);
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId, router, supabase, showSuccess]);

  const handleExportBlueprint = async () => {
    // Check if all phases are completed
    const allPhasesCompleted = phases.length > 0 && phases.every(p => p.completed);
    
    if (!allPhasesCompleted) {
      setShowBlueprintWarning(true);
      return;
    }
    
    await performBlueprintExport();
  };

  const performBlueprintExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/export/blueprint`, {
        method: 'POST',
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const contentDisposition = response.headers.get('Content-Disposition');
        const filename = contentDisposition
          ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
          : `blueprint-bundle-${projectId}.zip`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showSuccess('Blueprint bundle exported successfully!');
      } else {
        const data = await response.json();
        showError('Export failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      showError('Export failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const handleGenerateCursorPrompt = async () => {
    setExporting(true);
    try {
      // Fetch the cursor prompt text
      const response = await fetch(`/api/projects/${projectId}/export/cursor`, {
        method: 'POST',
      });
      
      if (response.ok || true) {
        // Generate it client-side from the project data
        // Get all phases
        const { data: phasesData } = await supabase
          .from('project_phases')
          .select('*')
          .eq('project_id', projectId)
          .order('phase_number', { ascending: true });

        const phaseMap: Record<number, any> = {};
        phasesData?.forEach((phase) => {
          phaseMap[phase.phase_number] = phase.data;
        });

        const prompt = generateCursorMasterPrompt(project!, {
          phase1: phaseMap[1],
          phase2: phaseMap[2],
          phase3: phaseMap[3],
          phase4: phaseMap[4],
          phase5: phaseMap[5],
          phase6: phaseMap[6],
        });

        setCursorPrompt(prompt);
        setShowCursorDialog(true);
        showSuccess('Cursor prompt generated!');
      } else {
        const data = await response.json();
        showError('Failed to generate prompt: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      showError('Failed to generate prompt: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };


  const handleCopyCursorPrompt = async () => {
    if (cursorPrompt) {
      try {
        await navigator.clipboard.writeText(cursorPrompt);
        setCopied(true);
        showSuccess('Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        showError('Failed to copy to clipboard. Please try again.');
        console.error('Copy failed:', err);
      }
    }
  };

  const handleDownloadCursorPrompt = () => {
    if (cursorPrompt) {
      const blob = new Blob([cursorPrompt], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cursor_master_prompt.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!project) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project');
      }

      showSuccess('Project deleted successfully');
      setDeleteDialogOpen(false);
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete project';
      showError(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleProjectManagement = async () => {
    // Check if project is already initiated
    if (project?.initiated_at) {
      // Navigate to project management page
      router.push(`/project-management/${projectId}`);
      return;
    }

    // Initiate the project by triggering analysis
    setInitiating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate project');
      }

      const result = await response.json();
      showSuccess('Project initiated successfully! Generating tasks...');
      
      // Refresh project data to update initiated_at
      const { data: updatedProject, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (!projectError && updatedProject) {
        setProject(updatedProject);
      }
      
      // Navigate to project management page after a short delay
      setTimeout(() => {
        router.push(`/project-management/${projectId}`);
      }, 1000);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to initiate project');
    } finally {
      setInitiating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'blueprint_ready':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'archived':
        return 'default';
      default:
        return 'warning';
    }
  };

  if (loading) {
    return (
      <>
        <Box sx={{ backgroundColor: '#000', minHeight: '100vh', pb: 4 }}>
          <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
            <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
            <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
            <LoadingSkeleton variant="card" count={6} />
          </Container>
        </Box>
      </>
    );
  }

  if (error || !project) {
    return (
      <>
        <Container>
          <Alert severity="error" sx={{ mt: 4 }}>
            {error || 'Project not found'}
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ backgroundColor: '#000', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
          <Breadcrumbs items={[{ label: project.name }]} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography
                variant="h3"
                component="h1"
                sx={{
                  fontWeight: 700,
                  background: '#00E5FF',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                }}
              >
                {project.name}
              </Typography>
              <Typography variant="body1" sx={{ color: '#B0B0B0', mt: 1 }}>
                {project.description || 'No description'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={project.status.replace('_', ' ')}
                sx={{
                  backgroundColor: 'rgba(0, 255, 136, 0.15)',
                  color: '#00FF88',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  fontWeight: 500,
                }}
              />
              {project.primary_tool && (
                <Chip
                  label={project.primary_tool}
                  sx={{
                    backgroundColor: 'rgba(233, 30, 99, 0.15)',
                    color: '#E91E63',
                    border: '1px solid rgba(233, 30, 99, 0.3)',
                    fontWeight: 500,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Phase Progress Indicator */}
          {(() => {
            const completedPhases = phases.filter((p) => p.completed).length;
            const totalPhases = phases.length || 6; // Use actual phase count, fallback to 6 for backward compatibility
            const progressPercentage = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;
            
            return (
              <Card
                sx={{
                  backgroundColor: '#000',
                  border: '2px solid rgba(0, 229, 255, 0.2)',
                  borderRadius: 3,
                  mb: 3,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography
                      variant="h6"
                      sx={{ color: 'primary.main', fontWeight: 600 }}
                    >
                      Project Progress
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{
                        color: '#00E5FF',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                      }}
                    >
                      {completedPhases} of {totalPhases} phases complete
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progressPercentage}
                    sx={{
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: 'rgba(0, 229, 255, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 5,
                        background: 'linear-gradient(90deg, #00E5FF 0%, #00FF88 100%)',
                      },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: '#B0B0B0',
                      mt: 1,
                      textAlign: 'right',
                    }}
                  >
                    {Math.round(progressPercentage)}% complete
                  </Typography>
                </CardContent>
              </Card>
            );
          })()}

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Card
                sx={{
                  backgroundColor: '#000',
                  border: '2px solid rgba(0, 229, 255, 0.2)',
                  borderRadius: 3,
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: 'primary.main', fontWeight: 600, mb: 3 }}
                  >
                    Phases
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {phases.map((phase) => {
                      const phaseNumber = phase.phase_number;
                      const phaseName = phase.phase_name || `Phase ${phaseNumber}`;
                      const completed = phase.completed || false;
                      const progress = calculatePhaseProgress(phaseNumber, phase.data || null);
                      const hasStarted = progress > 0;
                      
                      return (
                        <Card
                          key={phaseNumber}
                          onClick={() => router.push(`/project/${projectId}/phase/${phaseNumber}`)}
                          sx={{
                            border: '2px solid',
                            borderColor: completed ? 'success.main' : 'primary.main',
                            backgroundColor: completed ? 'rgba(0, 255, 136, 0.05)' : 'background.paper',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            position: 'relative',
                            overflow: 'visible',
                            '&:hover': {
                              transform: 'translateY(-4px)',
                              boxShadow: completed 
                                ? '0 8px 30px rgba(0, 255, 136, 0.3)'
                                : '0 8px 30px rgba(0, 229, 255, 0.3)',
                              borderColor: completed ? 'success.light' : 'primary.light',
                            },
                          }}
                        >
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box>
                                <Chip
                                  label={phaseName}
                                  size="small"
                                  sx={{
                                    backgroundColor: completed 
                                      ? 'rgba(0, 255, 136, 0.1)' 
                                      : 'rgba(0, 229, 255, 0.1)',
                                    color: completed ? 'success.main' : 'primary.main',
                                    border: '1px solid',
                                    borderColor: completed ? 'success.main' : 'primary.main',
                                    fontWeight: 600,
                                    mb: 1,
                                  }}
                                />
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 600,
                                    color: completed ? 'success.main' : 'text.primary',
                                    mt: 1,
                                  }}
                                >
                                  {phaseName}
                                </Typography>
                              </Box>
                              {completed && (
                                <CheckCircleIcon
                                  sx={{
                                    color: 'success.main',
                                    fontSize: 28,
                                  }}
                                />
                              )}
                            </Box>
                            
                            {/* Progress Bar */}
                            <Box sx={{ mt: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography
                                  variant="body2"
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                  }}
                                >
                                  {completed 
                                    ? 'Completed' 
                                    : hasStarted 
                                      ? `In Progress - ${progress}%` 
                                      : 'Not Started'}
                                </Typography>
                                {!completed && hasStarted && (
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: 'primary.main',
                                      fontSize: '0.875rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {progress}%
                                  </Typography>
                                )}
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={completed ? 100 : progress}
                                sx={{
                                  height: 8,
                                  borderRadius: 4,
                                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: completed ? 'success.main' : 'primary.main',
                                    borderRadius: 4,
                                    boxShadow: completed 
                                      ? '0 0 10px rgba(0, 255, 136, 0.5)'
                                      : '0 0 10px rgba(0, 229, 255, 0.5)',
                                  },
                                }}
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card
                sx={{
                  backgroundColor: '#000',
                  border: '2px solid rgba(0, 229, 255, 0.2)',
                  borderRadius: 3,
                }}
              >
                <CardContent>
                  <Typography
                    variant="h6"
                    gutterBottom
                    sx={{ color: '#00E5FF', fontWeight: 600 }}
                  >
                    Actions
                  </Typography>
                  <Divider sx={{ mb: 2, borderColor: 'rgba(0, 229, 255, 0.2)' }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportBlueprint}
                      disabled={exporting}
                      fullWidth
                      sx={{
                        backgroundColor: '#00E5FF',
                        color: '#000',
                        fontWeight: 600,
                        '&:hover': {
                          backgroundColor: '#00B2CC',
                          boxShadow: '0 6px 25px rgba(0, 229, 255, 0.5)',
                        },
                      }}
                    >
                      {exporting ? 'Exporting...' : 'Export Blueprint'}
                    </Button>
                    {(() => {
                      const phase1 = phases.find((p) => p.phase_number === 1);
                      const phase2 = phases.find((p) => p.phase_number === 2);
                      const phase3 = phases.find((p) => p.phase_number === 3);
                      const canCreateBundle = phase1?.completed && phase2?.completed && phase3?.completed;
                      const missingPhases = [];
                      if (!phase1?.completed) missingPhases.push('Concept Framing');
                      if (!phase2?.completed) missingPhases.push('Product Strategy');
                      if (!phase3?.completed) missingPhases.push('Rapid Prototype Definition');
                      
                      const button = (
                        <Button
                          variant="outlined"
                          startIcon={<ContentCopyIcon />}
                          onClick={handleGenerateCursorPrompt}
                          disabled={exporting || !project || !canCreateBundle}
                          fullWidth
                          sx={{
                            borderColor: '#E91E63',
                            color: '#E91E63',
                            '&:hover': {
                              borderColor: canCreateBundle ? '#E91E63' : 'rgba(233, 30, 99, 0.3)',
                              backgroundColor: canCreateBundle ? 'rgba(233, 30, 99, 0.1)' : 'transparent',
                            },
                            '&.Mui-disabled': {
                              borderColor: 'rgba(233, 30, 99, 0.3)',
                              color: 'rgba(233, 30, 99, 0.5)',
                            },
                          }}
                        >
                          {exporting ? 'Generating...' : `Create ${project.primary_tool ? project.primary_tool.charAt(0).toUpperCase() + project.primary_tool.slice(1) : 'Tool'} Bundle`}
                        </Button>
                      );
                      
                      if (!canCreateBundle && missingPhases.length > 0) {
                        return (
                          <Tooltip 
                            title={`Complete these phases first: ${missingPhases.join(', ')}`}
                            arrow
                          >
                            <span>{button}</span>
                          </Tooltip>
                        );
                      }
                      
                      return button;
                    })()}
                    <Button
                      variant="outlined"
                      startIcon={<AssignmentIcon />}
                      onClick={handleProjectManagement}
                      disabled={initiating}
                      fullWidth
                      sx={{
                        borderColor: project?.initiated_at ? '#00E5FF' : '#E91E63',
                        color: project?.initiated_at ? '#00E5FF' : '#E91E63',
                        '&:hover': {
                          borderColor: project?.initiated_at ? '#00E5FF' : '#E91E63',
                          backgroundColor: project?.initiated_at 
                            ? 'rgba(0, 229, 255, 0.1)' 
                            : 'rgba(233, 30, 99, 0.1)',
                        },
                        '&.Mui-disabled': {
                          borderColor: project?.initiated_at 
                            ? 'rgba(0, 229, 255, 0.3)' 
                            : 'rgba(233, 30, 99, 0.3)',
                          color: project?.initiated_at 
                            ? 'rgba(0, 229, 255, 0.5)' 
                            : 'rgba(233, 30, 99, 0.5)',
                        },
                      }}
                    >
                      {initiating 
                        ? 'Initiating...' 
                        : project?.initiated_at 
                          ? 'Project Management' 
                          : 'Initiate Project Management'}
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<HistoryIcon />}
                      onClick={() => router.push(`/project/${projectId}/exports`)}
                      fullWidth
                      sx={{
                        borderColor: '#00E5FF',
                        color: '#00E5FF',
                        '&:hover': {
                          borderColor: '#00E5FF',
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        },
                      }}
                    >
                      Export History
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<SettingsIcon />}
                      onClick={() => router.push(`/project/${projectId}/settings`)}
                      fullWidth
                      sx={{
                        borderColor: '#00E5FF',
                        color: '#00E5FF',
                        '&:hover': {
                          borderColor: '#00E5FF',
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        },
                      }}
                    >
                      Edit Settings
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<PeopleIcon />}
                      onClick={() => router.push(`/project/${projectId}/members`)}
                      fullWidth
                      sx={{
                        borderColor: '#E91E63',
                        color: '#E91E63',
                        '&:hover': {
                          borderColor: '#E91E63',
                          backgroundColor: 'rgba(233, 30, 99, 0.1)',
                        },
                      }}
                    >
                      Manage Members
                    </Button>
                    {role === 'admin' && (
                      <Button
                        variant="contained"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteClick}
                        fullWidth
                        disabled={deleting}
                        sx={{
                          backgroundColor: '#FF1744',
                          color: '#fff',
                          '&:hover': {
                            backgroundColor: '#D50000',
                          },
                          '&.Mui-disabled': {
                            backgroundColor: 'rgba(255, 23, 68, 0.3)',
                            color: 'rgba(255, 255, 255, 0.5)',
                          },
                        }}
                      >
                        {deleting ? 'Deleting...' : 'Delete Project'}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Dialog
            open={showBlueprintWarning}
            onClose={() => setShowBlueprintWarning(false)}
            maxWidth="sm"
            PaperProps={{
              sx: {
                backgroundColor: '#000',
                border: '1px solid rgba(255, 152, 0, 0.3)',
              },
            }}
          >
            <DialogTitle sx={{ color: '#FF9800', fontWeight: 600 }}>
              Incomplete Phases Detected
            </DialogTitle>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)', borderColor: '#FF9800' }}>
                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                  For best results, we recommend completing all 6 phases before exporting the blueprint. 
                  The blueprint will include all available data, but incomplete phases may result in a less comprehensive output.
                </Typography>
              </Alert>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                You can still export now, but the blueprint may be missing information from incomplete phases.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(255, 152, 0, 0.2)' }}>
              <Button
                onClick={() => setShowBlueprintWarning(false)}
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
                onClick={async () => {
                  setShowBlueprintWarning(false);
                  await performBlueprintExport();
                }}
                variant="contained"
                sx={{
                  backgroundColor: '#FF9800',
                  color: '#000',
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: '#F57C00',
                  },
                }}
              >
                Export Anyway
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog
            open={showCursorDialog}
            onClose={() => setShowCursorDialog(false)}
            maxWidth="lg"
            fullWidth
            PaperProps={{
              sx: {
                backgroundColor: '#000',
                border: '2px solid rgba(0, 229, 255, 0.2)',
              },
            }}
          >
            <DialogTitle sx={{ color: '#00E5FF', fontWeight: 600 }}>
              Cursor Master Prompt
            </DialogTitle>
            <DialogContent>
              <Box
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  maxHeight: '60vh',
                  overflow: 'auto',
                  p: 2,
                  bgcolor: '#1A1F3A',
                  borderRadius: 1,
                  color: '#E0E0E0',
                  border: '2px solid rgba(0, 229, 255, 0.2)',
                }}
              >
                {cursorPrompt}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: '2px solid rgba(0, 229, 255, 0.2)' }}>
              <Button
                onClick={handleCopyCursorPrompt}
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                disabled={!cursorPrompt}
                sx={{
                  color: copied ? '#00FF88' : '#00E5FF',
                  border: copied ? '1px solid #00FF88' : 'none',
                  '&:hover': {
                    backgroundColor: copied ? 'rgba(0, 255, 136, 0.1)' : 'rgba(0, 229, 255, 0.1)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                {copied ? 'Copied!' : 'Copy to Clipboard'}
              </Button>
              <Button
                onClick={handleDownloadCursorPrompt}
                startIcon={<DownloadIcon />}
                sx={{
                  color: '#00E5FF',
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                Download
              </Button>
              <Button
                onClick={() => setShowCursorDialog(false)}
                sx={{
                  color: '#B0B0B0',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteDialogOpen}
            onClose={handleDeleteCancel}
            PaperProps={{
              sx: {
                backgroundColor: '#000',
                border: '1px solid rgba(255, 23, 68, 0.3)',
              },
            }}
          >
            <DialogTitle sx={{ color: '#FF1744', fontWeight: 600 }}>
              Delete Project
            </DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ color: '#B0B0B0' }}>
                Are you sure you want to delete &quot;{project?.name}&quot;? This action cannot be undone and will permanently delete the project and all associated data.
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
        </Container>
      </Box>
    </ErrorBoundary>
  );
}

