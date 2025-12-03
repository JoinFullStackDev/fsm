'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { InvoiceWithRelations } from '@/types/ops';

interface InvoiceTableProps {
  invoices: InvoiceWithRelations[];
  onRefresh: () => void;
}

export default function InvoiceTable({ invoices, onRefresh }: InvoiceTableProps) {
  const router = useRouter();
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [menuAnchor, setMenuAnchor] = useState<{ element: HTMLElement; invoice: InvoiceWithRelations } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceWithRelations | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'sent':
        return 'info';
      case 'paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, invoice: InvoiceWithRelations) => {
    event.stopPropagation();
    setMenuAnchor({ element: event.currentTarget, invoice });
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const handlePreview = (invoice: InvoiceWithRelations) => {
    router.push(`/ops/invoices/${invoice.id}`);
    handleMenuClose();
  };

  const handleEdit = (invoice: InvoiceWithRelations) => {
    if (invoice.status !== 'draft') {
      showError('Only draft invoices can be edited');
      handleMenuClose();
      return;
    }
    router.push(`/ops/invoices/${invoice.id}/edit`);
    handleMenuClose();
  };

  const handleSend = async (invoice: InvoiceWithRelations) => {
    if (!invoice.client_email) {
      showError('Client email is required to send invoice');
      handleMenuClose();
      return;
    }

    setSending(invoice.id);
    handleMenuClose();

    try {
      const response = await fetch(`/api/ops/invoices/${invoice.id}/send`, {
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
      onRefresh();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to send invoice');
    } finally {
      setSending(null);
    }
  };

  const handleExportPDF = (invoice: InvoiceWithRelations) => {
    window.open(`/api/ops/invoices/${invoice.id}/export/pdf`, '_blank');
    handleMenuClose();
  };

  const handleDeleteClick = (invoice: InvoiceWithRelations) => {
    setInvoiceToDelete(invoice);
    setDeleteDialogOpen(true);
    handleMenuClose();
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    try {
      const response = await fetch(`/api/ops/invoices/${invoiceToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete invoice');
      }

      showSuccess('Invoice deleted successfully');
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      onRefresh();
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete invoice');
    }
  };

  return (
    <>
      <TableContainer
        component={Paper}
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Invoice #</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Client</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Project</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Issue Date</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Due Date</TableCell>
              <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow
                key={invoice.id}
                hover
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => handlePreview(invoice)}
              >
                <TableCell>{invoice.invoice_number}</TableCell>
                <TableCell>{invoice.client_name}</TableCell>
                <TableCell>{invoice.project?.name || '-'}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>
                  ${invoice.total_amount.toFixed(2)} {invoice.currency}
                </TableCell>
                <TableCell>
                  <Chip
                    label={invoice.status}
                    color={getStatusColor(invoice.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                <TableCell>
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, invoice)}
                    disabled={sending === invoice.id}
                  >
                    {sending === invoice.id ? (
                      <MoreVertIcon sx={{ opacity: 0.5 }} />
                    ) : (
                      <MoreVertIcon />
                    )}
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor?.element}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <MenuItem
          onClick={() => menuAnchor && handlePreview(menuAnchor.invoice)}
          sx={{ color: theme.palette.text.primary }}
        >
          <VisibilityIcon sx={{ mr: 1, fontSize: 20 }} />
          Preview
        </MenuItem>
        {menuAnchor?.invoice.status === 'draft' && (
          <MenuItem
            onClick={() => menuAnchor && handleEdit(menuAnchor.invoice)}
            sx={{ color: theme.palette.text.primary }}
          >
            <EditIcon sx={{ mr: 1, fontSize: 20 }} />
            Edit
          </MenuItem>
        )}
        {menuAnchor?.invoice.status === 'draft' && menuAnchor?.invoice.client_email && (
          <MenuItem
            onClick={() => menuAnchor && handleSend(menuAnchor.invoice)}
            sx={{ color: theme.palette.text.primary }}
            disabled={sending === menuAnchor.invoice.id}
          >
            <SendIcon sx={{ mr: 1, fontSize: 20 }} />
            Send
          </MenuItem>
        )}
        <MenuItem
          onClick={() => menuAnchor && handleExportPDF(menuAnchor.invoice)}
          sx={{ color: theme.palette.text.primary }}
        >
          <DownloadIcon sx={{ mr: 1, fontSize: 20 }} />
          Download PDF
        </MenuItem>
        <MenuItem
          onClick={() => menuAnchor && handleDeleteClick(menuAnchor.invoice)}
          sx={{ color: theme.palette.error.main }}
        >
          <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        <DialogTitle sx={{ color: theme.palette.error.main }}>
          Delete Invoice
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: theme.palette.text.secondary }}>
            Are you sure you want to delete invoice &quot;{invoiceToDelete?.invoice_number}&quot;? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            sx={{ color: theme.palette.text.secondary }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.error.main,
              '&:hover': {
                backgroundColor: theme.palette.error.dark,
              },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

