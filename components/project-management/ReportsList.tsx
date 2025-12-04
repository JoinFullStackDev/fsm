'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Visibility as VisibilityIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import ReportDetailModal from './ReportDetailModal';

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

interface ReportsListProps {
  projectId: string;
  refreshTrigger?: number;
}

export default function ReportsList({ projectId, refreshTrigger }: ReportsListProps) {
  const theme = useTheme();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/reports`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load reports');
      }

      const data = await response.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      loadReports();
    }
  }, [projectId, refreshTrigger, loadReports]);

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReport(null);
  };

  const handleDeleteClick = (report: Report) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!reportToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/reports?reportId=${reportToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete report');
      }

      // Refresh the reports list
      await loadReports();
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setReportToDelete(null);
  };

  const getReportTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3, backgroundColor: theme.palette.action.hover, color: theme.palette.text.primary, border: `1px solid ${theme.palette.divider}` }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ px: { xs: 0, md: 0 } }}>
      <Typography
        variant="h5"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 600,
          mb: 3,
          fontSize: { xs: '1.25rem', md: '1.5rem' },
        }}
      >
        Generated Reports
      </Typography>

      {/* Reports Table */}
      {reports.length === 0 ? (
        <Alert severity="info">
          No reports have been generated yet. Generate your first report using the Generate Report tab.
        </Alert>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 2,
            overflowX: 'auto',
            '& .MuiTableCell-root': {
              fontSize: { xs: '0.75rem', md: '0.875rem' },
              padding: { xs: '8px 4px', md: '16px' },
            },
          }}
        >
          <Table>
            <TableHead sx={{ backgroundColor: theme.palette.background.paper }}>
              <TableRow>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  Type
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  Format
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  Date Range
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  Created
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  Created By
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: theme.palette.background.paper,
                    color: theme.palette.text.primary,
                    fontWeight: 600,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    textAlign: 'right',
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.id}
                  sx={{
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <TableCell sx={{ color: theme.palette.text.primary }}>
                    <Chip
                      label={getReportTypeLabel(report.report_type)}
                      size="small"
                      sx={{
                        backgroundColor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                    {report.report_type === 'forecast' && report.forecast_days && (
                      <Typography variant="caption" sx={{ color: theme.palette.text.secondary, ml: 1 }}>
                        ({report.forecast_days} days)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: theme.palette.text.primary }}>
                    <Chip
                      label={report.format.toUpperCase()}
                      size="small"
                      sx={{
                        backgroundColor: theme.palette.action.hover,
                        color: theme.palette.text.primary,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: theme.palette.text.primary }}>{report.date_range}</TableCell>
                  <TableCell sx={{ color: theme.palette.text.primary }}>
                    {format(new Date(report.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell sx={{ color: theme.palette.text.primary }}>
                    {report.user?.name || report.user?.email || 'Unknown'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <IconButton
                        onClick={() => handleViewReport(report)}
                        sx={{
                          color: theme.palette.text.primary,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        }}
                        title="View Report"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => handleDeleteClick(report)}
                        sx={{
                          color: theme.palette.error.main,
                          '&:hover': {
                            backgroundColor: theme.palette.error.main + '20',
                          },
                        }}
                        title="Delete Report"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          open={modalOpen}
          report={selectedReport}
          projectId={projectId}
          onClose={handleCloseModal}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.text.primary }}>
          Delete Report
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.text.secondary }}>
            Are you sure you want to delete this report? This action cannot be undone.
            {reportToDelete && (
              <>
                <br />
                <br />
                <strong>
                  {getReportTypeLabel(reportToDelete.report_type)}
                  {reportToDelete.report_type === 'forecast' && reportToDelete.forecast_days
                    ? ` (${reportToDelete.forecast_days} days)`
                    : ''}
                </strong>
                {' - '}
                {reportToDelete.date_range}
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            onClick={handleDeleteCancel}
            disabled={deleting}
            sx={{
              color: theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="contained"
            color="error"
            sx={{
              backgroundColor: theme.palette.error.main,
              color: theme.palette.error.contrastText,
              '&:hover': {
                backgroundColor: theme.palette.error.dark,
              },
              '&.Mui-disabled': {
                backgroundColor: theme.palette.action.disabledBackground,
                color: theme.palette.action.disabled,
              },
            }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

