'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { formatDistanceToNow, format } from 'date-fns';
import type { WorkflowRun, WorkflowRunStatus } from '@/types/workflows';

interface WorkflowRunHistoryProps {
  workflowId: string;
}

const statusConfig: Record<
  WorkflowRunStatus,
  { label: string; color: 'success' | 'error' | 'warning' | 'info' | 'default' }
> = {
  running: { label: 'Running', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  failed: { label: 'Failed', color: 'error' },
  cancelled: { label: 'Cancelled', color: 'default' },
  paused: { label: 'Paused', color: 'warning' },
};

export default function WorkflowRunHistory({ workflowId }: WorkflowRunHistoryProps) {
  const theme = useTheme();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workflows/${workflowId}/runs`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load runs');
      }

      const data = await response.json();
      setRuns(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  const formatFullDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'PPpp');
    } catch {
      return '-';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Run History</Typography>
        <Button startIcon={<RefreshIcon />} onClick={loadRuns} size="small">
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {runs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No workflow runs yet. Activate the workflow and trigger it to see execution history.
          </Typography>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: theme.palette.mode === 'dark' ? 'background.paper' : 'white',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 50 }} />
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Trigger</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Steps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {runs.map((run) => (
                <RunRow
                  key={run.id}
                  run={run}
                  isExpanded={expandedRun === run.id}
                  onToggle={() =>
                    setExpandedRun((prev) => (prev === run.id ? null : run.id))
                  }
                  formatDate={formatDate}
                  formatFullDate={formatFullDate}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

function RunRow({
  run,
  isExpanded,
  onToggle,
  formatDate,
  formatFullDate,
}: {
  run: WorkflowRun;
  isExpanded: boolean;
  onToggle: () => void;
  formatDate: (date: string | null) => string;
  formatFullDate: (date: string | null) => string;
}) {
  const theme = useTheme();
  const config = statusConfig[run.status] || statusConfig.running;

  const getDuration = () => {
    if (!run.started_at) return '-';
    const start = new Date(run.started_at).getTime();
    const end = run.completed_at ? new Date(run.completed_at).getTime() : Date.now();
    const ms = end - start;

    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={onToggle}>
            {isExpanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip label={config.label} color={config.color} size="small" />
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
            {run.trigger_type}
          </Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{formatDate(run.started_at)}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{getDuration()}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2">{run.current_step}</Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Run Details
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 2,
                  mb: 2,
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Run ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {run.id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Started At
                  </Typography>
                  <Typography variant="body2">{formatFullDate(run.started_at)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Completed At
                  </Typography>
                  <Typography variant="body2">{formatFullDate(run.completed_at)}</Typography>
                </Box>
              </Box>

              {run.error_message && (
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: theme.palette.error.main + '15',
                    borderRadius: 1,
                    mb: 2,
                  }}
                >
                  <Typography variant="subtitle2" color="error">
                    Error Message
                  </Typography>
                  <Typography variant="body2">{run.error_message}</Typography>
                </Box>
              )}

              {run.trigger_data && Object.keys(run.trigger_data).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Trigger Data
                  </Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 1.5,
                      backgroundColor:
                        theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.75rem',
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(run.trigger_data, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

