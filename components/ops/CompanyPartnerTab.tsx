'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Business as BusinessIcon,
  AttachMoney as AttachMoneyIcon,
  CheckCircle as CheckCircleIcon,
  Pending as PendingIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { PartnerCommissionStatus } from '@/types/ops';

interface PartnerStats {
  partner: {
    id: string;
    name: string;
    commission_rate: number | null;
  };
  summary: {
    referred_companies_count: number;
    referred_opportunities_count: number;
    converted_opportunities_count: number;
    referred_projects_count: number;
    total_revenue: number;
    pipeline_value: number;
    pending_commission: number;
    paid_commission: number;
    total_commission: number;
  };
  referred_companies: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
  }>;
  referred_opportunities: Array<{
    id: string;
    name: string;
    value: number | null;
    status: string;
    created_at: string;
    company?: { id: string; name: string } | null;
  }>;
  referred_projects: Array<{
    id: string;
    name: string;
    status: string;
    created_at: string;
    company?: { id: string; name: string } | null;
  }>;
  commissions: Array<{
    id: string;
    commission_rate: number;
    base_amount: number;
    commission_amount: number;
    status: string;
    payment_reference: string | null;
    notes: string | null;
    created_at: string;
    paid_at: string | null;
    opportunity?: {
      id: string;
      name: string;
      value: number | null;
    } | null;
  }>;
}

interface CompanyPartnerTabProps {
  companyId: string;
}

