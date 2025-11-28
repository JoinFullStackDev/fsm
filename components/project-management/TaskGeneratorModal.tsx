'use client';

import { useState } from 'react';
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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Close as CloseIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import type { PreviewTask } from '@/types/taskGenerator';

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
            color: '#000',
            '&:hover': {
              backgroundColor: 'primary.light',
            },
          }}
        >
          {loading ? 'Generating...' : 'Generate Preview'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

