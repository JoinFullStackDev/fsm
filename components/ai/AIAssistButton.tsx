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
  useTheme,
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
  const theme = useTheme();
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
          borderColor: theme.palette.text.primary,
          color: theme.palette.text.primary,
          backgroundColor: theme.palette.action.hover,
          '&:hover': {
            borderColor: theme.palette.text.primary,
            backgroundColor: theme.palette.action.hover,
          },
          '&.Mui-disabled': {
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
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
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: theme.palette.action.hover,
            borderBottom: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
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
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
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
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                '& fieldset': {
                  borderColor: theme.palette.divider,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.text.secondary,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.text.primary,
                },
              },
              '& .MuiInputLabel-root': {
                color: theme.palette.text.secondary,
              },
              '& .MuiInputLabel-root.Mui-focused': {
                color: theme.palette.text.primary,
              },
              '& .MuiInputBase-input': {
                color: theme.palette.text.primary,
              },
              '& .MuiInputBase-input::placeholder': {
                color: theme.palette.text.secondary,
                opacity: 0.7,
              },
            }}
          />

          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 2,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {error}
            </Alert>
          )}

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', my: 4, gap: 2 }}>
              <CircularProgress sx={{ color: theme.palette.text.primary }} size={48} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    '& fieldset': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover fieldset': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: theme.palette.text.primary,
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: theme.palette.text.secondary,
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: theme.palette.text.primary,
                  },
                  '& .MuiInputBase-input': {
                    color: theme.palette.text.primary,
                  },
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={() => setOpen(false)}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
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
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.primary,
                backgroundColor: theme.palette.action.hover,
              },
              '&.Mui-disabled': {
                borderColor: theme.palette.divider,
                color: theme.palette.text.secondary,
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
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
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