export default function CompanyPartnerTab({ companyId }: CompanyPartnerTabProps) {
  const theme = useTheme();
  const router = useRouter();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PartnerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Commission dialog state
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [newCommission, setNewCommission] = useState({
    opportunity_id: '',
    base_amount: '',
    commission_rate: '',
    notes: '',
  });
  
  // Update status dialog
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<{ id: string; status: string } | null>(null);
  const [newStatus, setNewStatus] = useState<PartnerCommissionStatus>('pending');
  const [paymentReference, setPaymentReference] = useState('');

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/partners/${companyId}/stats`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load partner stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load partner stats';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleCreateCommission = async () => {
    try {
      setCommissionLoading(true);
      
      const response = await fetch(`/api/ops/partners/${companyId}/commissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunity_id: newCommission.opportunity_id || null,
          base_amount: parseFloat(newCommission.base_amount),
          commission_rate: newCommission.commission_rate ? parseFloat(newCommission.commission_rate) : undefined,
          notes: newCommission.notes || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create commission');
      }

      showSuccess('Commission created successfully');
      setCommissionDialogOpen(false);
      setNewCommission({ opportunity_id: '', base_amount: '', commission_rate: '', notes: '' });
      loadStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create commission';
      showError(errorMessage);
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedCommission) return;

    try {
      setCommissionLoading(true);
      
      const response = await fetch(`/api/ops/partners/${companyId}/commissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_id: selectedCommission.id,
          status: newStatus,
          payment_reference: paymentReference || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update commission');
      }

      showSuccess('Commission updated successfully');
      setUpdateDialogOpen(false);
      setSelectedCommission(null);
      setNewStatus('pending');
      setPaymentReference('');
      loadStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update commission';
      showError(errorMessage);
    } finally {
      setCommissionLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'approved': return '#2196F3';
      case 'paid': return '#4CAF50';
      case 'cancelled': return '#F44336';
      default: return theme.palette.text.secondary;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return (
      <Alert severity="info" sx={{ mt: 2 }}>
        No partner statistics available
      </Alert>
    );
  }

  return (
    <Box>
      {/* Summary Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={6} sm={4} md={2.4}>
          <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <BusinessIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Companies
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {stats.summary.referred_companies_count}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TrendingUpIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Opportunities
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {stats.summary.referred_opportunities_count}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              {stats.summary.converted_opportunities_count} converted
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <FolderIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Projects
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {stats.summary.referred_projects_count}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <AttachMoneyIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Revenue
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
              {formatCurrency(stats.summary.total_revenue)}
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Pipeline: {formatCurrency(stats.summary.pipeline_value)}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={4} md={2.4}>
          <Paper sx={{ p: 2, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckCircleIcon sx={{ color: theme.palette.text.secondary, fontSize: 20 }} />
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                Commissions
              </Typography>
            </Box>
            <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 600 }}>
              {formatCurrency(stats.summary.paid_commission)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#FF9800' }}>
              Pending: {formatCurrency(stats.summary.pending_commission)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Referred Companies */}
      <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 2 }}>
          Referred Companies ({stats.referred_companies.length})
        </Typography>
        {stats.referred_companies.length === 0 ? (
          <Typography sx={{ color: theme.palette.text.secondary }}>No referred companies yet</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Company</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Status</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Referred Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.referred_companies.map((company) => (
                  <TableRow 
                    key={company.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/ops/companies/${company.id}`)}
                  >
                    <TableCell sx={{ color: theme.palette.text.primary }}>{company.name}</TableCell>
                    <TableCell>
                      <Chip label={company.status} size="small" sx={{ backgroundColor: theme.palette.action.hover }} />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{formatDate(company.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Referred Opportunities */}
      <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 2 }}>
          Referred Opportunities ({stats.referred_opportunities.length})
        </Typography>
        {stats.referred_opportunities.length === 0 ? (
          <Typography sx={{ color: theme.palette.text.secondary }}>No referred opportunities yet</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Opportunity</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Company</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Value</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Status</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.referred_opportunities.map((opp) => (
                  <TableRow key={opp.id} hover>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{opp.name}</TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{opp.company?.name || '-'}</TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{opp.value ? formatCurrency(opp.value) : '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={opp.status} 
                        size="small" 
                        sx={{ 
                          backgroundColor: opp.status === 'converted' ? '#4CAF50' : 
                                          opp.status === 'lost' ? '#F44336' : theme.palette.action.hover,
                          color: ['converted', 'lost'].includes(opp.status) ? '#fff' : theme.palette.text.primary,
                        }} 
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{formatDate(opp.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Referred Projects */}
      <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, mb: 3 }}>
        <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600, mb: 2 }}>
          Referred Projects ({stats.referred_projects?.length || 0})
        </Typography>
        {(!stats.referred_projects || stats.referred_projects.length === 0) ? (
          <Typography sx={{ color: theme.palette.text.secondary }}>No referred projects yet</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Project</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Company</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Status</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.referred_projects.map((project) => (
                  <TableRow 
                    key={project.id} 
                    hover 
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/project/${project.id}`)}
                  >
                    <TableCell sx={{ color: theme.palette.text.primary }}>{project.name}</TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{project.company?.name || '-'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={project.status} 
                        size="small" 
                        sx={{ 
                          backgroundColor: project.status === 'completed' ? '#4CAF50' : 
                                          project.status === 'cancelled' ? '#F44336' : 
                                          project.status === 'active' ? '#2196F3' : theme.palette.action.hover,
                          color: ['completed', 'cancelled', 'active'].includes(project.status) ? '#fff' : theme.palette.text.primary,
                        }} 
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{formatDate(project.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Commissions */}
      <Paper sx={{ p: 3, backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Commission Records ({stats.commissions.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={loadStats} size="small">
                <RefreshIcon sx={{ color: theme.palette.text.secondary }} />
              </IconButton>
            </Tooltip>
            <Button
              startIcon={<AddIcon />}
              variant="outlined"
              size="small"
              onClick={() => setCommissionDialogOpen(true)}
              sx={{ borderColor: theme.palette.divider, color: theme.palette.text.primary }}
            >
              Add Commission
            </Button>
          </Box>
        </Box>
        {stats.commissions.length === 0 ? (
          <Typography sx={{ color: theme.palette.text.secondary }}>No commission records yet</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Opportunity</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Base Amount</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Rate</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Commission</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Status</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Date</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stats.commissions.map((commission) => (
                  <TableRow key={commission.id} hover>
                    <TableCell sx={{ color: theme.palette.text.primary }}>
                      {commission.opportunity?.name || 'Manual Entry'}
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{formatCurrency(commission.base_amount)}</TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>{commission.commission_rate}%</TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                      {formatCurrency(commission.commission_amount)}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={commission.status} 
                        size="small" 
                        sx={{ backgroundColor: getStatusColor(commission.status), color: '#fff' }} 
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>
                      {formatDate(commission.created_at)}
                      {commission.paid_at && (
                        <Typography variant="caption" display="block" sx={{ color: '#4CAF50' }}>
                          Paid: {formatDate(commission.paid_at)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {commission.status !== 'paid' && commission.status !== 'cancelled' && (
                        <Button
                          size="small"
                          onClick={() => {
                            setSelectedCommission({ id: commission.id, status: commission.status });
                            setNewStatus(commission.status === 'pending' ? 'approved' : 'paid');
                            setUpdateDialogOpen(true);
                          }}
                          sx={{ color: theme.palette.text.primary }}
                        >
                          Update
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add Commission Dialog */}
      <Dialog open={commissionDialogOpen} onClose={() => setCommissionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: theme.palette.text.primary }}>Add Commission Record</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Opportunity (Optional)</InputLabel>
            <Select
              value={newCommission.opportunity_id}
              label="Opportunity (Optional)"
              onChange={(e) => setNewCommission({ ...newCommission, opportunity_id: e.target.value })}
            >
              <MenuItem value="">Manual Entry</MenuItem>
              {stats.referred_opportunities.filter(o => o.status === 'converted').map((opp) => (
                <MenuItem key={opp.id} value={opp.id}>
                  {opp.name} ({opp.value ? formatCurrency(opp.value) : 'No value'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Base Amount ($)"
            type="number"
            value={newCommission.base_amount}
            onChange={(e) => setNewCommission({ ...newCommission, base_amount: e.target.value })}
            margin="normal"
            required
          />
          <TextField
            fullWidth
            label="Commission Rate (%) - Leave blank to use partner's default"
            type="number"
            value={newCommission.commission_rate}
            onChange={(e) => setNewCommission({ ...newCommission, commission_rate: e.target.value })}
            margin="normal"
            helperText={stats.partner.commission_rate ? `Partner default: ${stats.partner.commission_rate}%` : 'No default rate set'}
          />
          <TextField
            fullWidth
            label="Notes"
            value={newCommission.notes}
            onChange={(e) => setNewCommission({ ...newCommission, notes: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommissionDialogOpen(false)} sx={{ color: theme.palette.text.secondary }}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateCommission} 
            disabled={commissionLoading || !newCommission.base_amount}
            variant="contained"
          >
            {commissionLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onClose={() => setUpdateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: theme.palette.text.primary }}>Update Commission Status</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Status</InputLabel>
            <Select
              value={newStatus}
              label="Status"
              onChange={(e) => setNewStatus(e.target.value as PartnerCommissionStatus)}
            >
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
          {newStatus === 'paid' && (
            <TextField
              fullWidth
              label="Payment Reference (check #, transaction ID, etc.)"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              margin="normal"
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUpdateDialogOpen(false)} sx={{ color: theme.palette.text.secondary }}>
            Cancel
          </Button>
          <Button onClick={handleUpdateStatus} disabled={commissionLoading} variant="contained">
            {commissionLoading ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

