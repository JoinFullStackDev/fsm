'use client';

import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import InvoiceTable from '@/components/ops/InvoiceTable';
import type { InvoiceWithRelations } from '@/types/ops';

interface CompanyInvoicesTabProps {
  companyId: string;
}

export default function CompanyInvoicesTab({ companyId }: CompanyInvoicesTabProps) {
  const theme = useTheme();
  const { showError } = useNotification();
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('company_id', companyId);
      params.append('limit', '100');
      params.append('offset', '0');
      params.append('order_by', 'created_at');
      params.append('order_direction', 'desc');

      const response = await fetch(`/api/ops/invoices?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load invoices');
      }

      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoices';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId, showError]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
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

  if (invoices.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
          No invoices found for this company
        </Typography>
      </Box>
    );
  }

  return <InvoiceTable invoices={invoices} onRefresh={loadInvoices} />;
}

