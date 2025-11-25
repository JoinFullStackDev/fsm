'use client';

import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';

interface AIAssistButtonProps {
  label: string;
  onGenerate: (prompt: string) => Promise<string>;
  onAccept: (result: string) => void;
  context?: string;
  disabled?: boolean;
}

export default function AIAssistButton({
  label,
  onGenerate,
  onAccept,
  context,
  disabled,
}: AIAssistButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const generated = await onGenerate(prompt);
      setResult(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (result) {
      onAccept(result);
      setOpen(false);
      setPrompt('');
      setResult('');
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<AutoAwesomeIcon />}
        onClick={() => setOpen(true)}
        disabled={disabled}
        size="small"
        sx={{
          borderColor: '#00FF88',
          color: '#00FF88',
          backgroundColor: 'rgba(0, 255, 136, 0.1)',
          '&:hover': {
            borderColor: '#00FF88',
            backgroundColor: 'rgba(0, 255, 136, 0.2)',
            boxShadow: '0 0 15px rgba(0, 255, 136, 0.4)',
          },
          '&.Mui-disabled': {
            borderColor: 'rgba(0, 255, 136, 0.3)',
            color: 'rgba(0, 255, 136, 0.3)',
          },
        }}
      >
        {label}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'background.paper',
            border: '2px solid',
            borderColor: 'success.main',
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            borderBottom: '1px solid',
            borderColor: 'success.main',
            color: 'success.main',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <AutoAwesomeIcon />
          AI Assist: {label}
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {context && (
            <Alert
              severity="info"
              sx={{
                mb: 2,
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                border: '1px solid',
                borderColor: 'info.main',
                color: 'info.main',
              }}
            >
              {context}
            </Alert>
          )}

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Additional context or instructions (optional)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            margin="normal"
            placeholder="Add any specific requirements or context..."
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', my: 4, gap: 2 }}>
              <CircularProgress sx={{ color: 'success.main' }} size={48} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                AI is generating...
              </Typography>
            </Box>
          )}

          {result && (
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={8}
                label="Generated Result"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                margin="normal"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            variant="outlined"
            disabled={loading}
            sx={{
              borderColor: 'success.main',
              color: 'success.main',
              '&:hover': {
                borderColor: 'success.light',
                backgroundColor: 'rgba(0, 255, 136, 0.1)',
              },
            }}
          >
            {loading ? 'Generating...' : 'Generate'}
          </Button>
          {result && (
            <Button
              onClick={handleAccept}
              variant="contained"
              sx={{
                backgroundColor: 'success.main',
                color: 'success.contrastText',
                '&:hover': {
                  backgroundColor: 'success.dark',
                  boxShadow: '0 4px 15px rgba(0, 255, 136, 0.4)',
                },
              }}
            >
              Accept
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}

