'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import { Keyboard as KeyboardIcon, Close as CloseIcon } from '@mui/icons-material';

interface Shortcut {
  keys: string[];
  description: string;
  category?: string;
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
  shortcuts: Shortcut[];
}

export default function KeyboardShortcutsDialog({
  open,
  onClose,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  const formatKey = (key: string) => {
    const keyMap: Record<string, string> = {
      ctrl: 'Ctrl',
      meta: '⌘',
      shift: 'Shift',
      alt: 'Alt',
      ' ': 'Space',
      arrowup: '↑',
      arrowdown: '↓',
      arrowleft: '←',
      arrowright: '→',
    };

    return keyMap[key.toLowerCase()] || key.toUpperCase();
  };

  const formatKeys = (keys: string[]) => {
    return keys.map((key) => formatKey(key)).join(' + ');
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#000',
          border: '2px solid rgba(0, 229, 255, 0.2)',
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          backgroundColor: 'rgba(0, 229, 255, 0.1)',
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
          color: '#00E5FF',
          fontWeight: 600,
        }}
      >
        <KeyboardIcon />
        Keyboard Shortcuts
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
          <Box key={category} sx={{ mb: 3 }}>
            <Typography
              variant="subtitle1"
              sx={{
                color: '#00E5FF',
                fontWeight: 600,
                mb: 1.5,
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                letterSpacing: 1,
              }}
            >
              {category}
            </Typography>
            <Divider sx={{ mb: 2, borderColor: 'rgba(0, 229, 255, 0.2)' }} />
            {categoryShortcuts.map((shortcut, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1.5,
                  px: 2,
                  mb: 1,
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: 'rgba(0, 229, 255, 0.05)',
                  },
                }}
              >
                <Typography variant="body2" sx={{ color: '#E0E0E0', flex: 1 }}>
                  {shortcut.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {shortcut.keys.map((key, keyIndex) => (
                    <Chip
                      key={keyIndex}
                      label={formatKey(key)}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        color: '#00E5FF',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: 24,
                      }}
                    />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '2px solid rgba(0, 229, 255, 0.2)' }}>
        <Button
          onClick={onClose}
          startIcon={<CloseIcon />}
          sx={{
            color: '#B0B0B0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

