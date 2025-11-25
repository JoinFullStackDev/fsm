'use client';

import { useRef, useEffect, ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';
import { useReturnFocus } from '@/lib/hooks/useFocusManagement';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info';
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
}: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Return focus when modal closes
  useReturnFocus(open);

  // Focus on confirm button when modal opens (for keyboard navigation)
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        confirmButtonRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const severityColor = severity === 'error' ? 'error.main' : severity === 'warning' ? 'warning.main' : 'info.main';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          border: '2px solid',
          borderColor: severityColor,
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle
        sx={{
          backgroundColor: severity === 'error' ? 'rgba(255, 23, 68, 0.1)' : 
                          severity === 'warning' ? 'rgba(255, 107, 53, 0.1)' : 
                          'rgba(33, 150, 243, 0.1)',
          borderBottom: '1px solid',
          borderColor: severityColor,
          color: severityColor,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <WarningIcon />
        {title}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        {typeof message === 'string' ? (
          <Typography sx={{ color: 'text.primary' }}>
            {message}
          </Typography>
        ) : (
          <Box sx={{ color: 'text.primary' }}>
            {message}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          {cancelText}
        </Button>
        <Button
          ref={confirmButtonRef}
          onClick={handleConfirm}
          variant="contained"
          sx={{
            backgroundColor: severityColor,
            color: severity === 'error' ? 'error.contrastText' : 
                   severity === 'warning' ? 'warning.contrastText' : 
                   'info.contrastText',
            '&:hover': {
              backgroundColor: severity === 'error' ? 'error.dark' : 
                             severity === 'warning' ? 'warning.dark' : 
                             'info.dark',
            },
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

