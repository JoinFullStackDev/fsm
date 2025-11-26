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
import { useTheme } from '@mui/material/styles';
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

// Helper function to check if a value has content
const checkValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) {
    if (value.length === 0) return false;
    // For arrays of objects, check if at least one object has meaningful content
    if (value.length > 0 && typeof value[0] === 'object') {
      return value.some(item => {
        if (typeof item === 'object' && item !== null) {
          return Object.keys(item).some(key => checkValue(item[key]));
        }
        return checkValue(item);
      });
    }
    return true;
  }
  if (typeof value === 'object') {
    // Check if object has any non-empty values
    const keys = Object.keys(value);
    if (keys.length === 0) return false;
    // For nested objects, check if they have meaningful content
    return keys.some(key => checkValue(value[key]));
  }
  return true;
};

// Calculate phase progress based on template field configs or fallback to hardcoded calculation
const calculatePhaseProgressWithConfigs = (
  phaseNumber: number,
  phaseData: any,
  fieldConfigs?: Array<{ field_key: string }>
): number => {
  if (!phaseData) return 0;

  // If we have field configs (template-based form), calculate based on those fields
  if (fieldConfigs && fieldConfigs.length > 0) {
    const totalFields = fieldConfigs.length;
    const completedFields = fieldConfigs.filter(config => {
      const fieldKey = config.field_key;
      const value = phaseData[fieldKey];
      return checkValue(value);
    }).length;

    return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0;
  }

  // Fallback to old calculation for non-template forms
  return calculatePhaseProgress(phaseNumber, phaseData);
};

