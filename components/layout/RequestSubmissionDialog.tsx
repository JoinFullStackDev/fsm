'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Feedback as FeedbackIcon, BugReport as BugReportIcon, Lightbulb as LightbulbIcon } from '@mui/icons-material';
import type { RequestType, RequestPriority, FeatureBugRequestCreate } from '@/types/requests';

interface RequestSubmissionDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function RequestSubmissionDialog({ open, onClose }: RequestSubmissionDialogProps) {
  const theme = useTheme();
  const pathname = usePathname();
  const [type, setType] = useState<RequestType | ''>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('medium');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Auto-populate page_url for bug reports
  useEffect(() => {
    if (open && type === 'bug' && typeof window !== 'undefined') {
      // Page URL is already captured via pathname, but we can also use window.location.href for full URL
    }
  }, [open, type, pathname]);

  const handleTypeChange = (event: SelectChangeEvent<string>) => {
    setType(event.target.value as RequestType);
    // Reset bug-specific fields when switching types
    if (event.target.value !== 'bug') {
      setStepsToReproduce('');
      setExpectedBehavior('');
      setActualBehavior('');
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!type) {
      setError('Please select a request type');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }
    if (type === 'bug') {
      if (!stepsToReproduce.trim()) {
        setError('Please provide steps to reproduce the bug');
        return;
      }
      if (!expectedBehavior.trim()) {
        setError('Please describe the expected behavior');
        return;
      }
      if (!actualBehavior.trim()) {
        setError('Please describe the actual behavior');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : null;
      
      const requestData: FeatureBugRequestCreate = {
        type: type as RequestType,
        title: title.trim(),
        description: description.trim(),
        priority,
        page_url: type === 'bug' ? pageUrl : null,
        steps_to_reproduce: type === 'bug' ? stepsToReproduce.trim() : null,
        expected_behavior: type === 'bug' ? expectedBehavior.trim() : null,
        actual_behavior: type === 'bug' ? actualBehavior.trim() : null,
      };

      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit request');
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
      console.error('[Request Submission] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setType('');
      setTitle('');
      setDescription('');
      setPriority('medium');
      setStepsToReproduce('');
      setExpectedBehavior('');
      setActualBehavior('');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  const isBugReport = type === 'bug';
  const isFeatureRequest = type === 'feature';

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
        <FeedbackIcon />
        Submit Request
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Request submitted successfully! Thank you for your feedback.
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Request Type</InputLabel>
          <Select
            value={type}
            onChange={handleTypeChange}
            label="Request Type"
            disabled={loading || success}
          >
            <MenuItem value="feature">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LightbulbIcon fontSize="small" />
                Feature Request
              </Box>
            </MenuItem>
            <MenuItem value="bug">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BugReportIcon fontSize="small" />
                Bug Report
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        {type && (
          <>
            <TextField
              fullWidth
              label="Title"
              placeholder={isBugReport ? 'Brief description of the bug' : 'Brief description of the feature'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading || success}
              required
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Description"
              placeholder={
                isBugReport
                  ? 'Describe the bug in detail...'
                  : 'Describe the feature you would like to see. High-level information is fine - you don\'t need all the technical specs.'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading || success}
              required
              sx={{ mb: 2 }}
            />

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Priority</InputLabel>
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as RequestPriority)}
                label="Priority"
                disabled={loading || success}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </Select>
            </FormControl>

            {isBugReport && (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, mt: 1 }}>
                  Page URL: {typeof window !== 'undefined' ? window.location.href : pathname}
                </Typography>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Steps to Reproduce"
                  placeholder="1. Go to... 2. Click on... 3. See error..."
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  disabled={loading || success}
                  required
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Expected Behavior"
                  placeholder="What should happen?"
                  value={expectedBehavior}
                  onChange={(e) => setExpectedBehavior(e.target.value)}
                  disabled={loading || success}
                  required
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Actual Behavior"
                  placeholder="What actually happens?"
                  value={actualBehavior}
                  onChange={(e) => setActualBehavior(e.target.value)}
                  disabled={loading || success}
                  required
                  sx={{ mb: 2 }}
                />
              </>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <Button
          onClick={handleClose}
          disabled={loading}
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
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || success || !type}
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            '&:disabled': {
              backgroundColor: 'action.disabledBackground',
            },
          }}
        >
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} />
              Submitting...
            </Box>
          ) : (
            'Submit'
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

