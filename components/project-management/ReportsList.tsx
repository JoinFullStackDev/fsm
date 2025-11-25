'use client';

import { useEffect, useState } from 'react';
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
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
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
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const loadReports = async () => {
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
  };

  useEffect(() => {
    if (projectId) {
      loadReports();
    }
  }, [projectId, refreshTrigger]);

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedReport(null);
  };

  const getReportTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress sx={{ color: '#00E5FF' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography
        variant="h5"
        sx={{
          color: '#00E5FF',
          fontWeight: 600,
          mb: 3,
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
            backgroundColor: '#121633',
            border: '1px solid rgba(0, 229, 255, 0.2)',
            borderRadius: 2,
          }}
        >
          <Table>
            <TableHead sx={{ backgroundColor: '#0A0E27' }}>
              <TableRow>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  Type
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  Format
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  Date Range
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  Created
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
                  }}
                >
                  Created By
                </TableCell>
                <TableCell
                  sx={{
                    backgroundColor: '#0A0E27',
                    color: '#00E5FF',
                    fontWeight: 600,
                    borderBottom: '2px solid rgba(0, 229, 255, 0.3)',
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
                    '&:hover': {
                      backgroundColor: 'rgba(0, 229, 255, 0.05)',
                    },
                  }}
                >
                  <TableCell sx={{ color: '#E0E0E0' }}>
                    <Chip
                      label={getReportTypeLabel(report.report_type)}
                      size="small"
                      sx={{
                        backgroundColor: 'rgba(0, 229, 255, 0.2)',
                        color: '#00E5FF',
                      }}
                    />
                    {report.report_type === 'forecast' && report.forecast_days && (
                      <Typography variant="caption" sx={{ color: '#B0B0B0', ml: 1 }}>
                        ({report.forecast_days} days)
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ color: '#E0E0E0' }}>
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
                  </TableCell>
                  <TableCell sx={{ color: '#E0E0E0' }}>{report.date_range}</TableCell>
                  <TableCell sx={{ color: '#E0E0E0' }}>
                    {format(new Date(report.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell sx={{ color: '#E0E0E0' }}>
                    {report.user?.name || report.user?.email || 'Unknown'}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'right' }}>
                    <IconButton
                      onClick={() => handleViewReport(report)}
                      sx={{
                        color: '#00E5FF',
                        '&:hover': {
                          backgroundColor: 'rgba(0, 229, 255, 0.1)',
                        },
                      }}
                    >
                      <VisibilityIcon />
                    </IconButton>
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
    </Box>
  );
}

