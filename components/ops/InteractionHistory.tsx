'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Event as MeetingIcon,
  Note as NoteIcon,
  LinkedIn as LinkedInIcon,
  MoreHoriz as OtherIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { ContactInteraction, InteractionType } from '@/types/ops';

interface InteractionHistoryProps {
  contactId: string;
  interactions: ContactInteraction[];
  onInteractionsChange: () => void;
}

const INTERACTION_TYPES: InteractionType[] = ['Call', 'Email', 'Meeting', 'Note', 'LinkedIn', 'Other'];

const getInteractionIcon = (type: InteractionType) => {
  switch (type) {
    case 'Call':
      return <PhoneIcon sx={{ fontSize: 20 }} />;
    case 'Email':
      return <EmailIcon sx={{ fontSize: 20 }} />;
    case 'Meeting':
      return <MeetingIcon sx={{ fontSize: 20 }} />;
    case 'LinkedIn':
      return <LinkedInIcon sx={{ fontSize: 20 }} />;
    case 'Note':
      return <NoteIcon sx={{ fontSize: 20 }} />;
    default:
      return <OtherIcon sx={{ fontSize: 20 }} />;
  }
};

export default function InteractionHistory({
  contactId,
  interactions,
  onInteractionsChange,
}: InteractionHistoryProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interactionType, setInteractionType] = useState<InteractionType>('Note');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [interactionDate, setInteractionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!notes.trim()) {
      setError('Notes are required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/ops/contacts/${contactId}/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interaction_type: interactionType,
          subject: subject.trim() || null,
          notes: notes.trim(),
          interaction_date: interactionDate ? `${interactionDate}T00:00:00Z` : new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create interaction');
      }

      showSuccess('Interaction logged successfully');
      setDialogOpen(false);
      setSubject('');
      setNotes('');
      setInteractionType('Note');
      setInteractionDate(new Date().toISOString().split('T')[0]);
      onInteractionsChange();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create interaction';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography
          variant="subtitle2"
          sx={{
            color: theme.palette.text.secondary,
            fontWeight: 600,
          }}
        >
          Interaction History
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            fontWeight: 600,
            border: `1px solid ${theme.palette.divider}`,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              borderColor: theme.palette.text.primary,
            },
          }}
        >
          Log Interaction
        </Button>
      </Box>

      {interactions.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            fontStyle: 'italic',
            textAlign: 'center',
            py: 3,
          }}
        >
          No interactions recorded yet
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {interactions.map((interaction) => (
            <Paper
              key={interaction.id}
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    color: theme.palette.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                    mt: 0.5,
                  }}
                >
                  {getInteractionIcon(interaction.interaction_type)}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: theme.palette.text.primary,
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          fontSize: '0.75rem',
                        }}
                      >
                        {interaction.interaction_type}
                      </Typography>
                      {interaction.subject && (
                        <Typography
                          variant="body1"
                          sx={{
                            color: theme.palette.text.primary,
                            fontWeight: 600,
                            mt: 0.5,
                          }}
                        >
                          {interaction.subject}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatDate(interaction.interaction_date)}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      color: theme.palette.text.primary,
                      whiteSpace: 'pre-wrap',
                      mb: 1,
                    }}
                  >
                    {interaction.notes}
                  </Typography>
                  {interaction.created_user && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                      }}
                    >
                      Logged by {interaction.created_user.name || interaction.created_user.email}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      {/* Add Interaction Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!loading) {
            setDialogOpen(false);
            setError(null);
            setSubject('');
            setNotes('');
            setInteractionType('Note');
            setInteractionDate(new Date().toISOString().split('T')[0]);
          }
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.default,
            border: `2px solid ${theme.palette.divider}`,
          },
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogTitle sx={{ color: theme.palette.text.primary, fontWeight: 600, fontFamily: 'var(--font-rubik), Rubik, sans-serif' }}>
            Log Interaction
          </DialogTitle>
          <DialogContent>
            {error && (
              <Alert
                severity="error"
                sx={{
                  mb: 2,
                  backgroundColor: theme.palette.action.hover,
                  border: `1px solid ${theme.palette.divider}`,
                  color: theme.palette.text.primary,
                }}
              >
                {error}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <FormControl fullWidth>
                <InputLabel sx={{ color: theme.palette.text.secondary }}>Interaction Type</InputLabel>
                <Select
                  value={interactionType}
                  label="Interaction Type"
                  onChange={(e) => setInteractionType(e.target.value as InteractionType)}
                  disabled={loading}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        '& .MuiMenuItem-root': {
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          '&.Mui-selected': {
                            backgroundColor: theme.palette.action.hover,
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          },
                        },
                      },
                    },
                  }}
                  sx={{
                    color: theme.palette.text.primary,
                    backgroundColor: theme.palette.background.default,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.divider,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.text.secondary,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: theme.palette.text.primary,
                    },
                    '& .MuiSvgIcon-root': {
                      color: theme.palette.text.primary,
                    },
                  }}
                >
                  {INTERACTION_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Subject (Optional)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.default,
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
                }}
              />
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={interactionDate}
                onChange={(e) => setInteractionDate(e.target.value)}
                InputLabelProps={{
                  shrink: true,
                }}
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.default,
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
                }}
              />
              <TextField
                fullWidth
                label="Notes"
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setError(null);
                }}
                multiline
                rows={4}
                required
                disabled={loading}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: theme.palette.background.default,
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
                }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: `2px solid ${theme.palette.divider}` }}>
            <Button
              onClick={() => {
                setDialogOpen(false);
                setError(null);
                setSubject('');
                setNotes('');
                setInteractionType('Note');
                setInteractionDate(new Date().toISOString().split('T')[0]);
              }}
              disabled={loading}
              sx={{
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                fontWeight: 600,
                border: `1px solid ${theme.palette.divider}`,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  borderColor: theme.palette.text.primary,
                },
              }}
            >
              {loading ? 'Logging...' : 'Log Interaction'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

