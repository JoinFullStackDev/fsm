'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  IconButton,
  Chip,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import InvoicePreview from '@/components/ops/InvoicePreview';
import type { InvoiceWithRelations } from '@/types/ops';

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const invoiceId = params.id as string;
  const [invoice, setInvoice] = useState<InvoiceWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

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

  const handleEdit = () => {
    if (invoice?.status !== 'draft') {
      showError('Only draft invoices can be edited');
      return;
    }
    router.push(`/ops/invoices/${invoiceId}/edit`);
  };

  const handleSend = async () => {
    if (!invoice?.client_email) {
      showError('Client email is required to send invoice');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/ops/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_email: invoice.client_email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send invoice');
      }

      showSuccess(`Invoice ${invoice.invoice_number} sent successfully`);
      loadInvoice();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to send invoice');
    } finally {
      setSending(false);
    }
  };

  const handleExportPDF = () => {
    window.open(`/api/ops/invoices/${invoiceId}/export/pdf`, '_blank');
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete invoice "${invoice?.invoice_number}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/ops/invoices/${invoiceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete invoice');
      }

      showSuccess('Invoice deleted successfully');
      router.push('/ops/invoices');
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete invoice');
    }
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

  if (error || !invoice) {
    return (
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error || 'Invoice not found'}
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            onClick={() => router.push('/ops/invoices')}
            sx={{
              color: theme.palette.text.primary,
              border: '1px solid',
              borderColor: theme.palette.divider,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              Invoice {invoice.invoice_number}
            </Typography>
            <Chip
              label={invoice.status}
              color={
                invoice.status === 'paid'
                  ? 'success'
                  : invoice.status === 'overdue'
                  ? 'error'
                  : invoice.status === 'sent'
                  ? 'info'
                  : 'default'
              }
              size="small"
              sx={{ mt: 1 }}
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {invoice.status === 'draft' && (
            <>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleEdit}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.secondary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Edit
              </Button>
              {invoice.client_email && (
                <Button
                  variant="contained"
                  startIcon={<SendIcon />}
                  onClick={handleSend}
                  disabled={sending}
                  sx={{
                    backgroundColor: theme.palette.text.primary,
                    color: theme.palette.background.default,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                      color: theme.palette.text.primary,
                    },
                  }}
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              )}
            </>
          )}
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleExportPDF}
            sx={{
              borderColor: theme.palette.text.primary,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.text.secondary,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Download PDF
          </Button>
          <Button
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            sx={{
              borderColor: theme.palette.error.main,
              color: theme.palette.error.main,
              '&:hover': {
                borderColor: theme.palette.error.dark,
                backgroundColor: theme.palette.action.hover,
              },
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>

      {/* Invoice Preview */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <InvoicePreview invoice={invoice} />
      </Paper>

      {/* Payment History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Payment History
          </Typography>
          {invoice.payments.map((payment) => (
            <Box key={payment.id} sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    ${payment.amount.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                    {new Date(payment.payment_date).toLocaleDateString()}
                    {payment.payment_method && ` • ${payment.payment_method}`}
                  </Typography>
                  {payment.notes && (
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                      {payment.notes}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Related Links */}
      {(invoice.project || invoice.company || invoice.opportunity) && (
        <Paper
          sx={{
            p: 3,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Related
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {invoice.project && (
              <Button
                variant="text"
                onClick={() => router.push(`/project/${invoice.project?.id}`)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Project: {invoice.project.name}
              </Button>
            )}
            {invoice.company && (
              <Button
                variant="text"
                onClick={() => router.push(`/ops/companies/${invoice.company?.id}`)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Company: {invoice.company.name}
              </Button>
            )}
            {invoice.opportunity && (
              <Button
                variant="text"
                onClick={() => router.push(`/ops/opportunities/${invoice.opportunity?.id}`)}
                sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
              >
                Opportunity: {invoice.opportunity.name}
              </Button>
            )}
          </Box>
        </Paper>
      )}
    </Container>
  );
}

