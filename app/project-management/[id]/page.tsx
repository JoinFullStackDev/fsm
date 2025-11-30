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
import { NavigateNext as NavigateNextIcon, Refresh as RefreshIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import TaskTable from '@/components/project-management/TaskTable';
import TaskDetailSheet from '@/components/project-management/TaskDetailSheet';
import ViewToggle, { type ViewType } from '@/components/project-management/ViewToggle';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import GanttChart from '@/components/project-management/GanttChart';
import KanbanBoard from '@/components/project-management/KanbanBoard';
import GenerateReportForm, { type ReportType, type ReportFormat } from '@/components/project-management/GenerateReportForm';
import ReportsList from '@/components/project-management/ReportsList';
import TaskGeneratorModal from '@/components/project-management/TaskGeneratorModal';
import TaskPreviewTable from '@/components/project-management/TaskPreviewTable';
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

  const loadTasks = useCallback(async () => {
    // Load tasks with assignee info and include subtasks
    console.log(`[Task Management] Loading tasks for project: ${projectId}`);
    const { data: tasksData, error: tasksError } = await supabase
      .from('project_tasks')
      .select(`
        *,
        assignee:users!project_tasks_assignee_id_fkey(id, name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (tasksError) {
      console.error('[Task Management] Error loading tasks:', tasksError);
      setError(tasksError.message);
      return [];
    } else {
      console.log(`[Task Management] Loaded ${tasksData?.length || 0} tasks for project ${projectId}`);
      // Transform tasks to include assignee info
      const transformedTasks = (tasksData || []).map((task: any) => ({
        ...task,
        assignee: task.assignee || null,
      }));
      return transformedTasks as (ProjectTask | ProjectTaskExtended)[];
    }
  }, [projectId, supabase]);

  const loadData = useCallback(async () => {
      setLoading(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        setError('Session not found. Please try signing in again.');
        setLoading(false);
        return;
      }

      // Get user record
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', session.user.id)
        .single();

      if (userError || !userData) {
        setError('Failed to load user data');
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.id);

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError || !projectData) {
        setError('Project not found');
        setLoading(false);
        return;
      }

      setProject(projectData as Project);

      // Load tasks
      const loadedTasks = await loadTasks();
      setTasks(loadedTasks);

      // Load project phases for phase names
      const { data: phasesData, error: phasesError } = await supabase
        .from('project_phases')
        .select('phase_number, phase_name')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      // Create phase names map
      const phaseNamesMap: Record<number, string> = {};
      if (!phasesError && phasesData) {
        phasesData.forEach((phase: { phase_number: number; phase_name: string }) => {
          phaseNamesMap[phase.phase_number] = phase.phase_name;
        });
      }
      setPhaseNames(phaseNamesMap);

      // Load project members
      const { data: membersData, error: membersError } = await supabase
        .from('project_members')
        .select('user_id, users(id, name, email, avatar_url)')
        .eq('project_id', projectId);

      if (!membersError && membersData) {
        const members = membersData
          .map((m: any) => m.users)
          .filter(Boolean)
          .map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            avatar_url: u.avatar_url,
            role: 'pm' as const,
            auth_id: '',
            created_at: '',
          }));
        setProjectMembers(members);
      } else {
        // If no project members found, set empty array
        setProjectMembers([]);
      }

      setLoading(false);
    }, [projectId, supabase, loadTasks]);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId, loadData]);

  // Poll for tasks if project is initiated but no tasks are loaded yet
  // This handles the case where tasks are being created asynchronously
  useEffect(() => {
    if (!project || !project.initiated_at || tasks.length > 0 || loading) {
      return;
    }

    // If project is initiated but no tasks, wait a bit and check again
    const checkForTasks = async () => {
      const loadedTasks = await loadTasks();
      if (loadedTasks.length > 0) {
        setTasks(loadedTasks);
      } else {
        // Retry after 2 seconds if still no tasks
        setTimeout(checkForTasks, 2000);
      }
    };

    // Initial delay to allow tasks to be inserted
    const timeoutId = setTimeout(checkForTasks, 2000);
    
    // Stop polling after 10 seconds
    const maxTimeoutId = setTimeout(() => {
      // Final check
      loadTasks().then(loadedTasks => {
        if (loadedTasks.length > 0) {
          setTasks(loadedTasks);
        }
      });
    }, 10000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(maxTimeoutId);
    };
  }, [project, tasks.length, loading, loadTasks]);

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
    setAnalyzing(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze project');
      }

      // Reload tasks
      const loadedTasks = await loadTasks();
      setTasks(loadedTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze project');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
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
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4, px: '15px' }}>
      {/* Breadcrumbs */}
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize="small" sx={{ color: theme.palette.text.secondary }} />}
        sx={{ mb: 3 }}
      >
        <Link
          component="button"
          variant="body1"
          onClick={() => router.push('/project-management')}
          sx={{ color: theme.palette.text.primary, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Project Management
        </Link>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          {project?.name || 'Project'}
        </Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            fontWeight: 600,
            fontSize: '1.5rem',
            color: theme.palette.text.primary,
          }}
        >
          {project?.name || 'Project'} - Task Management
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {features?.ai_task_generator_enabled && (
            <Button
              variant="contained"
              startIcon={<AutoAwesomeIcon />}
              onClick={() => setTaskGeneratorOpen(true)}
              size="small"
              sx={{
                height: '32px',
                minHeight: '32px',
                backgroundColor: 'primary.main',
                color: '#000',
                fontSize: '0.75rem',
                '&:hover': {
                  backgroundColor: 'primary.light',
                },
              }}
            >
              Generate Tasks
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleReAnalyze}
            disabled={analyzing}
            size="small"
            sx={{
              height: '32px',
              minHeight: '32px',
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              fontSize: '0.75rem',
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
          onInject={async (selectedTasks, merges) => {
            try {
              const response = await fetch(`/api/projects/${projectId}/generate-tasks/inject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tasks: selectedTasks.map((t) => ({
                    task: t,
                    selected: true,
                  })),
                  merges,
                }),
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to inject tasks');
              }

              const result = await response.json();
              showSuccess(`Successfully created ${result.created} tasks and merged ${result.merged} tasks!`);

              // Reload tasks
              const loadedTasks = await loadTasks();
              setTasks(loadedTasks);

              // Close preview
              setShowPreview(false);
              setPreviewTasks([]);
              setPreviewSummary(undefined);
            } catch (err) {
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
  );
}


