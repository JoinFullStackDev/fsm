'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Box,
  Select,
  MenuItem,
  InputLabel,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Description as DescriptionIcon,
  Slideshow as SlideshowIcon,
} from '@mui/icons-material';

export type ReportType = 'weekly' | 'monthly' | 'forecast';
export type ReportFormat = 'pdf' | 'slideshow';

interface ReportGenerationModalProps {
  open: boolean;
  onClose: () => void;
  onGenerate: (config: {
    reportType: ReportType;
    format: ReportFormat;
    forecastDays?: number;
  }) => Promise<void>;
  projectName: string;
}

export default function ReportGenerationModal({
  open,
  onClose,
  onGenerate,
  projectName,
}: ReportGenerationModalProps) {
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [forecastDays, setForecastDays] = useState<number>(30);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (reportType === 'forecast' && !forecastDays) {
      setError('Please select a forecast period');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      await onGenerate({
        reportType,
        format,
        forecastDays: reportType === 'forecast' ? forecastDays : undefined,
      });
      // Don't close modal here - let parent handle it after success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleClose = () => {
    if (!generating) {
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#000',
          border: '1px solid rgba(0, 229, 255, 0.3)',
        },
      }}
    >
      <DialogTitle
        sx={{
          color: '#00E5FF',
          fontWeight: 600,
          borderBottom: '2px solid rgba(0, 229, 255, 0.2)',
          pb: 2,
        }}
      >
        Generate Report - {projectName}
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Report Type Selection */}
        <FormControl component="fieldset" sx={{ mb: 4, width: '100%' }}>
          <FormLabel
            component="legend"
            sx={{ color: '#00E5FF', mb: 2, fontWeight: 500 }}
          >
            Report Type
          </FormLabel>
          <RadioGroup
            value={reportType}
            onChange={(e) => setReportType(e.target.value as ReportType)}
          >
            <FormControlLabel
              value="weekly"
              control={<Radio sx={{ color: '#00E5FF' }} />}
              label={
                <Box>
                  <Typography sx={{ color: '#E0E0E0', fontWeight: 500 }}>
                    Weekly Report
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
                    Last week recap + This week preview
                  </Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              value="monthly"
              control={<Radio sx={{ color: '#00E5FF' }} />}
              label={
                <Box>
                  <Typography sx={{ color: '#E0E0E0', fontWeight: 500 }}>
                    Monthly Report
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
                    Previous month summary
                  </Typography>
                </Box>
              }
              sx={{ mb: 1 }}
            />
            <FormControlLabel
              value="forecast"
              control={<Radio sx={{ color: '#00E5FF' }} />}
              label={
                <Box>
                  <Typography sx={{ color: '#E0E0E0', fontWeight: 500 }}>
                    Forecast Report
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#B0B0B0' }}>
                    Upcoming tasks and projections
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        {/* Forecast Period Selection */}
        {reportType === 'forecast' && (
          <FormControl fullWidth sx={{ mb: 4 }}>
            <InputLabel sx={{ color: '#B0B0B0' }}>Forecast Period</InputLabel>
            <Select
              value={forecastDays}
              onChange={(e) => setForecastDays(Number(e.target.value))}
              label="Forecast Period"
              sx={{
                color: '#E0E0E0',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 229, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#00E5FF',
                },
              }}
            >
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={14}>14 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={45}>45 days</MenuItem>
              <MenuItem value={60}>60 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </Select>
          </FormControl>
        )}

        {/* Format Selection */}
        <FormControl component="fieldset" sx={{ width: '100%' }}>
          <FormLabel
            component="legend"
            sx={{ color: '#00E5FF', mb: 2, fontWeight: 500 }}
          >
            Format
          </FormLabel>
          <RadioGroup
            value={format}
            onChange={(e) => setFormat(e.target.value as ReportFormat)}
            row
          >
            <FormControlLabel
              value="pdf"
              control={<Radio sx={{ color: '#00E5FF' }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DescriptionIcon sx={{ color: '#00E5FF', fontSize: 20 }} />
                  <Typography sx={{ color: '#E0E0E0' }}>PDF Download</Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="slideshow"
              control={<Radio sx={{ color: '#00E5FF' }} />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SlideshowIcon sx={{ color: '#00E5FF', fontSize: 20 }} />
                  <Typography sx={{ color: '#E0E0E0' }}>AI Slideshow</Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          borderTop: '2px solid rgba(0, 229, 255, 0.2)',
        }}
      >
        <Button
          onClick={handleClose}
          disabled={generating}
          sx={{
            color: '#B0B0B0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          variant="contained"
          sx={{
            backgroundColor: '#00E5FF',
            color: '#000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#00B8D4',
            },
            '&.Mui-disabled': {
              backgroundColor: 'rgba(0, 229, 255, 0.3)',
              color: 'rgba(255, 255, 255, 0.5)',
            },
          }}
          startIcon={generating ? <CircularProgress size={16} /> : null}
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

