'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Box, Typography, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import InvoiceForm from '@/components/ops/InvoiceForm';

export default function NewInvoicePage() {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: any) => {
    try {
      setLoading(true);
      const response = await fetch('/api/ops/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          status: 'draft',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create invoice');
      }

      const invoice = await response.json();
      showSuccess(`Invoice ${invoice.invoice_number} created successfully`);
      router.push(`/ops/invoices/${invoice.id}`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/ops/invoices');
  };

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
        Create Invoice
      </Typography>

      <Paper
        sx={{
          p: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <InvoiceForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
        />
      </Paper>
    </Container>
  );
}

