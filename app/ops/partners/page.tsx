'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  Handshake as HandshakeIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as AttachMoneyIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { PartnerCompanyWithStats } from '@/types/ops';

export default function PartnersPage() {
  const theme = useTheme();
  const router = useRouter();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState<PartnerCompanyWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadPartners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ops/partners');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load partners');
      }

      const result = await response.json();
      setPartners(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load partners';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  // Calculate totals
  const totals = partners.reduce(
    (acc, partner) => ({
      referred_companies: acc.referred_companies + (partner.referred_companies_count || 0),
      referred_opportunities: acc.referred_opportunities + (partner.referred_opportunities_count || 0),
      referred_projects: acc.referred_projects + (partner.referred_projects_count || 0),
      total_revenue: acc.total_revenue + (partner.total_referred_revenue || 0),
      commission_due: acc.commission_due + (partner.total_commission_due || 0),
      commission_paid: acc.commission_paid + (partner.total_commission_paid || 0),
    }),
    { referred_companies: 0, referred_opportunities: 0, referred_projects: 0, total_revenue: 0, commission_due: 0, commission_paid: 0 }
  );

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <HandshakeIcon sx={{ fontSize: 32, color: theme.palette.text.primary }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
            }}
          >
            Partners
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={loadPartners} sx={{ color: theme.palette.text.primary }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/ops/companies/new')}
            sx={{
              backgroundColor: theme.palette.text.primary,
              color: theme.palette.background.default,
              fontWeight: 600,
              '&:hover': {
                backgroundColor: theme.palette.action.hover,
                color: theme.palette.text.primary,
              },
            }}
          >
            Add Partner Company
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Total Partners
          </Typography>
          <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {partners.length}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Referred Companies
          </Typography>
          <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {totals.referred_companies}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Referred Projects
          </Typography>
          <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {totals.referred_projects}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Total Revenue Generated
          </Typography>
          <Typography variant="h4" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            {formatCurrency(totals.total_revenue)}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Commissions Due
          </Typography>
          <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 600 }}>
            {formatCurrency(totals.commission_due)}
          </Typography>
        </Paper>
        <Paper sx={{ p: 2, flex: '1 1 200px', backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
            Commissions Paid
          </Typography>
          <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 600 }}>
            {formatCurrency(totals.commission_paid)}
          </Typography>
        </Paper>
      </Box>

      {/* Partners Table */}
      <Paper sx={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: theme.palette.text.primary }} />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : partners.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <HandshakeIcon sx={{ fontSize: 64, color: theme.palette.text.secondary, mb: 2 }} />
            <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1 }}>
              No Partners Yet
            </Typography>
            <Typography sx={{ color: theme.palette.text.secondary, mb: 3 }}>
              Mark a company as a partner to start tracking referrals and commissions.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => router.push('/ops/companies/new')}
              sx={{ borderColor: theme.palette.text.primary, color: theme.palette.text.primary }}
            >
              Add Partner Company
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Partner Company</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Commission Rate</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Companies</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Opps</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Projects</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Revenue</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Commission Due</TableCell>
                  <TableCell sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}>Commission Paid</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partners.map((partner) => (
                  <TableRow
                    key={partner.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/ops/companies/${partner.id}`)}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography sx={{ color: theme.palette.text.primary, fontWeight: 500 }}>
                          {partner.name}
                        </Typography>
                        <Chip
                          label={partner.status}
                          size="small"
                          sx={{ backgroundColor: theme.palette.action.hover }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary }}>
                      {partner.partner_commission_rate ? `${partner.partner_commission_rate}%` : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                        label={partner.referred_companies_count || 0}
                        size="small"
                        sx={{ backgroundColor: theme.palette.action.hover }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary }}>
                      {partner.referred_opportunities_count || 0}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<FolderIcon sx={{ fontSize: 16 }} />}
                        label={partner.referred_projects_count || 0}
                        size="small"
                        sx={{ backgroundColor: theme.palette.action.hover }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
                        {formatCurrency(partner.total_referred_revenue || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<AttachMoneyIcon sx={{ fontSize: 16 }} />}
                        label={formatCurrency(partner.total_commission_due || 0)}
                        size="small"
                        sx={{ backgroundColor: '#FF9800', color: '#fff' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<AttachMoneyIcon sx={{ fontSize: 16 }} />}
                        label={formatCurrency(partner.total_commission_paid || 0)}
                        size="small"
                        sx={{ backgroundColor: '#4CAF50', color: '#fff' }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
}

