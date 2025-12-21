import { useState } from 'react';
import { Box, Button, Typography, Paper, Chip, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Assignment as AssignmentIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  EmojiObjects as EmojiObjectsIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { ConversationAction } from '@/types/workspace';

interface ActionCardProps {
  action: ConversationAction;
  onConfirm: () => Promise<void>;
  onReject: () => void;
  teamMembers?: Array<{ user_id: string; name: string | null; email: string; role: string }>;
}

export default function ActionCard({ action, onConfirm, onReject, teamMembers = [] }: ActionCardProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve assignee name if action is create_task
  const getAssigneeName = (assigneeId: string | undefined) => {
    if (!assigneeId || !teamMembers.length) return null;
    const member = teamMembers.find((m) => m.user_id === assigneeId);
    return member ? (member.name || member.email) : null;
  };

  // Render action preview
  const renderPreview = (): React.ReactNode => {
    if (action.type === 'create_task') {
      const assigneeName = action.data.assignee_id ? getAssigneeName(String(action.data.assignee_id)) : null;
      const chips = [];
      
      // Phase chip
      if (action.data.phase_number) {
        chips.push(
          <Chip 
            key="phase" 
            label={`Phase ${action.data.phase_number}`} 
            size="small" 
            color="secondary"
          />
        );
      }
      
      // Priority chip
      if (action.data.priority) {
        chips.push(<Chip key="priority" label={`Priority: ${action.data.priority}`} size="small" />);
      }
      
      // Estimated hours chip
      if (action.data.estimated_hours) {
        chips.push(<Chip key="hours" label={`${action.data.estimated_hours}h`} size="small" />);
      }
      
      // Assignee chip
      if (assigneeName) {
        chips.push(
          <Chip
            key="assignee"
            label={`Assignee: ${assigneeName}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        );
      }
      
      // Date range chip
      if (action.data.start_date || action.data.due_date) {
        const dateLabel = action.data.start_date && action.data.due_date 
          ? `${action.data.start_date} → ${action.data.due_date}`
          : action.data.due_date 
            ? `Due: ${action.data.due_date}` 
            : `Start: ${action.data.start_date}`;
        chips.push(
          <Chip 
            key="dates" 
            label={dateLabel} 
            size="small" 
            variant="outlined"
            sx={{ borderColor: theme.palette.info.main, color: theme.palette.info.main }}
          />
        );
      }
      
      return (
        <>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            {String(action.data.title || 'Untitled Task')}
          </Typography>
          {action.data.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {String(action.data.description)}
            </Typography>
          )}
          {chips.length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              {chips}
            </Box>
          )}
          {action.data.tags && Array.isArray(action.data.tags) && action.data.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(action.data.tags as string[]).map((tag, idx) => (
                <Chip key={idx} label={tag} size="small" variant="outlined" />
              ))}
            </Box>
          )}
        </>
      );
    }

    // Fallback for other action types
    return (
      <>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>Preview:</strong>
        </Typography>
        <Box
          component="pre"
          sx={{
            p: 2,
            backgroundColor: theme.palette.background.default,
            borderRadius: 1,
            overflow: 'auto',
            fontSize: '0.75rem',
          }}
        >
          {JSON.stringify(action.data, null, 2)}
        </Box>
      </>
    );
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  const actionConfig = {
    create_task: {
      icon: <AssignmentIcon />,
      label: 'Create Task',
      color: theme.palette.primary.main,
    },
    log_decision: {
      icon: <EmojiObjectsIcon />,
      label: 'Log Decision',
      color: theme.palette.warning.main,
    },
    log_debt: {
      icon: <WarningIcon />,
      label: 'Log Debt',
      color: theme.palette.error.main,
    },
    update_spec: {
      icon: <CheckCircleIcon />,
      label: 'Update Spec',
      color: theme.palette.success.main,
    },
  };

  const config = actionConfig[action.type] || actionConfig.create_task;

  // Show different UI based on status
  if (action.status === 'executed') {
    return (
      <Paper
        sx={{
          p: 2,
          border: `1px solid ${theme.palette.success.main}`,
          backgroundColor: theme.palette.success.light + '10',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: theme.palette.success.main }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Action completed: {config.label}
          </Typography>
        </Box>
        {action.result && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {JSON.stringify(action.result)}
          </Typography>
        )}
      </Paper>
    );
  }

  if (action.status === 'rejected') {
    return (
      <Paper
        sx={{
          p: 2,
          border: `1px solid ${theme.palette.divider}`,
          opacity: 0.6,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Action rejected: {config.label}
        </Typography>
      </Paper>
    );
  }

  // Suggested or confirmed state
  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        border: `2px solid ${config.color}`,
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        {config.icon}
        <Chip
          label={config.label}
          size="small"
          sx={{
            backgroundColor: config.color,
            color: 'white',
            fontWeight: 600,
          }}
        />
        {action.status === 'confirmed' && (
          <Chip label="Confirmed" size="small" color="success" />
        )}
      </Box>

      {/* Action preview */}
      <Box sx={{ mb: 2 }}>{renderPreview()}</Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {action.status === 'suggested' && (
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CancelIcon />}
            onClick={onReject}
            disabled={loading}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<CheckCircleIcon />}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Confirm & Execute'}
          </Button>
        </Box>
      )}
    </Paper>
  );
}
