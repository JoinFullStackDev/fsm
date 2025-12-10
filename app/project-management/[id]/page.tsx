'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Skeleton,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { NavigateNext as NavigateNextIcon, Refresh as RefreshIcon, AutoAwesome as AutoAwesomeIcon, OpenInNew as OpenInNewIcon, WorkspacePremium as WorkspacePremiumIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import TaskTable from '@/components/project-management/TaskTable';
import TaskDetailSheet from '@/components/project-management/TaskDetailSheet';
import ViewToggle, { type ViewType } from '@/components/project-management/ViewToggle';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import GanttChart from '@/components/project-management/GanttChart';
import KanbanBoard from '@/components/project-management/KanbanBoard';
import AssigneeKanbanBoard from '@/components/project-management/AssigneeKanbanBoard';
import GenerateReportForm, { type ReportType, type ReportFormat } from '@/components/project-management/GenerateReportForm';
import ReportsList from '@/components/project-management/ReportsList';
import TaskGeneratorModal from '@/components/project-management/TaskGeneratorModal';
import TaskPreviewTable from '@/components/project-management/TaskPreviewTable';
import ProjectDashboard from '@/components/project-management/ProjectDashboard';
import BuildingOverlay from '@/components/ai/BuildingOverlay';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import type { ProjectTask, ProjectTaskExtended, Project } from '@/types/project';
import type { User } from '@/types/project';
import type { PreviewTask, TaskMerge } from '@/types/taskGenerator';