export default function ProjectPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { role, loading: roleLoading } = useRole();
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<PhaseSummary[]>([]);
  const [fieldConfigsByPhase, setFieldConfigsByPhase] = useState<Record<number, Array<{ field_key: string }>>>({});
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

      // Load template field configs if project has a template_id
      if (projectData.template_id && phasesData && phasesData.length > 0) {
        const phaseNumbers = phasesData.map(p => p.phase_number);
        const { data: configsData, error: configsError } = await supabase
          .from('template_field_configs')
          .select('phase_number, field_key')
          .eq('template_id', projectData.template_id)
          .in('phase_number', phaseNumbers);

        if (!configsError && configsData) {
          // Organize configs by phase number
          const configsByPhase: Record<number, Array<{ field_key: string }>> = {};
          configsData.forEach(config => {
            if (!configsByPhase[config.phase_number]) {
              configsByPhase[config.phase_number] = [];
            }
            configsByPhase[config.phase_number].push({ field_key: config.field_key });
          });
          setFieldConfigsByPhase(configsByPhase);
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
        <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
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
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
          <Breadcrumbs items={[{ label: project.name }]} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Box>
              <Typography
                variant="h4"
                component="h1"
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  fontSize: '1.5rem',
                  mb: 1,
                }}
              >
                {project.name}
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
                {project.description || 'No description'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip
                label={project.status.replace('_', ' ')}
                sx={{
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  fontWeight: 500,
                }}
              />
              {project.primary_tool && (
                <Chip
                  label={project.primary_tool}
                  sx={{
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.divider}`,
                    fontWeight: 500,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Phase Progress Indicator */}
          {(() => {
            const totalPhases = phases.length || 6; // Use actual phase count, fallback to 6 for backward compatibility
            
            // Calculate progress based on actual phase progress, not just completed flag
            let totalProgress = 0;
            phases.forEach((phase) => {
              const fieldConfigs = fieldConfigsByPhase[phase.phase_number];
              const phaseProgress = calculatePhaseProgressWithConfigs(
                phase.phase_number,
                phase.data || null,
                fieldConfigs
              );
              // Consider phase completed if either the database flag is set OR progress is 100%
              const isCompleted = phase.completed || phaseProgress >= 100;
              totalProgress += isCompleted ? 100 : phaseProgress;
            });
            
            const progressPercentage = totalPhases > 0 ? totalProgress / totalPhases : 0;
            const completedPhases = phases.filter((p) => {
              const fieldConfigs = fieldConfigsByPhase[p.phase_number];
              const phaseProgress = calculatePhaseProgressWithConfigs(
                p.phase_number,
                p.data || null,
                fieldConfigs
              );
              return p.completed || phaseProgress >= 100;
            }).length;
            
            return (
              <Box
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  mb: 3,
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography
                    variant="h6"
                    sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
                  >
                    Project Progress
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      color: theme.palette.text.primary,
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
                    backgroundColor: theme.palette.action.hover,
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      backgroundColor: '#4CAF50',
                    },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    color: theme.palette.text.secondary,
                    mt: 1,
                    textAlign: 'right',
                  }}
                >
                  {Math.round(progressPercentage)}% complete
                </Typography>
              </Box>
            );
          })()}

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Box
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 3,
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 3 }}
                >
                  Phases
                </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {phases.map((phase) => {
                      const phaseNumber = phase.phase_number;
                      const phaseName = phase.phase_name || `Phase ${phaseNumber}`;
                      const fieldConfigs = fieldConfigsByPhase[phaseNumber];
                      const progress = calculatePhaseProgressWithConfigs(
                        phaseNumber,
                        phase.data || null,
                        fieldConfigs
                      );
                      // Consider phase completed if either the database flag is set OR progress is 100%
                      const completed = phase.completed || progress >= 100;
                      const hasStarted = progress > 0;
                      
                      return (
                        <Box
                          key={phaseNumber}
                          onClick={() => router.push(`/project/${projectId}/phase/${phaseNumber}`)}
                          sx={{
                            border: `1px solid ${completed ? '#4CAF50' : theme.palette.divider}`,
                            backgroundColor: completed ? theme.palette.action.hover : theme.palette.background.paper,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            position: 'relative',
                            overflow: 'visible',
                            borderRadius: 2,
                            p: 2,
                            mb: 2,
                            '&:hover': {
                              borderColor: completed ? '#4CAF50' : theme.palette.text.primary,
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                              <Box>
                                <Chip
                                  label={phaseName}
                                  size="small"
                                  sx={{
                                    backgroundColor: theme.palette.action.hover,
                                    color: completed ? '#4CAF50' : theme.palette.text.primary,
                                    border: `1px solid ${completed ? '#4CAF50' : theme.palette.divider}`,
                                    fontWeight: 600,
                                    mb: 1,
                                  }}
                                />
                                <Typography
                                  variant="h6"
                                  sx={{
                                    fontWeight: 600,
                                    color: completed ? '#4CAF50' : theme.palette.text.primary,
                                    mt: 1,
                                  }}
                                >
                                  {phaseName}
                                </Typography>
                              </Box>
                              {completed && (
                                <CheckCircleIcon
                                  sx={{
                                    color: '#4CAF50',
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
                                    color: theme.palette.text.secondary,
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
                                      color: theme.palette.text.primary,
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
                                  backgroundColor: theme.palette.action.hover,
                                  '& .MuiLinearProgress-bar': {
                                    backgroundColor: completed ? '#4CAF50' : theme.palette.text.primary,
                                    borderRadius: 4,
                                  },
                                }}
                              />
                            </Box>
                          </Box>
                      );
                    })}
                  </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 3,
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ color: theme.palette.text.primary, fontWeight: 600 }}
                >
                  Actions
                </Typography>
                <Divider sx={{ mb: 2, borderColor: theme.palette.divider }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Button
                      variant="outlined"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportBlueprint}
                      disabled={exporting}
                      fullWidth
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
                            borderColor: theme.palette.text.primary,
                            color: theme.palette.text.primary,
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
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
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
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
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
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
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
                        borderColor: theme.palette.text.primary,
                        color: theme.palette.text.primary,
                        '&:hover': {
                          borderColor: theme.palette.text.primary,
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      Manage Members
                    </Button>
                    {role === 'admin' && (
                      <Button
                        variant="outlined"
                        startIcon={<DeleteIcon />}
                        onClick={handleDeleteClick}
                        fullWidth
                        disabled={deleting}
                        sx={{
                          borderColor: theme.palette.text.primary,
                          color: theme.palette.text.primary,
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
                        {deleting ? 'Deleting...' : 'Delete Project'}
                      </Button>
                    )}
                  </Box>
              </Box>
            </Grid>
          </Grid>

          <Dialog
            open={showBlueprintWarning}
            onClose={() => setShowBlueprintWarning(false)}
            maxWidth="sm"
            PaperProps={{
              sx: {
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              Incomplete Phases Detected
            </DialogTitle>
            <DialogContent>
              <Alert severity="warning" sx={{ mb: 2, backgroundColor: theme.palette.action.hover, borderColor: theme.palette.divider }}>
                <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                  For best results, we recommend completing all 6 phases before exporting the blueprint. 
                  The blueprint will include all available data, but incomplete phases may result in a less comprehensive output.
                </Typography>
              </Alert>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
                You can still export now, but the blueprint may be missing information from incomplete phases.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button
                onClick={() => setShowBlueprintWarning(false)}
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
                onClick={async () => {
                  setShowBlueprintWarning(false);
                  await performBlueprintExport();
                }}
                variant="outlined"
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
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              },
            }}
          >
            <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
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
                  bgcolor: theme.palette.background.default,
                  borderRadius: 1,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                {cursorPrompt}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button
                onClick={handleCopyCursorPrompt}
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
                disabled={!cursorPrompt}
                sx={{
                  color: copied ? '#4CAF50' : theme.palette.text.primary,
                  border: copied ? `1px solid #4CAF50` : 'none',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
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
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Download
              </Button>
              <Button
                onClick={() => setShowCursorDialog(false)}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
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
                Are you sure you want to delete &quot;{project?.name}&quot;? This action cannot be undone and will permanently delete the project and all associated data.
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
        </Container>
      </Box>
    </ErrorBoundary>
  );
}

