'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
} from '@mui/icons-material';
import WorkflowList from '@/components/workflows/WorkflowList';
import type { Workflow } from '@/types/workflows';

export default function WorkflowsPage() {
  const router = useRouter();
  const theme = useTheme();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/workflows');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load workflows');
      }

      const data = await response.json();
      setWorkflows(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleToggleActive = async (workflowId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update workflow');
      }

      // Update local state
      setWorkflows(prev =>
        prev.map(w => (w.id === workflowId ? { ...w, is_active: isActive } : w))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
    }
  };

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete workflow');
      }

      // Update local state
      setWorkflows(prev => prev.filter(w => w.id !== workflowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              color: theme.palette.mode === 'dark' ? 'primary.main' : 'text.primary',
              fontWeight: 700,
            }}
          >
            Workflow Automations
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Create automated workflows triggered by events, schedules, or webhooks
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => router.push('/workflows/new')}
          sx={{
            backgroundColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          New Workflow
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : workflows.length === 0 ? (
        <Paper
          sx={{
            p: 6,
            textAlign: 'center',
            backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'grey.50',
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No workflows yet
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Create your first workflow to automate tasks and notifications
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/workflows/new')}
          >
            Create Workflow
          </Button>
        </Paper>
      ) : (
        <WorkflowList
          workflows={workflows}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
          onEdit={(id) => router.push(`/workflows/${id}`)}
          onViewRuns={(id) => router.push(`/workflows/${id}?tab=runs`)}
        />
      )}
    </Box>
  );
}

