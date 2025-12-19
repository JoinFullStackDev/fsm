'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Link from 'next/link';
import {
  PlayArrow as TestIcon,
  PowerSettingsNew as ActivateIcon,
} from '@mui/icons-material';
import WorkflowBuilder from '@/components/workflows/WorkflowBuilder';
import WorkflowRunHistory from '@/components/workflows/WorkflowRunHistory';
import type { Workflow, WorkflowStep } from '@/types/workflows';

export default function EditWorkflowPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const theme = useTheme();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<(Workflow & { steps: WorkflowStep[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);

  const initialTab = searchParams.get('tab') === 'runs' ? 1 : 0;
  const [tabIndex, setTabIndex] = useState(initialTab);

  const loadWorkflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workflows/${workflowId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load workflow');
      }

      const data = await response.json();
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    try {
      setSaving(true);
      setError(null);

      console.log('[EditWorkflowPage] ========== SUBMITTING WORKFLOW UPDATE ==========');
      console.log('[EditWorkflowPage] Workflow ID:', workflowId);
      console.log('[EditWorkflowPage] Full data object:', JSON.stringify(data, null, 2));
      console.log('[EditWorkflowPage] Steps count:', (data.steps as any[])?.length || 0);
      console.log('[EditWorkflowPage] Steps:', data.steps);

      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update workflow');
      }

      const updated = await response.json();
      setWorkflow(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!workflow) return;

    try {
      setError(null);

      const response = await fetch(`/api/workflows/${workflowId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !workflow.is_active }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to toggle workflow status');
      }

      setWorkflow((prev) => (prev ? { ...prev, is_active: !prev.is_active } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle workflow status');
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      setError(null);

      const response = await fetch(`/api/workflows/${workflowId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const result = await response.json();
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test workflow');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!workflow) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Workflow not found</Alert>
      </Box>
    );
  }

  // If viewing run history, show traditional layout
  if (tabIndex === 1) {
    return (
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <MuiLink component={Link} href="/workflows" color="inherit" underline="hover">
            Workflows
          </MuiLink>
          <Typography color="text.primary">{workflow.name}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {workflow.name} - Run History
          </Typography>
          <Button variant="outlined" onClick={() => setTabIndex(0)}>
            Back to Editor
          </Button>
        </Box>

        <WorkflowRunHistory workflowId={workflowId} />
      </Box>
    );
  }

  // Full-screen workflow builder
  return (
    <WorkflowBuilder
      mode="edit"
      initialData={{
        name: workflow.name,
        description: workflow.description,
        trigger_type: workflow.trigger_type,
        trigger_config: workflow.trigger_config as Record<string, unknown>,
        steps: workflow.steps || [],
      }}
      onSubmit={handleSubmit}
      onCancel={() => router.push('/workflows')}
      loading={saving}
      error={error}
    />
  );
}

