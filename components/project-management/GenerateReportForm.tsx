'use client';

import { useState } from 'react';
import {
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
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Description as DescriptionIcon,
  Slideshow as SlideshowIcon,
} from '@mui/icons-material';

export type ReportType = 'weekly' | 'monthly' | 'forecast';
export type ReportFormat = 'pdf' | 'slideshow';

interface GenerateReportFormProps {
  projectName: string;
  onGenerate: (config: {
    reportType: ReportType;
    format: ReportFormat;
    forecastDays?: number;
  }) => Promise<void>;
}

export default function GenerateReportForm({
  projectName,
  onGenerate,
}: GenerateReportFormProps) {
  const theme = useTheme();
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
      // Reset form after successful generation
      setReportType('weekly');
      setFormat('pdf');
      setForecastDays(30);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Paper
      sx={{
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        p: { xs: 2, md: 4 },
      }}
    >
      <Typography
        variant="h5"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 600,
          mb: { xs: 3, md: 4 },
          fontSize: { xs: '1.25rem', md: '1.5rem' },
        }}
      >
        Generate Report - {projectName}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }}>
          {error}
        </Alert>
      )}

      {/* Report Type Selection */}
      <FormControl component="fieldset" sx={{ mb: { xs: 3, md: 4 }, width: '100%' }}>
        <FormLabel
          component="legend"
          sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          Report Type
        </FormLabel>
        <RadioGroup
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          <FormControlLabel
            value="weekly"
            control={<Radio sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.text.primary } }} />}
            label={
              <Box>
                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}>
                  Weekly Report
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                  Last week recap + This week preview
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            value="monthly"
            control={<Radio sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.text.primary } }} />}
            label={
              <Box>
                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}>
                  Monthly Report
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                  Previous month summary
                </Typography>
              </Box>
            }
            sx={{ mb: 1 }}
          />
          <FormControlLabel
            value="forecast"
            control={<Radio sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.text.primary } }} />}
            label={
              <Box>
                <Typography sx={{ color: theme.palette.text.primary, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}>
                  Forecast Report
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: { xs: '0.7rem', md: '0.75rem' } }}>
                  Upcoming tasks and projections
                </Typography>
              </Box>
            }
          />
        </RadioGroup>
      </FormControl>

      {/* Forecast Period Selection */}
      {reportType === 'forecast' && (
        <FormControl fullWidth sx={{ mb: { xs: 3, md: 4 } }}>
          <InputLabel sx={{ color: theme.palette.text.secondary, fontSize: { xs: '0.875rem', md: '1rem' } }}>Forecast Period</InputLabel>
          <Select
            value={forecastDays}
            onChange={(e) => setForecastDays(Number(e.target.value))}
            label="Forecast Period"
            sx={{
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
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
      <FormControl component="fieldset" sx={{ mb: { xs: 3, md: 4 }, width: '100%' }}>
        <FormLabel
          component="legend"
          sx={{ color: theme.palette.text.primary, mb: 2, fontWeight: 500, fontSize: { xs: '0.875rem', md: '1rem' } }}
        >
          Format
        </FormLabel>
        <RadioGroup
          value={format}
          onChange={(e) => setFormat(e.target.value as ReportFormat)}
          row={false}
          sx={{
            flexDirection: { xs: 'column', md: 'row' },
          }}
        >
          <FormControlLabel
            value="pdf"
            control={<Radio sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.text.primary } }} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DescriptionIcon sx={{ color: theme.palette.text.primary, fontSize: { xs: 18, md: 20 } }} />
                <Typography sx={{ color: theme.palette.text.primary, fontSize: { xs: '0.875rem', md: '1rem' } }}>PDF Download</Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="slideshow"
            control={<Radio sx={{ color: theme.palette.text.primary, '&.Mui-checked': { color: theme.palette.text.primary } }} />}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SlideshowIcon sx={{ color: theme.palette.text.primary, fontSize: { xs: 18, md: 20 } }} />
                <Typography sx={{ color: theme.palette.text.primary, fontSize: { xs: '0.875rem', md: '1rem' } }}>AI Slideshow</Typography>
              </Box>
            }
          />
        </RadioGroup>
      </FormControl>

      <Button
        onClick={handleGenerate}
        disabled={generating}
        variant="outlined"
        fullWidth
        sx={{
          borderColor: theme.palette.text.primary,
          color: theme.palette.text.primary,
          fontWeight: 600,
          py: 1.5,
          '&:hover': {
            borderColor: theme.palette.text.primary,
            backgroundColor: theme.palette.action.hover,
          },
          '&.Mui-disabled': {
            borderColor: theme.palette.divider,
            color: theme.palette.text.secondary,
          },
        }}
        startIcon={generating ? <CircularProgress size={16} sx={{ color: theme.palette.text.primary }} /> : null}
      >
        {generating ? 'Generating...' : 'Generate Report'}
      </Button>
    </Paper>
  );
}

