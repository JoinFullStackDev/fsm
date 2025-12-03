'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import AllocationConflictWarning from './AllocationConflictWarning';
import type { ProjectMemberAllocation, ResourceAllocationConflict } from '@/types/project';

interface ResourceAllocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    user_id: string;
    allocated_hours_per_week: number;
    start_date?: string | null;
    end_date?: string | null;
    notes?: string;
  }) => Promise<void>;
  allocation?: ProjectMemberAllocation | null;
  projectId: string;
  availableUsers?: Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
}

export default function ResourceAllocationForm({
  open,
  onClose,
  onSubmit,
  allocation,
  projectId,
  availableUsers = [],
}: ResourceAllocationFormProps) {
  const [userId, setUserId] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<ResourceAllocationConflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    if (open) {
      if (allocation) {
        setUserId(allocation.user_id);
        setHoursPerWeek(allocation.allocated_hours_per_week.toString());
        setStartDate(allocation.start_date || '');
        setEndDate(allocation.end_date || '');
        setNotes(allocation.notes || '');
      } else {
        setUserId('');
        setHoursPerWeek('');
        setStartDate('');
        setEndDate('');
        setNotes('');
      }
      setConflicts([]);
    }
  }, [open, allocation]);

  const checkConflicts = async () => {
    if (!userId || !hoursPerWeek) {
      return;
    }

    setCheckingConflicts(true);
    try {
      const response = await fetch('/api/resource-allocation/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: [{
            user_id: userId,
            allocated_hours_per_week: parseFloat(hoursPerWeek),
            start_date: startDate || null,
            end_date: endDate || null,
          }],
          exclude_allocation_id: allocation?.id,
        }),
      });

      const data = await response.json();
      if (data.has_conflicts && data.conflicts) {
        setConflicts(data.conflicts);
      } else {
        setConflicts([]);
      }
    } catch (error) {
      console.error('Error checking conflicts:', error);
    } finally {
      setCheckingConflicts(false);
    }
  };

  useEffect(() => {
    if (userId && hoursPerWeek) {
      const timeoutId = setTimeout(() => {
        checkConflicts();
      }, 500); // Debounce conflict checking

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hoursPerWeek, startDate, endDate]);

  const handleSubmit = async () => {
    if (!userId || !hoursPerWeek) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        user_id: userId,
        allocated_hours_per_week: parseFloat(hoursPerWeek),
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error submitting allocation:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {allocation ? 'Edit Resource Allocation' : 'Add Resource Allocation'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <FormControl fullWidth required>
            <InputLabel>Team Member</InputLabel>
            <Select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              label="Team Member"
              disabled={!!allocation}
            >
              {availableUsers.map((user) => (
                <MenuItem key={user.id} value={user.id}>
                  {user.name || user.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Hours per Week"
            type="number"
            value={hoursPerWeek}
            onChange={(e) => setHoursPerWeek(e.target.value)}
            required
            inputProps={{ min: 0.1, max: 168, step: 0.1 }}
            helperText="Number of hours allocated per week (max 168)"
          />

          <TextField
            label="Start Date (Optional)"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              max: endDate || undefined,
            }}
            helperText="Leave blank for ongoing allocation"
          />

          <TextField
            label="End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            fullWidth
            InputLabelProps={{
              shrink: true,
            }}
            inputProps={{
              min: startDate || undefined,
            }}
            helperText="Leave blank for ongoing allocation"
          />

          <TextField
            label="Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />

          {checkingConflicts && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Checking for conflicts...
              </Typography>
            </Box>
          )}

          {conflicts.length > 0 && (
            <AllocationConflictWarning conflicts={conflicts} />
          )}
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
            !userId ||
            !hoursPerWeek ||
            parseFloat(hoursPerWeek) <= 0
          }
        >
          {loading ? 'Saving...' : allocation ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

