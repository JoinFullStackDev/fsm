'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Pagination,
  SelectChangeEvent,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  History as HistoryIcon,
  FileDownload as FileDownloadIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import EmptyState from '@/components/ui/EmptyState';
import { formatFileSize, getExportTypeLabel, getExportTypeColor, generateExportFilename } from '@/lib/utils/exportHelpers';
import type { ExportWithUser, Project, ExportListResponse } from '@/types/project';

const EXPORT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'blueprint_bundle', label: 'Blueprint Bundle' },
  { value: 'cursor_bundle', label: 'Cursor Bundle' },
  { value: 'prd', label: 'PRD' },
];

const DATE_RANGES = [
  { value: '', label: 'All Time' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

const PAGE_SIZES = [10, 20, 50, 100];

export default function ExportHistoryPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const { showSuccess, showError } = useNotification();
  const [project, setProject] = useState<Project | null>(null);
  const [exports, setExports] = useState<ExportWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and pagination state
  const [exportTypeFilter, setExportTypeFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to load project');
      }
      const projectData = await response.json();
      setProject(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project');
      setLoading(false);
    }
  }, [projectId]);

  const loadExports = useCallback(async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      let startDate: string | null = null;
      let endDate: string | null = null;
      
      if (dateRangeFilter) {
        const days = parseInt(dateRangeFilter);
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (exportTypeFilter) {
        params.append('export_type', exportTypeFilter);
      }
      if (startDate) {
        params.append('start_date', startDate);
      }
      if (endDate) {
        params.append('end_date', endDate);
      }
      params.append('limit', String(pageSize));
      params.append('offset', String((currentPage - 1) * pageSize));

      const response = await fetch(`/api/projects/${projectId}/exports?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load exports');
      }

      const data: ExportListResponse = await response.json();
      setExports(data.exports);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load export history');
      setExports([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, exportTypeFilter, dateRangeFilter, currentPage, pageSize]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (project) {
      loadExports();
    }
  }, [project, loadExports]);

  const handleDownload = async (exportItem: ExportWithUser) => {
    try {
      // Trigger the export again to download
      const endpoint = exportItem.export_type === 'blueprint_bundle'
        ? `/api/projects/${projectId}/export/blueprint`
        : `/api/projects/${projectId}/export/cursor`;

      const response = await fetch(new URL(endpoint, window.location.origin).toString(), {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate export');
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const filename = generateExportFilename(project?.name || 'export', exportItem.export_type);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showSuccess('Export downloaded successfully!');
    } catch (err) {
      showError(`Failed to download export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleFilterChange = (type: 'export_type' | 'date_range', value: string) => {
    if (type === 'export_type') {
      setExportTypeFilter(value);
    } else {
      setDateRangeFilter(value);
    }
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const handleClearFilters = () => {
    setExportTypeFilter('');
    setDateRangeFilter('');
    setCurrentPage(1);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (event: SelectChangeEvent<number>) => {
    setPageSize(event.target.value as number);
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate statistics
  const stats = {
    total: total,
    byType: exports.reduce((acc, exp) => {
      acc[exp.export_type] = (acc[exp.export_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    mostRecent: exports.length > 0 ? exports[0]?.created_at : null,
  };

  const hasActiveFilters = exportTypeFilter || dateRangeFilter;
  const totalPages = Math.ceil(total / pageSize);

  if (loading && !project) {
    return (
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
        <LoadingSkeleton />
      </Box>
    );
  }

  if (error && !project) {
    return (
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
        <Alert
          severity="error"
          sx={{
            mb: 3,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {error}
        </Alert>
        <Button
          onClick={() => router.push(`/project/${projectId}`)}
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          sx={{
            borderColor: theme.palette.text.primary,
            color: theme.palette.text.primary,
            '&:hover': {
              borderColor: theme.palette.text.primary,
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          Back to Project
        </Button>
      </Box>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                color: theme.palette.text.primary,
              }}
            >
              Export History
            </Typography>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push(`/project/${projectId}`)}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              Back to Project
            </Button>
          </Box>

          {/* Statistics Summary */}
          {stats.total > 0 && (
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={4}>
                <Box
                  component={Paper}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                    Total Exports
                  </Typography>
                  <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                    {stats.total}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  component={Paper}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                    Most Recent
                  </Typography>
                  <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                    {stats.mostRecent ? formatDate(stats.mostRecent) : 'N/A'}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box
                  component={Paper}
                  sx={{
                    p: 2,
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                    By Type
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(stats.byType).map(([type, count]) => (
                      <Chip
                        key={type}
                        label={`${getExportTypeLabel(type)}: ${count}`}
                        size="small"
                        color={getExportTypeColor(type)}
                      />
                    ))}
                  </Box>
                </Box>
              </Grid>
            </Grid>
          )}

          {/* Filters */}
          <Box
            component={Paper}
            sx={{
              p: 3,
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              mb: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <FilterListIcon sx={{ color: theme.palette.text.primary }} />
              <Typography variant="h6" sx={{ color: theme.palette.text.primary, flexGrow: 1 }}>
                Filters
              </Typography>
              {hasActiveFilters && (
                <Button
                  size="small"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  sx={{ color: theme.palette.text.secondary }}
                >
                  Clear Filters
                </Button>
              )}
            </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Export Type</InputLabel>
                    <Select
                      value={exportTypeFilter}
                      onChange={(e) => handleFilterChange('export_type', e.target.value)}
                      label="Export Type"
                      sx={{
                        color: theme.palette.text.primary,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.divider,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.text.primary,
                        },
                      }}
                    >
                      {EXPORT_TYPES.map((type) => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Date Range</InputLabel>
                    <Select
                      value={dateRangeFilter}
                      onChange={(e) => handleFilterChange('date_range', e.target.value)}
                      label="Date Range"
                      sx={{
                        color: theme.palette.text.primary,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.divider,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.text.primary,
                        },
                      }}
                    >
                      {DATE_RANGES.map((range) => (
                        <MenuItem key={range.value} value={range.value}>
                          {range.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth>
                    <InputLabel sx={{ color: theme.palette.text.secondary }}>Page Size</InputLabel>
                    <Select
                      value={pageSize}
                      onChange={handlePageSizeChange}
                      label="Page Size"
                      sx={{
                        color: theme.palette.text.primary,
                        '& .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.divider,
                        },
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: theme.palette.text.primary,
                        },
                      }}
                    >
                      {PAGE_SIZES.map((size) => (
                        <MenuItem key={size} value={size}>
                          {size}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

          {/* Exports Table */}
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <Alert
              severity="error"
              sx={{
                mb: 3,
                backgroundColor: theme.palette.action.hover,
                border: `1px solid ${theme.palette.divider}`,
                color: theme.palette.text.primary,
              }}
            >
              {error}
            </Alert>
          ) : exports.length === 0 ? (
            <EmptyState
              icon={<HistoryIcon />}
              title="No Exports Found"
              description={
                hasActiveFilters
                  ? "No exports match your current filters. Try adjusting your filters or clear them to see all exports."
                  : "You haven't generated any exports for this project yet. Create a Blueprint or Cursor bundle to get started."
              }
              actionLabel={hasActiveFilters ? "Clear Filters" : "Back to Project"}
              onAction={hasActiveFilters ? handleClearFilters : () => router.push(`/project/${projectId}`)}
            />
          ) : (
            <>
              <Box
                component={Paper}
                sx={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  mb: 2,
                }}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Created</TableCell>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Created By</TableCell>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>File Size</TableCell>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Status</TableCell>
                        <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }} align="right">
                          Actions
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {exports.map((exportItem) => (
                        <TableRow
                          key={exportItem.id}
                          sx={{
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <TableCell sx={{ color: theme.palette.text.primary }}>
                            <Chip
                              label={getExportTypeLabel(exportItem.export_type)}
                              color={getExportTypeColor(exportItem.export_type)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell sx={{ color: theme.palette.text.secondary }}>
                            {formatDate(exportItem.created_at)}
                          </TableCell>
                          <TableCell sx={{ color: theme.palette.text.secondary }}>
                            {exportItem.user ? (
                              <Tooltip title={exportItem.user.email}>
                                <Typography variant="body2">
                                  {exportItem.user.name}
                                </Typography>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}>
                                Unknown
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ color: theme.palette.text.secondary }}>
                            {formatFileSize(exportItem.file_size)}
                          </TableCell>
                          <TableCell sx={{ color: theme.palette.text.secondary }}>
                            {exportItem.storage_path ? (
                              <Chip label="Stored" color="success" size="small" />
                            ) : (
                              <Chip label="On-Demand" color="default" size="small" />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Download Export">
                              <IconButton
                                onClick={() => handleDownload(exportItem)}
                                sx={{
                                  color: theme.palette.text.primary,
                                  '&:hover': {
                                    backgroundColor: theme.palette.action.hover,
                                  },
                                }}
                              >
                                <FileDownloadIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>

              {/* Pagination */}
              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total} exports
                  </Typography>
                  <Pagination
                    count={totalPages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    sx={{
                      '& .MuiPaginationItem-root': {
                        color: theme.palette.text.secondary,
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.text.primary,
                          color: theme.palette.background.default,
                        },
                      },
                    }}
                  />
                </Box>
              )}
            </>
          )}
      </Box>
    </ErrorBoundary>
  );
}
