'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { OpsTaskWithRelations, CompanyContact } from '@/types/ops';
import SortableTable from '@/components/dashboard/SortableTable';
import TaskDialog from './TaskDialog';

interface CompanyTasksTabProps {
  companyId: string;
}

export default function CompanyTasksTab({ companyId }: CompanyTasksTabProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [tasks, setTasks] = useState<OpsTaskWithRelations[]>([]);
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<OpsTaskWithRelations | null>(null);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/companies/${companyId}/tasks`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load tasks');
      }

      const data = await response.json();
      setTasks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadContacts = useCallback(async () => {
    try {
      const response = await fetch(`/api/ops/companies/${companyId}/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (err) {
      // Ignore errors, just proceed without contacts
    }
  }, [companyId]);

  useEffect(() => {
    loadTasks();
    loadContacts();
  }, [loadTasks, loadContacts]);

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: OpsTaskWithRelations, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleTaskDialogClose = () => {
    setTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleTaskSuccess = () => {
    loadTasks();
  };

  const handleDeleteTask = async (task: OpsTaskWithRelations, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ops/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }

      showSuccess('Task deleted successfully');
      loadTasks();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task';
      showError(errorMessage);
    }
  };

  const columns = [
    {
      key: 'title',
      label: 'Task',
      sortable: true,
    },
    {
      key: 'contact',
      label: 'Contact',
      sortable: false,
      render: (val: unknown) => {
        const value = val as CompanyContact | null;
        return value ? `${value.first_name} ${value.last_name}` : '-';
      },
    },
    {
      key: 'assigned_user',
      label: 'Assigned To',
      sortable: false,
      render: (val: unknown) => {
        const value = val as { name?: string | null; email?: string } | null;
        return value ? value.name || value.email : '-';
      },
    },
    {
      key: 'due_date',
      label: 'Due Date',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string | null;
        return value ? new Date(value).toLocaleDateString() : '-';
      },
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (val: unknown) => {
        const value = val as string;
        return new Date(value).toLocaleDateString();
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right' as const,
      render: (_: unknown, row: OpsTaskWithRelations) => (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <IconButton
            size="small"
            onClick={(e) => handleEditTask(row, e)}
            sx={{ color: theme.palette.text.primary }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => handleDeleteTask(row, e)}
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
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 3, gap: { xs: 2, md: 0 } }}>
        <Typography
          variant="h6"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
          }}
        >
          Tasks
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleCreateTask}
          fullWidth={false}
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            fontWeight: 600,
            width: { xs: '100%', md: 'auto' },
            '&:hover': {
              borderColor: theme.palette.text.secondary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Add Task
        </Button>
      </Box>

      {tasks.length === 0 ? (
        <Alert severity="info">
          No tasks yet. Add a task to get started.
        </Alert>
      ) : (
        <SortableTable
          data={tasks}
          columns={columns}
          emptyMessage="No tasks found"
        />
      )}

      <TaskDialog
        open={taskDialogOpen}
        onClose={handleTaskDialogClose}
        onSuccess={handleTaskSuccess}
        companyId={companyId}
        task={editingTask}
        contacts={contacts}
      />
    </Box>
  );
}

