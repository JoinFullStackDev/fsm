'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, AutoAwesome as AutoAwesomeIcon, Warning as WarningIcon } from '@mui/icons-material';
import type { PreviewTask } from '@/types/taskGenerator';
import type { ScopeOfWork, SOWMemberWithStats } from '@/types/project';
import BuildingOverlay from '@/components/ai/BuildingOverlay';

interface TaskGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  onPreviewGenerated: (tasks: PreviewTask[], summary?: string) => void;
  projectId: string;
}

export default function TaskGeneratorModal({
  open,
  onClose,
  onPreviewGenerated,
  projectId,
}: TaskGeneratorModalProps) {
  const theme = useTheme();
  const [prompt, setPrompt] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sowMembers, setSowMembers] = useState<Array<{
    user_id: string;
    name: string;
    role_name: string;
    current_task_count: number;
    is_overworked: boolean;
  }>>([]);
  const [loadingSOW, setLoadingSOW] = useState(false);

  // Load active SOW members when modal opens
  useEffect(() => {
    if (open) {
      loadActiveSOWMembers();
    } else {
      setSowMembers([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId]);

  const loadActiveSOWMembers = async () => {
    setLoadingSOW(true);
    try {
      // Get active SOW
      const sowResponse = await fetch(`/api/projects/${projectId}/sow`);
      if (!sowResponse.ok) {
        return;
      }

      const sowData = await sowResponse.json();
      const activeSOW = (sowData.sows || []).find((s: ScopeOfWork) => s.status === 'active');
      
      if (!activeSOW) {
        return;
      }

      // Get SOW members
      const membersResponse = await fetch(`/api/projects/${projectId}/sow/${activeSOW.id}/members`);
      if (membersResponse.ok) {
        const membersData = await membersResponse.json();
        const members = (membersData.members || []).map((m: SOWMemberWithStats) => ({
          user_id: m.project_member?.user_id || '',
          name: m.project_member?.user?.name || m.project_member?.user?.email || 'Unknown',
          role_name: m.role_name || 'Unknown',
          current_task_count: m.task_count || 0,
          is_overworked: m.is_overworked || false,
        }));
        setSowMembers(members);
      }
    } catch (error) {
      console.error('[TaskGeneratorModal] Error loading SOW members:', error);
    } finally {
      setLoadingSOW(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt or PRD');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/generate-tasks/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          context: context.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate tasks');
      }

      onPreviewGenerated(data.tasks || [], data.summary);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tasks');
      console.error('[Task Generator] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setPrompt('');
      setContext('');
      setError(null);
      onClose();
    }
  };

  return (
    <>
      <BuildingOverlay open={loading} message="Building tasks..." />
      <Dialog
        open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: 'primary.main',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '1px solid',
          borderColor: 'primary.main',
          color: 'primary.main',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AutoAwesomeIcon />
        Generate Tasks with AI
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter a PRD, specification, or prompt describing the tasks you want to generate. The AI will create tasks, extract dates, and check for duplicates.
        </Typography>

        {/* SOW Team Members Info */}
        {!loadingSOW && sowMembers.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Active Scope of Work found with {sowMembers.length} team members.
              Tasks will be auto-assigned based on roles.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {sowMembers.map((member) => (
                <Chip
                  key={member.user_id}
                  label={`${member.name} (${member.role_name}) - ${member.current_task_count} tasks`}
                  color={member.is_overworked ? 'error' : 'default'}
                  size="small"
                  icon={member.is_overworked ? <WarningIcon /> : undefined}
                />
              ))}
            </Box>
            {sowMembers.some(m => m.is_overworked) && (
              <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
                ⚠️ Some team members are overworked. AI will avoid assigning tasks to them when possible.
              </Typography>
            )}
          </Alert>
        )}

        <TextField
          fullWidth
          multiline
          rows={6}
          label="Prompt / PRD / Specification"
          placeholder="Example: We need to build a user authentication system. Complete onboarding by March 15th. Finish the dashboard redesign in 3 weeks..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          sx={{ mb: 2 }}
          required
        />

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Additional Context (Optional)"
          placeholder="Any additional context about the project, requirements, or constraints..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          disabled={loading}
        />
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          sx={{ color: 'text.secondary' }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          disabled={loading || !prompt.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}

