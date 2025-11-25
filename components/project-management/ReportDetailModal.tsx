'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNotification } from '@/components/providers/NotificationProvider';

interface Report {
  id: string;
  report_type: 'weekly' | 'monthly' | 'forecast';
  format: 'pdf' | 'slideshow';
  forecast_days?: number | null;
  date_range: string;
  created_at: string;
  expires_at?: string | null;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

interface ReportDetailModalProps {
  open: boolean;
  report: Report;
  projectId: string;
  onClose: () => void;
}

export default function ReportDetailModal({
  open,
  report,
  projectId,
  onClose,
}: ReportDetailModalProps) {
  const { showSuccess, showError } = useNotification();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const pdfUrlRef = useRef<string | null>(null);

  const loadPDF = useCallback(async () => {
    setLoadingPdf(true);
    try {
      // Regenerate PDF for viewing
      const response = await fetch(`/api/projects/${projectId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: report.report_type,
          format: 'pdf',
          forecastDays: report.forecast_days,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Cleanup previous URL if exists
      if (pdfUrlRef.current) {
        window.URL.revokeObjectURL(pdfUrlRef.current);
      }
      
      pdfUrlRef.current = url;
      setPdfUrl(url);
      setLoadingPdf(false);
    } catch (error) {
      setLoadingPdf(false);
      showError('Failed to load PDF');
    }
  }, [projectId, report, showError]);

  useEffect(() => {
    if (open && report.format === 'pdf') {
      // Preload PDF for viewing
      loadPDF();
    } else {
      if (pdfUrlRef.current) {
        window.URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
        setPdfUrl(null);
      }
    }
    
    // Cleanup URL on unmount
    return () => {
      if (pdfUrlRef.current) {
        window.URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    };
  }, [open, report.format, loadPDF]);

  const handleDownloadPDF = async () => {
    try {
      // Regenerate PDF for download
      const response = await fetch(`/api/projects/${projectId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: report.report_type,
          format: 'pdf',
          forecastDays: report.forecast_days,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${report.report_type}_${format(new Date(report.created_at), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showSuccess('PDF downloaded successfully');
    } catch (error) {
      showError('Failed to download PDF');
    }
  };

  const handleViewSlideshow = () => {
    window.open(`/reports/${report.id}`, '_blank');
  };

  const handleDownloadSlideshow = async () => {
    try {
      const response = await fetch(`/api/reports/${report.id}`);
      if (!response.ok) {
        throw new Error('Failed to load report');
      }

      const data = await response.json();
      const { generateSlideshowHTML } = await import('@/lib/reports/slideshowGenerator');
      
      const html = generateSlideshowHTML({
        projectName: data.projectName,
        reportType: data.reportType,
        dateRange: data.dateRange,
        content: data.reportContent,
        data: data.reportData,
        projectMembers: data.projectMembers || [],
      });

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.projectName}_${data.reportType}_${format(new Date(data.createdAt), 'yyyy-MM-dd')}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showSuccess('Slideshow downloaded successfully');
    } catch (error) {
      showError('Failed to download slideshow');
    }
  };

  const getReportTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={report.format === 'pdf' ? 'lg' : 'sm'}
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#121633',
          border: '1px solid rgba(0, 229, 255, 0.3)',
        },
      }}
    >
      <DialogTitle
        sx={{
          color: '#00E5FF',
          fontWeight: 600,
          borderBottom: '1px solid rgba(0, 229, 255, 0.2)',
          pb: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant="h6" component="span">
            Report Details
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip
              label={getReportTypeLabel(report.report_type)}
              size="small"
              sx={{
                backgroundColor: 'rgba(0, 229, 255, 0.2)',
                color: '#00E5FF',
              }}
            />
            <Chip
              label={report.format.toUpperCase()}
              size="small"
              sx={{
                backgroundColor:
                  report.format === 'pdf'
                    ? 'rgba(233, 30, 99, 0.2)'
                    : 'rgba(156, 39, 176, 0.2)',
                color: report.format === 'pdf' ? '#E91E63' : '#9C27B0',
              }}
            />
          </Box>
        </Box>
        <IconButton
          onClick={onClose}
          sx={{
            color: '#00E5FF',
            '&:hover': {
              backgroundColor: 'rgba(0, 229, 255, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {/* Report Info */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
            Date Range
          </Typography>
          <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
            {report.date_range}
          </Typography>

          <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
            Created
          </Typography>
          <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
            {format(new Date(report.created_at), 'PPpp')}
          </Typography>

          {report.user && (
            <>
              <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                Created By
              </Typography>
              <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
                {report.user.name || report.user.email || 'Unknown'}
              </Typography>
            </>
          )}

          {report.report_type === 'forecast' && report.forecast_days && (
            <>
              <Typography variant="body2" sx={{ color: '#B0B0B0', mb: 1 }}>
                Forecast Period
              </Typography>
              <Typography variant="body1" sx={{ color: '#E0E0E0', mb: 2 }}>
                {report.forecast_days} days
              </Typography>
            </>
          )}
        </Box>

        {/* PDF Viewer */}
        {report.format === 'pdf' && (
          <Box>
            {loadingPdf ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress sx={{ color: '#00E5FF' }} />
                <Typography variant="body2" sx={{ color: '#B0B0B0', ml: 2, alignSelf: 'center' }}>
                  Generating PDF...
                </Typography>
              </Box>
            ) : pdfUrl ? (
              <Box
                component="iframe"
                src={pdfUrl}
                sx={{
                  width: '100%',
                  height: '600px',
                  border: '1px solid rgba(0, 229, 255, 0.2)',
                  borderRadius: 1,
                  backgroundColor: '#FFFFFF',
                }}
              />
            ) : (
              <Alert severity="info">
                Click "View PDF" to generate and display the PDF report.
              </Alert>
            )}
          </Box>
        )}

        {/* Slideshow Info */}
        {report.format === 'slideshow' && (
          <Alert severity="info">
            This is an AI-generated slideshow report. You can view it in a new tab or download it as an HTML file.
          </Alert>
        )}
      </DialogContent>

      <DialogActions
        sx={{
          p: 2,
          borderTop: '1px solid rgba(0, 229, 255, 0.2)',
        }}
      >
        <Button
          onClick={onClose}
          sx={{
            color: '#B0B0B0',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
            },
          }}
        >
          Close
        </Button>
        {report.format === 'pdf' ? (
          <>
            {!pdfUrl && (
              <Button
                onClick={loadPDF}
                variant="outlined"
                startIcon={<VisibilityIcon />}
                sx={{
                  borderColor: '#00E5FF',
                  color: '#00E5FF',
                  '&:hover': {
                    borderColor: '#00E5FF',
                    backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  },
                }}
              >
                View PDF
              </Button>
            )}
            <Button
              onClick={handleDownloadPDF}
              variant="contained"
              startIcon={<DownloadIcon />}
              sx={{
                backgroundColor: '#00E5FF',
                color: '#121633',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: '#00B8D4',
                },
              }}
            >
              Download PDF
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={handleViewSlideshow}
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              sx={{
                borderColor: '#00E5FF',
                color: '#00E5FF',
                '&:hover': {
                  borderColor: '#00E5FF',
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                },
              }}
            >
              View in New Tab
            </Button>
            <Button
              onClick={handleDownloadSlideshow}
              variant="contained"
              startIcon={<DownloadIcon />}
              sx={{
                backgroundColor: '#00E5FF',
                color: '#121633',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: '#00B8D4',
                },
              }}
            >
              Download HTML
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

