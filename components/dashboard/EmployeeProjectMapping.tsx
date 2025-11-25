'use client';

import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { format, parseISO } from 'date-fns';
import type { Project } from '@/types/project';
import type { ProjectTask } from '@/types/project';
import type { User, UserRole } from '@/types/project';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';

interface EmployeeProjectMappingProps {
  projects: Project[];
  tasks: ProjectTask[];
  users: User[];
  projectMembers: Array<{ project_id: string; user_id: string; user: User }>;
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
          role: (pm as any).role,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return '#00FF88';
      case 'in_progress':
        return '#00E5FF';
      case 'todo':
        return '#B0B0B0';
      default:
        return '#B0B0B0';
    }
  };

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

  // Personal task view
  const renderPersonalTaskView = () => {
    if (!currentUserId) return null;

    const filteredTasks = selectedProjectId === 'all' 
      ? currentUserTasks 
      : currentUserTasks.filter((t) => t.project_id === selectedProjectId);

    return (
      <TableContainer>
          <Table>
            <TableHead sx={{ backgroundColor: '#0A0E27' }}>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.3)' }}>
                  Task
                </TableCell>
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.3)' }}>
                  Project
                </TableCell>
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.3)', textAlign: 'center' }}>
                  Status
                </TableCell>
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.3)', textAlign: 'center' }}>
                  Priority
                </TableCell>
                <TableCell sx={{ backgroundColor: '#0A0E27', color: '#00E5FF', fontWeight: 600, borderBottom: '2px solid rgba(0, 229, 255, 0.3)' }}>
                  Due Date
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#B0B0B0' }}>
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const project = projects.find((p) => p.id === task.project_id);
                  return (
                    <TableRow
                      key={task.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: 'rgba(0, 229, 255, 0.05)',
                        },
                      }}
                    >
                      <TableCell sx={{ color: '#E0E0E0' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {task.title}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#E0E0E0' }}>
                        {project?.name || 'Unknown Project'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={task.status === 'done' ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : 'To Do'}
                          size="small"
                          sx={{
                            backgroundColor: `${getStatusColor(task.status)}20`,
                            color: getStatusColor(task.status),
                            border: `1px solid ${getStatusColor(task.status)}40`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={task.priority || 'Medium'}
                          size="small"
                          sx={{
                            backgroundColor: `${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF'}20`,
                            color: PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF',
                            border: `1px solid ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || '#00E5FF'}40`,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#E0E0E0' }}>
                        {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
    );
  };

  return (
    <Paper
      sx={{
        backgroundColor: '#121633',
        border: '1px solid rgba(0, 229, 255, 0.2)',
        borderRadius: 2,
        p: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h6"
          sx={{
            color: '#00E5FF',
            fontWeight: 600,
          }}
        >
          {showPersonalView ? 'My Tasks' : 'Team Member Project Assignments'}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {isAdminOrPM && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: '#B0B0B0' }}>View</InputLabel>
              <Select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'team' | 'personal')}
                label="View"
                sx={{
                  color: '#E0E0E0',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 229, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 229, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00E5FF',
                  },
                }}
              >
                <MenuItem value="team">Team View</MenuItem>
                <MenuItem value="personal">My Tasks</MenuItem>
              </Select>
            </FormControl>
          )}
          {showPersonalView && currentUserProjects.length > 1 && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel sx={{ color: '#B0B0B0' }}>Project</InputLabel>
              <Select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                label="Project"
                sx={{
                  color: '#E0E0E0',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 229, 255, 0.3)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(0, 229, 255, 0.5)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#00E5FF',
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
        renderPersonalTaskView()
      ) : (
        <TableContainer>
        <Table>
          <TableHead sx={{ backgroundColor: '#0A0E27' }}>
            <TableRow>
              <TableCell
                sx={{
                  backgroundColor: '#0A0E27',
                  color: '#00E5FF',
                  fontWeight: 600,
                  borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                }}
              >
                Team Member
              </TableCell>
              <TableCell
                sx={{
                  backgroundColor: '#0A0E27',
                  color: '#00E5FF',
                  fontWeight: 600,
                  borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                }}
              >
                Projects
              </TableCell>
              <TableCell
                sx={{
                  backgroundColor: '#0A0E27',
                  color: '#00E5FF',
                  fontWeight: 600,
                  borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  textAlign: 'center',
                }}
              >
                Total Tasks
              </TableCell>
              <TableCell
                sx={{
                  backgroundColor: '#0A0E27',
                  color: '#00E5FF',
                  fontWeight: 600,
                  borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  textAlign: 'center',
                }}
              >
                In Progress
              </TableCell>
              <TableCell
                sx={{
                  backgroundColor: '#0A0E27',
                  color: '#00E5FF',
                  fontWeight: 600,
                  borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  textAlign: 'center',
                }}
              >
                Completed
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employeeMapping.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: '#B0B0B0' }}>
                  No team member assignments found
                </TableCell>
              </TableRow>
            ) : (
              employeeMapping.map((employee) => (
                <TableRow
                  key={employee.user.id}
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    },
                  }}
                >
                  <TableCell sx={{ color: '#E0E0E0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar
                        src={employee.user.avatar_url || undefined}
                        sx={{
                          width: 40,
                          height: 40,
                          bgcolor: '#00E5FF',
                          color: '#000',
                        }}
                      >
                        {getInitials(employee.user.name, employee.user.email)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#E0E0E0', fontWeight: 500 }}>
                          {employee.user.name || employee.user.email || 'Unknown User'}
                        </Typography>
                        {employee.user.role && (
                          <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
                            {employee.user.role}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#E0E0E0' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {employee.projects.map(({ project, tasks: projectTasks, role }) => (
                        <Tooltip
                          key={project.id}
                          title={`${project.name} - ${projectTasks.length} task${projectTasks.length !== 1 ? 's' : ''}${role ? ` (${role})` : ''}`}
                        >
                          <Chip
                            label={project.name}
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(0, 229, 255, 0.15)',
                              color: '#00E5FF',
                              border: '1px solid rgba(0, 229, 255, 0.3)',
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
                  </TableCell>
                  <TableCell align="center" sx={{ color: '#E0E0E0', fontWeight: 600 }}>
                    {employee.totalTasks}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={employee.inProgressTasks}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 229, 255, 0.15)',
                        color: '#00E5FF',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={employee.completedTasks}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 255, 136, 0.15)',
                        color: '#00FF88',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Paper>
  );
}