export default function ProjectTaskManagementPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const supabase = createSupabaseClient();
  const { features } = useOrganization();

  // DEBUG: Log features to console
  useEffect(() => {
    console.log('[Product Workspace Debug]', {
      features,
      hasWorkspace: features?.product_workspace_enabled,
      allKeys: features ? Object.keys(features) : [],
    });
  }, [features]);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<(ProjectTask | ProjectTaskExtended)[]>([]);
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [phaseNames, setPhaseNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<(ProjectTask | ProjectTaskExtended) | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [view, setView] = useState<ViewType>('table');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [reportsRefreshTrigger, setReportsRefreshTrigger] = useState(0);
  const taskIdProcessedRef = useRef<string | null>(null);
  const { showSuccess, showError } = useNotification();
  const [taskGeneratorOpen, setTaskGeneratorOpen] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<PreviewTask[]>([]);
  const [previewSummary, setPreviewSummary] = useState<string | undefined>();
  const [showPreview, setShowPreview] = useState(false);
  const [previewAnalysisId, setPreviewAnalysisId] = useState<string | null>(null);
  const hasPolledRef = useRef(false); // Track if we've already polled for tasks

  const loadTasks = useCallback(async () => {
    // Load tasks via API route to avoid RLS recursion issues
    console.log(`[Task Management] Loading tasks for project: ${projectId}`);
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks?t=${Date.now()}`, {
        cache: 'no-store', // Ensure fresh data
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[Task Management] Error loading tasks:', errorData);
        setError(errorData.error || 'Failed to load tasks');
        return [];
      }
      
      const tasksData = await response.json();
      console.log(`[Task Management] Loaded ${tasksData?.length || 0} tasks for project ${projectId}`);
      
      // The API already returns transformed tasks with assignee info
      // Just need to add parent task info
      const taskMap = new Map<string, any>();
      (tasksData || []).forEach((task: any) => {
        taskMap.set(task.id, task);
      });

      // Transform tasks to include parent task info
      const transformedTasks = (tasksData || []).map((task: any) => {
        const parentTask = task.parent_task_id ? taskMap.get(task.parent_task_id) : null;
        return {
          ...task,
          parent_task: parentTask ? {
            id: parentTask.id,
            title: parentTask.title,
            assignee_id: parentTask.assignee_id,
          } : null,
        };
      });
      return transformedTasks as (ProjectTask | ProjectTaskExtended)[];
    } catch (error) {
      console.error('[Task Management] Error loading tasks:', error);
      setError(error instanceof Error ? error.message : 'Failed to load tasks');
      return [];
    }
  }, [projectId]);

  const loadData = useCallback(async () => {
      setLoading(true);
      // Create supabase client fresh to avoid dependency issues
      const supabaseClient = createSupabaseClient();
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

      if (sessionError || !session) {
        setError('Session not found. Please try signing in again.');
        setLoading(false);
        return;
      }

      // OPTIMIZATION: Use combined endpoint to fetch all data in ONE request
      // This replaces 4 separate API calls (user, project, tasks, phases, members)
      try {
        const response = await fetch(`/api/projects/${projectId}/management-data`);
        
        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to load project data');
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        // Set all state from combined response
        setCurrentUserId(data.currentUserId);
        setProject(data.project as Project);
        setTasks(data.tasks as (ProjectTask | ProjectTaskExtended)[]);
        setPhaseNames(data.phaseNames || {});
        setProjectMembers(data.projectMembers || []);
        
        console.log('[Task Management] Loaded all data via combined endpoint:', {
          taskCount: data.tasks?.length || 0,
          phaseCount: data.phases?.length || 0,
          memberCount: data.projectMembers?.length || 0,
          responseTime: data.meta?.responseTime,
        });
      } catch (error) {
        console.error('[Task Management] Error loading data:', error);
        setError(error instanceof Error ? error.message : 'Failed to load project data');
      }

      setLoading(false);
    }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]); // Only depend on projectId - loadData is stable

  // Check for preview mode from analyze endpoint
  // First checks sessionStorage (populated by project details page), then falls back to API
  useEffect(() => {
    const previewParam = searchParams.get('preview');
    const analysisId = searchParams.get('analysis_id');
    
    // Only load if we have preview param, analysis ID, and haven't loaded preview yet
    if (previewParam === 'true' && analysisId && !showPreview && previewTasks.length === 0) {
      // Helper function to transform tasks to PreviewTask format
      const transformTasks = (tasks: any[], resultAnalysisId: string): PreviewTask[] => {
        return tasks.map((task: any, index: number) => ({
          // PreviewTask-specific fields
          previewId: task.previewId || `preview-${Date.now()}-${index}`,
          duplicateStatus: task.isUpdate ? 'possible-duplicate' : 'unique',
          existingTaskId: task.isUpdate ? task.id : null,
          requirements: task.requirements || [],
          userStories: task.userStories,
          // ProjectTask fields (required for database insertion)
          title: task.title,
          description: task.description || null,
          phase_number: task.phase_number,
          priority: task.priority || 'medium',
          status: task.status || 'todo',
          estimated_hours: task.estimated_hours || null,
          tags: task.tags || [],
          start_date: task.start_date || null,
          due_date: task.due_date || null,
          assignee_id: task.assignee_id || null,
          notes: task.notes || null,
          dependencies: task.dependencies || [],
          ai_generated: true,
          ai_analysis_id: resultAnalysisId || null,
          parent_task_id: task.parent_task_id || null,
        }));
      };

      // First, check sessionStorage for cached preview data (set by project details page)
      const storedPreview = sessionStorage.getItem(`preview_${projectId}`);
      
      if (storedPreview) {
        try {
          const data = JSON.parse(storedPreview);
          // Only use if it's recent (within 5 minutes) and matches the analysis_id
          if (data.analysis_id === analysisId && Date.now() - data.timestamp < 5 * 60 * 1000) {
            const previewTasksData = transformTasks(data.tasks, data.analysis_id);
            
            console.log('[Preview Mode] Loaded from sessionStorage:', previewTasksData.length, 'tasks');
            setPreviewTasks(previewTasksData);
            setPreviewSummary(data.summary);
            setPreviewAnalysisId(data.analysis_id);
            setShowPreview(true);
            
            // Clear sessionStorage after loading
            sessionStorage.removeItem(`preview_${projectId}`);
            return; // Don't make API call
          }
        } catch (e) {
          console.error('[Preview Mode] Error parsing stored preview:', e);
        }
        // Clear invalid/expired data
        sessionStorage.removeItem(`preview_${projectId}`);
      }

      // Fallback: Load preview tasks from analyze endpoint (only if not in sessionStorage)
      let isCancelled = false;
      
      const loadPreviewTasks = async () => {
        if (isCancelled) return;
        
        console.log('[Preview Mode] No cached data, fetching from API...');
        
        try {
          const response = await fetch(`/api/projects/${projectId}/analyze?preview=true`, {
            method: 'POST',
          });
          
          if (isCancelled) return;
          
          if (response.ok) {
            const result = await response.json();
            if (isCancelled) return;
            
            if (result.preview && result.tasks) {
              const previewTasksData = transformTasks(result.tasks, result.analysis_id);
              
              if (!isCancelled) {
                console.log('[Preview Mode] Preview tasks loaded from API:', previewTasksData.length, 'tasks');
                setPreviewTasks(previewTasksData);
                setPreviewSummary(result.summary);
                setPreviewAnalysisId(result.analysis_id);
                setShowPreview(true);
              }
            }
          }
        } catch (err) {
          if (!isCancelled) {
            console.error('[Preview Mode] Failed to load preview tasks:', err);
          }
        }
      };
      
      loadPreviewTasks();
      
      return () => {
        isCancelled = true;
      };
    }
  }, [searchParams, projectId, showPreview, previewTasks.length]); // Added previewTasks.length to prevent re-running

  // Poll for tasks if project is initiated but no tasks are loaded yet
  // This handles the case where tasks are being created asynchronously
  useEffect(() => {
    // Reset polling flag when projectId changes
    if (projectId) {
      hasPolledRef.current = false;
    }
    
    // Only poll if: project exists, is initiated, has no tasks, not loading, and we haven't polled yet
    if (!project || !project.initiated_at || tasks.length > 0 || loading || hasPolledRef.current) {
      return;
    }

    // Mark that we're starting to poll
    hasPolledRef.current = true;
    
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;
    let maxTimeoutId: NodeJS.Timeout | null = null;
    let pollCount = 0;
    const MAX_POLLS = 5; // Maximum 5 polls (10 seconds total)

    // If project is initiated but no tasks, wait a bit and check again
    const checkForTasks = async () => {
      if (isCancelled || pollCount >= MAX_POLLS) {
        return;
      }
      
      pollCount++;
      
      try {
        const response = await fetch(`/api/projects/${projectId}/tasks?t=${Date.now()}`, {
          cache: 'no-store',
        });
        
        if (isCancelled) return;
        
        if (response.ok) {
          const tasksData = await response.json();
          if (isCancelled) return;
          
          if (tasksData && tasksData.length > 0) {
            const taskMap = new Map<string, any>();
            tasksData.forEach((task: any) => {
              taskMap.set(task.id, task);
            });
            const transformedTasks = tasksData.map((task: any) => {
              const parentTask = task.parent_task_id ? taskMap.get(task.parent_task_id) : null;
              return {
                ...task,
                parent_task: parentTask ? {
                  id: parentTask.id,
                  title: parentTask.title,
                  assignee_id: parentTask.assignee_id,
                } : null,
              };
            });
            setTasks(transformedTasks as (ProjectTask | ProjectTaskExtended)[]);
            // Stop polling once we have tasks
            return;
          } else if (!isCancelled && pollCount < MAX_POLLS) {
            // Retry after 2 seconds if still no tasks and we haven't exceeded max polls
            timeoutId = setTimeout(checkForTasks, 2000);
          }
        }
      } catch (error) {
        console.error('[Task Management] Error polling for tasks:', error);
        if (!isCancelled && pollCount < MAX_POLLS) {
          timeoutId = setTimeout(checkForTasks, 2000);
        }
      }
    };

    // Initial delay to allow tasks to be inserted
    timeoutId = setTimeout(checkForTasks, 2000);
    
    // Stop polling after 10 seconds (5 polls * 2 seconds)
    maxTimeoutId = setTimeout(() => {
      if (!isCancelled) {
        checkForTasks();
      }
    }, 10000);

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (maxTimeoutId) clearTimeout(maxTimeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.initiated_at, tasks.length, loading, projectId]); // Use project.id instead of project object

  // Listen for bulk operation success and refresh tasks
  useEffect(() => {
    let isMounted = true;
    
    const handleRefresh = async () => {
      if (!isMounted) return;
      try {
        const response = await fetch(`/api/projects/${projectId}/tasks?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (isMounted && response.ok) {
          const tasksData = await response.json();
          const taskMap = new Map<string, any>();
          (tasksData || []).forEach((task: any) => {
            taskMap.set(task.id, task);
          });
          const transformedTasks = (tasksData || []).map((task: any) => {
            const parentTask = task.parent_task_id ? taskMap.get(task.parent_task_id) : null;
            return {
              ...task,
              parent_task: parentTask ? {
                id: parentTask.id,
                title: parentTask.title,
                assignee_id: parentTask.assignee_id,
              } : null,
            };
          });
          if (isMounted) {
            setTasks(transformedTasks as (ProjectTask | ProjectTaskExtended)[]);
          }
        }
      } catch (error) {
        console.error('[Task Management] Error refreshing tasks:', error);
      }
    };
    
    const handleSuccess = (e: CustomEvent) => {
      if (!isMounted) return;
      const { operation, count } = e.detail;
      showSuccess(`Successfully ${operation === 'delete' ? 'deleted' : 'updated'} ${count} task${count !== 1 ? 's' : ''}`);
      handleRefresh();
    };
    
    const handleError = (e: CustomEvent) => {
      if (!isMounted) return;
      showError(e.detail.error || 'Failed to perform bulk operation');
    };

    window.addEventListener('tasks-refresh-needed', handleRefresh);
    window.addEventListener('task-bulk-operation-success', handleSuccess as EventListener);
    window.addEventListener('task-bulk-operation-error', handleError as EventListener);

    return () => {
      isMounted = false;
      window.removeEventListener('tasks-refresh-needed', handleRefresh);
      window.removeEventListener('task-bulk-operation-success', handleSuccess as EventListener);
      window.removeEventListener('task-bulk-operation-error', handleError as EventListener);
    };
  }, [projectId, showSuccess, showError]); // Removed loadTasks dependency - inline the fetch logic

  // Check for taskId in URL query params and open task sheet
  // This runs after tasks are loaded and component is ready
  useEffect(() => {
    // Wait for loading to complete and tasks to be available
    if (loading || tasks.length === 0) {
      return;
    }

    const taskId = searchParams.get('taskId');
    if (taskId && !sheetOpen && taskId !== taskIdProcessedRef.current) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        taskIdProcessedRef.current = taskId;
        // Use setTimeout to ensure the component is fully rendered
        setTimeout(() => {
          setSelectedTask(task);
          setSheetOpen(true);
          // Remove taskId from URL to clean it up
          router.replace(`/project-management/${projectId}`, { scroll: false });
        }, 100);
      }
    }
  }, [searchParams, tasks, sheetOpen, projectId, router, loading]);

  // Reset processed ref when sheet closes
  useEffect(() => {
    if (!sheetOpen) {
      taskIdProcessedRef.current = null;
    }
  }, [sheetOpen]);

  const handleTaskClick = (task: ProjectTask | ProjectTaskExtended) => {
    setSelectedTask(task);
    setSheetOpen(true);
  };

  const handleTaskSave = async (taskData: Partial<ProjectTask>) => {
    try {
      if (selectedTask?.id) {
        // Update existing task
        const response = await fetch(`/api/projects/${projectId}/tasks/${selectedTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update task');
        }

        const updatedTask = await response.json();
        setTasks((prev) => prev.map((t) => (t.id === updatedTask.id ? updatedTask : t)));
      } else {
        // Create new task
        const response = await fetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create task');
        }

        const newTask = await response.json();
        setTasks((prev) => [newTask, ...prev]);
      }

      setSheetOpen(false);
      setSelectedTask(null);
    } catch (err) {
      throw err;
    }
  };

  const handleTaskDelete = async (taskId: string) => {
    const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete task');
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const handleTaskUpdate = async (taskId: string, updates: Partial<ProjectTask>) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update task');
      }

      const updatedTask = await response.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleReAnalyze = async () => {
    try {
      setAnalyzing(true);
      // Use preview mode to show merge sheet
      const response = await fetch(`/api/projects/${projectId}/analyze?preview=true`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze project');
      }

      const result = await response.json();
      
      if (result.preview && result.tasks) {
        // Transform tasks to PreviewTask format
        const previewTasksData: PreviewTask[] = result.tasks.map((task: any, index: number) => ({
          // PreviewTask-specific fields
          previewId: task.previewId || `preview-${Date.now()}-${index}`,
          duplicateStatus: task.isUpdate ? 'possible-duplicate' : 'unique',
          existingTaskId: task.isUpdate ? task.id : null,
          requirements: task.requirements || [],
          userStories: task.userStories,
          // ProjectTask fields (required for database insertion)
          title: task.title,
          description: task.description || null,
          phase_number: task.phase_number,
          priority: task.priority || 'medium',
          status: task.status || 'todo',
          estimated_hours: task.estimated_hours || null,
          tags: task.tags || [],
          start_date: task.start_date || null,
          due_date: task.due_date || null,
          assignee_id: task.assignee_id || null,
          notes: task.notes || null,
          dependencies: task.dependencies || [],
          ai_generated: true,
          ai_analysis_id: result.analysis_id || null,
          parent_task_id: task.parent_task_id || null,
        }));
        
        console.log('[Re-Analyze] Preview tasks:', previewTasksData.length, 'tasks');
        setPreviewTasks(previewTasksData);
        setPreviewSummary(result.summary);
        setPreviewAnalysisId(result.analysis_id);
        setShowPreview(true);
      } else {
        // Fallback: direct insertion (shouldn't happen with preview=true)
        const loadedTasks = await loadTasks();
        setTasks(loadedTasks);
        showSuccess('Project re-analyzed successfully!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to analyze project';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  // Early returns must be after all hooks
  if (loading && !project) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, px: { xs: 0, md: 3 } }}>
        <Box sx={{ py: 4 }}>
          <Skeleton variant="text" width="40%" height={48} sx={{ mb: 3 }} />
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 4 }} />
          <LoadingSkeleton variant="table" count={5} />
        </Box>
      </Container>
    );
  }

  if (error && !project) {
    return (
      <Container maxWidth="xl" sx={{ py: 4, px: { xs: 0, md: 3 } }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <>
      <BuildingOverlay open={analyzing} message="Re-analyzing project..." />
      <Container maxWidth="xl" sx={{ py: 4, px: { xs: 0, md: 3 } }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />}
        sx={{ mb: 3, px: { xs: 2, md: 0 } }}
      >
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/project-management')}
          sx={{ color: theme.palette.text.primary, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Task Management
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push(`/project/${projectId}`)}
          sx={{ 
            color: theme.palette.text.secondary, 
            textDecoration: 'none', 
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            '&:hover': { textDecoration: 'underline', color: theme.palette.text.primary } 
          }}
        >
          {project?.name || 'Project'}
          <OpenInNewIcon sx={{ fontSize: 14 }} />
        </Link>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: { xs: 2, md: 0 }, px: { xs: 2, md: 0 } }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 600,
            fontSize: { xs: '1.25rem', md: '1.5rem' },
            color: theme.palette.text.primary,
          }}
        >
          {project?.name || 'Project'} - Task Management
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 2, md: 1 }, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
          {features?.product_workspace_enabled && (
            <Button
              variant="outlined"
              startIcon={<WorkspacePremiumIcon sx={{ fontSize: { xs: 22, md: 18 } }} />}
              onClick={() => router.push(`/workspace/${projectId}`)}
              size="small"
              fullWidth={false}
              sx={{
                height: { xs: '40px', md: '32px' },
                minHeight: { xs: '40px', md: '32px' },
                width: { xs: '100%', md: 'auto' },
                borderColor: theme.palette.primary.main,
                color: theme.palette.primary.main,
                fontSize: { xs: '0.875rem', md: '0.75rem' },
                '&:hover': {
                  borderColor: theme.palette.primary.dark,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Product Workspace
            </Button>
          )}
          {features?.ai_task_generator_enabled && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon sx={{ fontSize: { xs: 22, md: 18 } }} />}
              onClick={() => setTaskGeneratorOpen(true)}
              size="small"
              fullWidth={false}
              sx={{
                height: { xs: '40px', md: '32px' },
                minHeight: { xs: '40px', md: '32px' },
                width: { xs: '100%', md: 'auto' },
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                fontSize: { xs: '0.875rem', md: '0.75rem' },
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }}
            >
              Generate Tasks
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon sx={{ fontSize: { xs: 22, md: 18 } }} />}
            onClick={handleReAnalyze}
            disabled={analyzing}
            size="small"
            fullWidth={false}
            sx={{
              height: { xs: '40px', md: '32px' },
              minHeight: { xs: '40px', md: '32px' },
              width: { xs: '100%', md: 'auto' },
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontSize: { xs: '0.875rem', md: '0.75rem' },
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Re-analyze
          </Button>
          <ViewToggle
            view={view}
            onChange={setView}
          />
        </Box>
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
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* View Content */}
      {showPreview ? (
        <TaskPreviewTable
          tasks={previewTasks}
          phaseNames={phaseNames}
          summary={previewSummary}
          projectId={projectId}
          onInject={async (selectedTasks, merges) => {
            try {
              console.log('[Task Inject] Starting injection...', {
                taskCount: selectedTasks.length,
                mergeCount: merges.length,
                analysisId: previewAnalysisId,
              });
              console.log('[Task Inject] First task sample:', selectedTasks[0]);

              const requestBody = {
                tasks: selectedTasks.map((t) => ({
                  task: t,
                  selected: true,
                })),
                merges,
                analysis_id: previewAnalysisId, // Link tasks to analysis if from analyze endpoint
              };
              
              console.log('[Task Inject] Request body:', JSON.stringify(requestBody).substring(0, 500));

              const response = await fetch(`/api/projects/${projectId}/generate-tasks/inject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });

              console.log('[Task Inject] Response status:', response.status);

              if (!response.ok) {
                const error = await response.json();
                console.error('[Task Inject] Error response:', error);
                throw new Error(error.error || 'Failed to inject tasks');
              }

              const result = await response.json();
              console.log('[Task Inject] Success:', result);
              showSuccess(`Successfully created ${result.created} tasks and merged ${result.merged} tasks!`);

              // Reload tasks
              const loadedTasks = await loadTasks();
              setTasks(loadedTasks);

              // Close preview
              setShowPreview(false);
              setPreviewTasks([]);
              setPreviewSummary(undefined);
              setPreviewAnalysisId(null);
              // Clear any lingering sessionStorage
              sessionStorage.removeItem(`preview_${projectId}`);
              // Clear URL params
              router.replace(`/project-management/${projectId}`, { scroll: false });
            } catch (err) {
              console.error('[Task Inject] Error:', err);
              showError(err instanceof Error ? err.message : 'Failed to inject tasks');
            }
          }}
          onRegenerate={() => {
            setShowPreview(false);
            setTaskGeneratorOpen(true);
          }}
          onBack={() => {
            setShowPreview(false);
            setPreviewTasks([]);
            setPreviewSummary(undefined);
            setPreviewAnalysisId(null);
            // Clear any lingering sessionStorage
            sessionStorage.removeItem(`preview_${projectId}`);
            // Clear URL params
            router.replace(`/project-management/${projectId}`, { scroll: false });
          }}
        />
      ) : (
        <>
          {view === 'table' && (
            <ErrorBoundary>
              <TaskTable
                tasks={tasks}
                loading={analyzing}
                onTaskClick={handleTaskClick}
                onTaskUpdate={handleTaskUpdate}
                onTaskDelete={handleTaskDelete}
                projectId={projectId}
                projectMembers={projectMembers}
                phaseNames={phaseNames}
              />
            </ErrorBoundary>
          )}
        </>
      )}
      {view === 'gantt' && (
        <GanttChart tasks={tasks} onTaskClick={handleTaskClick} phaseNames={phaseNames} />
      )}
      {view === 'kanban' && (
        <KanbanBoard tasks={tasks} onTaskClick={handleTaskClick} />
      )}
      {view === 'assignee-kanban' && (
        <AssigneeKanbanBoard 
          tasks={tasks} 
          onTaskClick={handleTaskClick}
          projectMembers={projectMembers}
        />
      )}
      {view === 'dashboard' && (
        <ProjectDashboard projectId={projectId} projectName={project?.name || 'Project'} />
      )}
      {view === 'reports' && (
        <ReportsList projectId={projectId} refreshTrigger={reportsRefreshTrigger} />
      )}
      {view === 'generate-report' && (
        <GenerateReportForm
          projectName={project?.name || 'Project'}
          onGenerate={async (config) => {
            try {
              const response = await fetch(`/api/projects/${projectId}/reports`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate report');
              }

              if (config.format === 'pdf') {
                // Download PDF
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${project?.name || 'Project'}_${config.reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                showSuccess('Report generated and downloaded successfully!');
              } else {
                // Handle slideshow - redirect to report page
                const data = await response.json();
                if (data.reportId && data.url) {
                  showSuccess('Report generated successfully!');
                  // Open in new tab for client sharing
                  window.open(data.url, '_blank');
                  // Refresh reports list and switch to reports view
                  setReportsRefreshTrigger(prev => prev + 1);
                  setView('reports');
                } else {
                  throw new Error('Failed to generate report URL');
                }
              }
            } catch (err) {
              throw err; // Let form handle the error display
            }
          }}
        />
      )}

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        open={sheetOpen}
        task={selectedTask}
        projectId={projectId}
        currentUserId={currentUserId}
        projectMembers={projectMembers}
        allTasks={tasks}
        phaseNames={phaseNames}
        onClose={() => {
          setSheetOpen(false);
          setSelectedTask(null);
        }}
        onSave={handleTaskSave}
        onDelete={selectedTask?.id ? handleTaskDelete : undefined}
      />

      {/* Task Generator Modal */}
      <TaskGeneratorModal
        open={taskGeneratorOpen}
        onClose={() => setTaskGeneratorOpen(false)}
        onPreviewGenerated={(tasks, summary) => {
          setPreviewTasks(tasks);
          setPreviewSummary(summary);
          setShowPreview(true);
          setTaskGeneratorOpen(false);
        }}
        projectId={projectId}
      />
    </Container>
    </>
  );
}


