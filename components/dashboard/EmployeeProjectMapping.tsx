'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Chip,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { format, parseISO } from 'date-fns';
import type { Project } from '@/types/project';
import type { ProjectTask } from '@/types/project';
import type { User, UserRole } from '@/types/project';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';
import SortableTable from '@/components/dashboard/SortableTable';

interface EmployeeProjectMappingProps {
  projects: Project[];
  tasks: ProjectTask[];
  users: User[];
  projectMembers: Array<{ project_id: string; user_id: string; user: User; role?: string }>;
  currentUserId: string | null;
  currentUserRole: UserRole | null;
}

export default function EmployeeProjectMapping({
  projects,
  tasks,
  users,
  projectMembers,
  currentUserId,
  currentUserRole,
}: EmployeeProjectMappingProps) {
  const theme = useTheme();
  const [viewMode, setViewMode] = useState<'team' | 'personal'>('team');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

  const isAdminOrPM = currentUserRole === 'admin' || currentUserRole === 'pm';
  const showPersonalView = !isAdminOrPM || viewMode === 'personal';
  // Create mapping of users to their projects and tasks
  const employeeMapping = useMemo(() => {
    const mapping: Record<
      string,
      {
        user: User;
        projects: Array<{ project: Project; tasks: ProjectTask[]; role?: string }>;
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
      }
    > = {};

    // Initialize all users
    users.forEach((user) => {
      mapping[user.id] = {
        user,
        projects: [],
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
      };
    });

    // Map project members
    projectMembers.forEach((pm) => {
      const project = projects.find((p) => p.id === pm.project_id);
      if (project && mapping[pm.user_id]) {
        const userTasks = tasks.filter(
          (t) => t.project_id === project.id && t.assignee_id === pm.user_id
        );
        mapping[pm.user_id].projects.push({
          project,
          tasks: userTasks,
          role: pm.role,
        });
        mapping[pm.user_id].totalTasks += userTasks.length;
        mapping[pm.user_id].completedTasks += userTasks.filter((t) => t.status === 'done').length;
        mapping[pm.user_id].inProgressTasks += userTasks.filter(
          (t) => t.status === 'in_progress'
        ).length;
      }
    });

    // Also include tasks assigned to users even if they're not project members
    tasks.forEach((task) => {
      if (task.assignee_id && mapping[task.assignee_id]) {
        const project = projects.find((p) => p.id === task.project_id);
        if (project) {
          const existingProject = mapping[task.assignee_id].projects.find(
            (p) => p.project.id === project.id
          );
          if (!existingProject) {
            const userTasks = tasks.filter(
              (t) => t.project_id === project.id && t.assignee_id === task.assignee_id
            );
            mapping[task.assignee_id].projects.push({
              project,
              tasks: userTasks,
            });
            mapping[task.assignee_id].totalTasks += userTasks.length;
            mapping[task.assignee_id].completedTasks += userTasks.filter(
              (t) => t.status === 'done'
            ).length;
            mapping[task.assignee_id].inProgressTasks += userTasks.filter(
              (t) => t.status === 'in_progress'
            ).length;
          }
        }
      }
    });

    return Object.values(mapping).filter((emp) => emp.projects.length > 0 || emp.totalTasks > 0);
  }, [projects, tasks, users, projectMembers]);

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'done':
        return '#4CAF50';
      case 'in_progress':
        return theme.palette.text.primary;
      case 'todo':
        return theme.palette.text.secondary;
      default:
        return theme.palette.text.secondary;
    }
  }, [theme]);

  // Get current user's tasks
  const currentUserTasks = useMemo(() => {
    if (!currentUserId) return [];
    let userTasks = tasks.filter((task) => task.assignee_id === currentUserId);
    
    if (selectedProjectId !== 'all') {
      userTasks = userTasks.filter((task) => task.project_id === selectedProjectId);
    }
    
    return userTasks;
  }, [tasks, currentUserId, selectedProjectId]);

  // Get current user's projects
  const currentUserProjects = useMemo(() => {
    if (!currentUserId) return [];
    const userProjectIds = new Set(
      projectMembers
        .filter((pm) => pm.user_id === currentUserId)
        .map((pm) => pm.project_id)
    );
    return projects.filter((p) => userProjectIds.has(p.id));
  }, [projects, projectMembers, currentUserId]);

  // Personal task view columns
  const personalTaskColumns = useMemo(() => {
    const filteredTasks = selectedProjectId === 'all' 
      ? currentUserTasks 
      : currentUserTasks.filter((t) => t.project_id === selectedProjectId);

    return [
      {
        key: 'title',
        label: 'Task',
        sortable: true,
      },
      {
        key: 'project',
        label: 'Project',
        sortable: false,
        render: (_: unknown, row: ProjectTask) => {
          const project = projects.find((p) => p.id === row.project_id);
          return project?.name || 'Unknown Project';
        },
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        align: 'center' as const,
        render: (val: unknown) => {
          const value = val as string;
          return (
            <Chip
              label={value === 'done' ? 'Completed' : value === 'in_progress' ? 'In Progress' : 'To Do'}
              size="small"
              sx={{
                backgroundColor: theme.palette.action.hover,
                color: getStatusColor(value),
                border: `1px solid ${theme.palette.divider}`,
                fontWeight: 500,
              }}
            />
          );
        },
      },
      {
        key: 'priority',
        label: 'Priority',
        sortable: true,
        align: 'center' as const,
        render: (val: unknown) => {
          const value = val as string;
          return (
            <Chip
              label={value || 'Medium'}
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
        key: 'due_date',
        label: 'Due Date',
        sortable: true,
        render: (val: unknown) => {
          const value = val as string | null;
          return value ? format(parseISO(value), 'MMM d, yyyy') : '-';
        },
      },
    ];
  }, [currentUserTasks, selectedProjectId, projects, theme, getStatusColor]);

  // Team view columns
  const teamColumns = useMemo(() => {
    type EmployeeMappingItem = {
      user: User;
      projects: Array<{ project: Project; tasks: ProjectTask[]; role?: string }>;
      totalTasks: number;
      completedTasks: number;
      inProgressTasks: number;
    };

    return [
    {
      key: 'user',
      label: 'Team Member',
      sortable: true,
      render: (_: unknown, row: EmployeeMappingItem) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar
            src={row.user.avatar_url || undefined}
            sx={{
              width: 40,
              height: 40,
              bgcolor: theme.palette.text.primary,
              color: theme.palette.background.default,
            }}
          >
            {getInitials(row.user.name, row.user.email)}
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ color: theme.palette.text.primary, fontWeight: 500 }}>
              {row.user.name || row.user.email || 'Unknown User'}
            </Typography>
            {row.user.role && (
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {row.user.role}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      key: 'projects',
      label: 'Projects',
      sortable: false,
      render: (_: unknown, row: EmployeeMappingItem) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {row.projects.map(({ project, tasks: projectTasks, role }) => (
            <Tooltip
              key={project.id}
              title={`${project.name} - ${projectTasks.length} task${projectTasks.length !== 1 ? 's' : ''}${role ? ` (${role})` : ''}`}
            >
              <Chip
                label={project.name}
                size="small"
                sx={{
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                  border: `1px solid ${theme.palette.divider}`,
                  maxWidth: 200,
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            </Tooltip>
          ))}
        </Box>
      ),
    },
    {
      key: 'totalTasks',
      label: 'Total Tasks',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return (
          <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {value}
          </Typography>
        );
      },
    },
    {
      key: 'inProgressTasks',
      label: 'In Progress',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return (
          <Chip
            label={value}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              fontWeight: 600,
            }}
          />
        );
      },
    },
    {
      key: 'completedTasks',
      label: 'Completed',
      sortable: true,
      align: 'center' as const,
      render: (val: unknown) => {
        const value = val as number;
        return (
          <Chip
            label={value}
            size="small"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: '#4CAF50',
              border: `1px solid ${theme.palette.divider}`,
              fontWeight: 600,
            }}
          />
        );
      },
    },
    ];
  }, [theme]);

  const filteredTasks = selectedProjectId === 'all' 
    ? currentUserTasks 
    : currentUserTasks.filter((t) => t.project_id === selectedProjectId);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: { xs: 2, md: 0 } }}>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontSize: { xs: '1rem', md: '1.25rem' },
          }}
        >
          {showPersonalView ? 'My Tasks' : 'Team Member Project Assignments'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, width: { xs: '100%', md: 'auto' } }}>
          {isAdminOrPM && (
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 200 }, width: { xs: '100%', md: 'auto' } }}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>View</InputLabel>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'team' | 'personal')}
                label="View"
                sx={{
                  color: theme.palette.text.primary,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.primary,
                  },
                }}
              >
                <MenuItem value="team">Team View</MenuItem>
                <MenuItem value="personal">My Tasks</MenuItem>
              </Select>
            </FormControl>
          )}
          {showPersonalView && currentUserProjects.length > 1 && (
            <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 200 }, width: { xs: '100%', md: 'auto' } }}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Project</InputLabel>
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                label="Project"
                sx={{
                  color: theme.palette.text.primary,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.divider,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.secondary,
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.text.primary,
                  },
                }}
              >
                <MenuItem value="all">All Projects</MenuItem>
                {currentUserProjects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </Box>

      {showPersonalView ? (
        <SortableTable
          data={filteredTasks}
          columns={personalTaskColumns}
          emptyMessage="No tasks found"
        />
      ) : (
        <SortableTable
          data={employeeMapping}
          columns={teamColumns}
          emptyMessage="No team member assignments found"
        />
      )}
    </Box>
  );
}

