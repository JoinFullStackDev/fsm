'use client';

import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Download as DownloadIcon, Send as SendIcon } from '@mui/icons-material';
import type { InvoiceWithRelations } from '@/types/ops';

interface InvoicePreviewProps {
  invoice: InvoiceWithRelations;
  showActions?: boolean;
  onDownloadPDF?: () => void;
  onSendEmail?: () => void;
}

export default function InvoicePreview({
  invoice,
  showActions = false,
  onDownloadPDF,
  onSendEmail,
}: InvoicePreviewProps) {
  const theme = useTheme();

  return (
    <Box sx={{ '@media print': { display: 'block' } }}>
      {/* Header */}
      <Box sx={{ mb: 4, '@media print': { mb: 3 } }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
          INVOICE
        </Typography>
        <Typography variant="h6" sx={{ color: theme.palette.text.secondary }}>
          #{invoice.invoice_number}
        </Typography>
      </Box>

      {/* Bill To and Invoice Info */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, flexWrap: 'wrap', gap: 3 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
            Bill To:
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
            {invoice.client_name}
          </Typography>
          {invoice.client_email && (
            <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
              {invoice.client_email}
            </Typography>
          )}
          {invoice.client_address && (
            <Box sx={{ mt: 1 }}>
              {invoice.client_address.street && (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {invoice.client_address.street}
                </Typography>
              )}
              {(invoice.client_address.city ||
                invoice.client_address.state ||
                invoice.client_address.zip) && (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {[
                    invoice.client_address.city,
                    invoice.client_address.state,
                    invoice.client_address.zip,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Typography>
              )}
              {invoice.client_address.country && (
                <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                  {invoice.client_address.country}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
            Issue Date:
          </Typography>
          <Typography variant="body1" sx={{ color: theme.palette.text.primary, mb: 2 }}>
            {new Date(invoice.issue_date).toLocaleDateString()}
          </Typography>
          {invoice.due_date && (
            <>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 0.5 }}>
                Due Date:
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                {new Date(invoice.due_date).toLocaleDateString()}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      {/* Line Items Table */}
      <Table sx={{ mb: 4 }}>
        <TableHead>
          <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
            <TableCell sx={{ fontWeight: 600, color: theme.palette.text.primary }}>Description</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Quantity
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Unit Price
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Amount
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoice.line_items?.map((item, index) => (
            <TableRow key={item.id || index}>
              <TableCell sx={{ color: theme.palette.text.primary }}>{item.description}</TableCell>
              <TableCell align="center" sx={{ color: theme.palette.text.primary }}>
                {item.quantity}
              </TableCell>
              <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                ${item.unit_price.toFixed(2)}
              </TableCell>
              <TableCell align="right" sx={{ color: theme.palette.text.primary }}>
                ${item.amount.toFixed(2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Totals */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
        <Box sx={{ minWidth: 200 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
              Subtotal:
            </Typography>
            <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
              ${invoice.subtotal.toFixed(2)}
            </Typography>
          </Box>
          {invoice.tax_rate > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary }}>
                Tax ({invoice.tax_rate}%):
              </Typography>
              <Typography variant="body1" sx={{ color: theme.palette.text.primary }}>
                ${invoice.tax_amount.toFixed(2)}
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              pt: 2,
              borderTop: `2px solid ${theme.palette.divider}`,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              Total:
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
              ${invoice.total_amount.toFixed(2)} {invoice.currency}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Notes and Terms */}
      {invoice.notes && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
            Notes:
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
            {invoice.notes}
          </Typography>
        </Box>
      )}

      {invoice.terms && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
            Terms:
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap' }}>
            {invoice.terms}
          </Typography>
        </Box>
      )}

      {/* Actions */}
      {showActions && (
        <Box sx={{ display: 'flex', gap: 2, mt: 4, '@media print': { display: 'none' } }}>
          {onDownloadPDF && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={onDownloadPDF}
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
          )}
          {onSendEmail && invoice.client_email && (
            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={onSendEmail}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              Send Email
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

