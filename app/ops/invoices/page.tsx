'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import InvoiceTable from '@/components/ops/InvoiceTable';
import type { InvoiceWithRelations } from '@/types/ops';

export default function InvoicesPage() {
  const router = useRouter();
  const theme = useTheme();
  const { showError } = useNotification();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [total, setTotal] = useState(0);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') {
        params.append('status', filterStatus);
      }
      params.append('limit', '50');
      params.append('offset', '0');
      params.append('order_by', 'created_at');
      params.append('order_direction', 'desc');

      const response = await fetch(`/api/ops/invoices?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        let filteredInvoices = data.invoices || [];
        
        // Client-side search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredInvoices = filteredInvoices.filter((inv: InvoiceWithRelations) =>
            inv.invoice_number.toLowerCase().includes(query) ||
            inv.client_name.toLowerCase().includes(query) ||
            inv.client_email?.toLowerCase().includes(query)
          );
        }
        
        setInvoices(filteredInvoices);
        setTotal(data.total || 0);
      } else {
        showError('Failed to load invoices');
      }
    } catch (error) {
      showError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleSearch = () => {
    loadInvoices();
  };

  const handleCreateInvoice = () => {
    router.push('/ops/invoices/new');
  };

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Invoices
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateInvoice}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
            },
          }}
        >
          Create Invoice
        </Button>
      </Box>

      {/* Filters */}
      <Paper
        sx={{
          p: 2,
          mb: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Filter by Status"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <TextField
            placeholder="Search by invoice number, client name, or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: theme.palette.text.secondary }} />
                </InputAdornment>
              ),
            }}
            sx={{ flex: 1, minWidth: 300 }}
          />

          <Button
            variant="outlined"
            onClick={handleSearch}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Search
          </Button>
        </Box>
      </Paper>

      {/* Invoice Table */}
      {invoices.length === 0 ? (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            No invoices found
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 3 }}>
            {searchQuery || filterStatus !== 'all'
              ? 'Try adjusting your filters or search query'
              : 'Get started by creating your first invoice'}
          </Typography>
          {!searchQuery && filterStatus === 'all' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateInvoice}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              Create Invoice
            </Button>
          )}
        </Paper>
      ) : (
        <InvoiceTable invoices={invoices} onRefresh={loadInvoices} />
      )}
    </Container>
  );
}

