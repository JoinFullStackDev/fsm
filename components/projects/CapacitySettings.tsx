'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Typography,
} from '@mui/material';
import type { UserCapacity } from '@/types/project';

interface CapacitySettingsProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    default_hours_per_week: number;
    max_hours_per_week: number;
    is_active: boolean;
    notes?: string;
  }) => Promise<void>;
  capacity?: UserCapacity | null;
  userName?: string;
}

export default function CapacitySettings({
  open,
  onClose,
  onSubmit,
  capacity,
  userName,
}: CapacitySettingsProps) {
  const [defaultHours, setDefaultHours] = useState('40');
  const [maxHours, setMaxHours] = useState('50');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (capacity) {
        setDefaultHours(capacity.default_hours_per_week.toString());
        setMaxHours(capacity.max_hours_per_week.toString());
        setIsActive(capacity.is_active);
        setNotes(capacity.notes || '');
      } else {
        setDefaultHours('40');
        setMaxHours('50');
        setIsActive(true);
        setNotes('');
      }
    }
  }, [open, capacity]);

  const handleSubmit = async () => {
    const defaultHoursNum = parseFloat(defaultHours);
    const maxHoursNum = parseFloat(maxHours);

    if (defaultHoursNum <= 0 || defaultHoursNum > 168) {
      return;
    }
    if (maxHoursNum <= 0 || maxHoursNum > 168) {
      return;
    }
    if (defaultHoursNum > maxHoursNum) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        default_hours_per_week: defaultHoursNum,
        max_hours_per_week: maxHoursNum,
        is_active: isActive,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error saving capacity:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {capacity ? 'Edit User Capacity' : 'Set User Capacity'}
        {userName && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {userName}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Default Hours per Week"
            type="number"
            value={defaultHours}
            onChange={(e) => setDefaultHours(e.target.value)}
            required
            inputProps={{ min: 0.1, max: 168, step: 0.1 }}
            helperText="Standard working hours per week"
          />

          <TextField
            label="Maximum Hours per Week"
            type="number"
            value={maxHours}
            onChange={(e) => setMaxHours(e.target.value)}
            required
            inputProps={{ min: 0.1, max: 168, step: 0.1 }}
            helperText="Maximum hours per week (must be >= default hours)"
            error={parseFloat(maxHours) < parseFloat(defaultHours)}
          />

          <FormControlLabel
            control={
              <Switch
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            }
            label="Active"
          />

          <TextField
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            loading ||
            parseFloat(defaultHours) <= 0 ||
            parseFloat(maxHours) <= 0 ||
            parseFloat(defaultHours) > parseFloat(maxHours)
          }
        >
          {loading ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

