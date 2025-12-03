'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Container, Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import InvoiceForm from '@/components/ops/InvoiceForm';
import type { InvoiceWithRelations } from '@/types/ops';

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/ops/invoices/${invoiceId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load invoice');
      }

      const data = await response.json();
      
      if (data.status !== 'draft') {
        setError('Only draft invoices can be edited');
        return;
      }

      setInvoice(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load invoice';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [invoiceId, showError]);

  useEffect(() => {
    loadInvoice();
  }, [loadInvoice]);

  const handleSubmit = async (data: any) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/ops/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update invoice');
      }

      const updatedInvoice = await response.json();
      showSuccess(`Invoice ${updatedInvoice.invoice_number} updated successfully`);
      router.push(`/ops/invoices/${invoiceId}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to update invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push(`/ops/invoices/${invoiceId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !invoice) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Invoice not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography
        variant="h4"
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 3,
        }}
      >
        Edit Invoice {invoice.invoice_number}
      </Typography>

      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <InvoiceForm
          initialData={{
            client_name: invoice.client_name,
            client_email: invoice.client_email || undefined,
            client_address: invoice.client_address || undefined,
            line_items: invoice.line_items || [],
            issue_date: invoice.issue_date,
            due_date: invoice.due_date || undefined,
            tax_rate: invoice.tax_rate,
            notes: invoice.notes || undefined,
            terms: invoice.terms || undefined,
            is_recurring: invoice.is_recurring,
            recurring_frequency: invoice.recurring_frequency,
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={saving}
        />
      </Paper>
    </Container>
  );
}

