'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Collapse,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  FilterList as FilterListIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/lib/hooks/useNotification';
import { format } from 'date-fns';

interface OrganizationAIDetailSlideoutProps {
  open: boolean;
  organizationId: string | null;
  organizationName: string | null;
  onClose: () => void;
}

interface RequestDetail {
  id: string;
  timestamp: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  feature: string;
  prompt_length: number;
  response_length: number;
  total_characters: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number;
  response_time_ms: number;
  model: string;
  error: string | null;
  error_type: string | null;
  metadata: any;
}

interface AggregatedStats {
  totalRequests: number;
  totalCost: number;
  totalCharacters: number;
  totalTokens: number;
  averageResponseTime: number;
  errorRate: number;
  errorCount: number;
}

interface FeatureStats {
  feature: string;
  requests: number;
  total_characters: number;
  total_tokens: number;
  total_cost: number;
  average_response_time_ms: number;
  error_count: number;
  error_rate: number;
}

export default function OrganizationAIDetailSlideout({
  open,
  organizationId,
  organizationName,
  onClose,
}: OrganizationAIDetailSlideoutProps) {
  const theme = useTheme();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [aggregated, setAggregated] = useState<AggregatedStats | null>(null);
  const [byFeature, setByFeature] = useState<FeatureStats[]>([]);
  const [requests, setRequests] = useState<RequestDetail[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    feature: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 100,
    offset: 0,
  });

  const loadDetails = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      setPagination((currentPagination) => {
        const params = new URLSearchParams({
          limit: currentPagination.limit.toString(),
          offset: currentPagination.offset.toString(),
        });

        if (filters.feature) {
          params.append('feature', filters.feature);
        }
        if (filters.startDate) {
          params.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
          params.append('endDate', filters.endDate);
        }

        fetch(
          `/api/global/admin/ai-usage/${organizationId}?${params.toString()}`
        )
          .then((response) => {
            if (!response.ok) {
              throw new Error('Failed to load organization details');
            }
            return response.json();
          })
          .then((data) => {
            setAggregated(data.aggregated);
            setByFeature(data.byFeature || []);
            setRequests(data.requests || []);
            setPagination((prev) => data.pagination || prev);
          })
          .catch((err) => {
            showError('Failed to load organization AI usage details');
          })
          .finally(() => {
            setLoading(false);
          });

        return currentPagination;
      });
    } catch (err) {
      showError('Failed to load organization AI usage details');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, filters, showError]);

  useEffect(() => {
    if (open && organizationId) {
      loadDetails();
    }
  }, [open, organizationId, loadDetails]);

  const toggleRow = (requestId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRows(newExpanded);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPagination((prev) => ({ ...prev, offset: 0 })); // Reset to first page
  };

  const handleResetFilters = () => {
    setFilters({ feature: '', startDate: '', endDate: '' });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const drawerWidth = 900;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: drawerWidth,
          maxWidth: '95vw',
          backgroundColor: theme.palette.background.paper,
          transform: 'translateY(60px) !important',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 60px)' }}>
        {/* Header */}
        <Box
          sx={{
            p: 3,
            borderBottom: `1px solid ${theme.palette.divider}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              AI Usage Details
            </Typography>
            {organizationName && (
              <Typography variant="body2" color="text.secondary">
                {organizationName}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Aggregated Statistics */}
              {aggregated && (
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Aggregated Statistics
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Total Requests
                      </Typography>
                      <Typography variant="h6">{aggregated.totalRequests}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Total Cost
                      </Typography>
                      <Typography variant="h6">
                        ${aggregated.totalCost.toFixed(4)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Total Characters
                      </Typography>
                      <Typography variant="h6">
                        {aggregated.totalCharacters.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Total Tokens
                      </Typography>
                      <Typography variant="h6">
                        {aggregated.totalTokens.toLocaleString()}
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Avg Response Time
                      </Typography>
                      <Typography variant="h6">
                        {aggregated.averageResponseTime}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={6} sm={4}>
                      <Typography variant="body2" color="text.secondary">
                        Error Rate
                      </Typography>
                      <Typography variant="h6" color={aggregated.errorRate > 5 ? 'error' : 'text.primary'}>
                        {aggregated.errorRate.toFixed(2)}%
                      </Typography>
                    </Grid>
                  </Grid>
                </Paper>
              )}

              {/* Usage by Feature */}
              {byFeature.length > 0 && (
                <Paper sx={{ p: 3, mb: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Usage by Feature
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>Feature</strong></TableCell>
                          <TableCell align="right"><strong>Requests</strong></TableCell>
                          <TableCell align="right"><strong>Characters</strong></TableCell>
                          <TableCell align="right"><strong>Tokens</strong></TableCell>
                          <TableCell align="right"><strong>Cost</strong></TableCell>
                          <TableCell align="right"><strong>Avg Time</strong></TableCell>
                          <TableCell align="right"><strong>Errors</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {byFeature.map((feature) => (
                          <TableRow key={feature.feature}>
                            <TableCell>{feature.feature}</TableCell>
                            <TableCell align="right">{feature.requests}</TableCell>
                            <TableCell align="right">
                              {feature.total_characters.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              {feature.total_tokens.toLocaleString()}
                            </TableCell>
                            <TableCell align="right">
                              ${feature.total_cost.toFixed(4)}
                            </TableCell>
                            <TableCell align="right">
                              {feature.average_response_time_ms}ms
                            </TableCell>
                            <TableCell align="right">
                              <Chip
                                label={`${feature.error_count} (${feature.error_rate.toFixed(1)}%)`}
                                size="small"
                                color={feature.error_rate > 5 ? 'error' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              )}

              {/* Filters */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Feature</InputLabel>
                    <Select
                      value={filters.feature}
                      label="Feature"
                      onChange={(e) => handleFilterChange('feature', e.target.value)}
                    >
                      <MenuItem value="">All Features</MenuItem>
                      {byFeature.map((f) => (
                        <MenuItem key={f.feature} value={f.feature}>
                          {f.feature}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Start Date"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 150 }}
                  />
                  <TextField
                    size="small"
                    label="End Date"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 150 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleResetFilters}
                    startIcon={<FilterListIcon />}
                  >
                    Reset
                  </Button>
                </Box>
              </Paper>

              {/* Individual Requests */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Individual Requests ({pagination.total})
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell width="40px"></TableCell>
                        <TableCell><strong>Timestamp</strong></TableCell>
                        <TableCell><strong>User</strong></TableCell>
                        <TableCell><strong>Feature</strong></TableCell>
                        <TableCell align="right"><strong>Chars</strong></TableCell>
                        <TableCell align="right"><strong>Tokens</strong></TableCell>
                        <TableCell align="right"><strong>Cost</strong></TableCell>
                        <TableCell align="right"><strong>Time</strong></TableCell>
                        <TableCell><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {requests.length > 0 ? (
                        requests.map((request) => {
                          const isExpanded = expandedRows.has(request.id);
                          return (
                            <>
                              <TableRow
                                key={request.id}
                                hover
                                sx={{ cursor: 'pointer' }}
                                onClick={() => toggleRow(request.id)}
                              >
                                <TableCell>
                                  <IconButton size="small">
                                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                  </IconButton>
                                </TableCell>
                                <TableCell>
                                  {format(new Date(request.timestamp), 'MMM d, yyyy HH:mm')}
                                </TableCell>
                                <TableCell>
                                  {request.user ? request.user.name || request.user.email : 'Unknown'}
                                </TableCell>
                                <TableCell>{request.feature}</TableCell>
                                <TableCell align="right">
                                  {request.total_characters.toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                  {request.total_tokens.toLocaleString()}
                                </TableCell>
                                <TableCell align="right">
                                  ${request.cost.toFixed(4)}
                                </TableCell>
                                <TableCell align="right">
                                  {request.response_time_ms}ms
                                </TableCell>
                                <TableCell>
                                  {request.error ? (
                                    <Chip
                                      label="Error"
                                      size="small"
                                      color="error"
                                    />
                                  ) : (
                                    <Chip
                                      label="Success"
                                      size="small"
                                      color="success"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell
                                  colSpan={9}
                                  sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}
                                >
                                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                    <Box sx={{ p: 2, backgroundColor: theme.palette.background.default }}>
                                      <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Prompt Details
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Length: {request.prompt_length.toLocaleString()} chars
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Input Tokens: {request.input_tokens.toLocaleString()}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Response Details
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Length: {request.response_length.toLocaleString()} chars
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Output Tokens: {request.output_tokens.toLocaleString()}
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Model & Performance
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Model: {request.model}
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            Response Time: {request.response_time_ms}ms
                                          </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                          <Typography variant="subtitle2" gutterBottom>
                                            Cost
                                          </Typography>
                                          <Typography variant="body2" color="text.secondary">
                                            ${request.cost.toFixed(6)}
                                          </Typography>
                                        </Grid>
                                        {request.error && (
                                          <Grid item xs={12}>
                                            <Alert severity="error">
                                              <Typography variant="subtitle2">Error</Typography>
                                              <Typography variant="body2">{request.error}</Typography>
                                              {request.error_type && (
                                                <Typography variant="caption" color="text.secondary">
                                                  Type: {request.error_type}
                                                </Typography>
                                              )}
                                            </Alert>
                                          </Grid>
                                        )}
                                      </Grid>
                                    </Box>
                                  </Collapse>
                                </TableCell>
                              </TableRow>
                            </>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No requests found
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

