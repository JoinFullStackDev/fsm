'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import { useReturnFocus } from '@/lib/hooks/useFocusManagement';

interface InputModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  placeholder?: string;
}

export default function InputModal({
  open,
  onClose,
  onConfirm,
  title,
  label,
  placeholder = 'Enter value...',
}: InputModalProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Return focus when modal closes
  useReturnFocus(open);

  useEffect(() => {
    if (open) {
      setValue('');
      setError(false);
      // Focus on input when modal opens
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleConfirm = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError(true);
      return;
    }
    onConfirm(trimmedValue);
    setValue('');
    setError(false);
    onClose();
  };

  const handleClose = () => {
    setValue('');
    setError(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
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
        }}
      >
        {title}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <TextField
          fullWidth
          inputRef={inputRef}
          label={label}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          placeholder={placeholder}
          error={error}
          helperText={error ? 'Please enter a value' : ''}
          autoFocus
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleConfirm();
            }
          }}
          sx={{ mt: 1 }}
          aria-describedby={error ? 'input-error' : undefined}
        />
        {error && (
          <Box id="input-error" role="alert" className="sr-only">
            Please enter a value
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={handleClose}
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
          onClick={handleConfirm}
          variant="contained"
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
          }}
        >
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}

