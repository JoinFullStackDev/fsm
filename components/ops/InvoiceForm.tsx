'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type { InvoiceLineItem } from '@/types/ops';

interface InvoiceFormData {
  client_name: string;
  client_email: string | null;
  client_address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  } | null;
  line_items: InvoiceLineItem[];
  issue_date: string;
  due_date: string | null;
  tax_rate: number;
  notes: string | null;
  terms: string | null;
  is_recurring: boolean;
  recurring_frequency: 'monthly' | 'quarterly' | 'yearly' | null;
}

interface InvoiceFormProps {
  initialData?: {
    client_name?: string;
    client_email?: string;
    client_address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    line_items?: InvoiceLineItem[];
    issue_date?: string;
    due_date?: string;
    tax_rate?: number;
    notes?: string;
    terms?: string;
    is_recurring?: boolean;
    recurring_frequency?: 'monthly' | 'quarterly' | 'yearly' | null;
  };
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export default function InvoiceForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: InvoiceFormProps) {
  const theme = useTheme();
  const [clientName, setClientName] = useState(initialData?.client_name || '');
  const [clientEmail, setClientEmail] = useState(initialData?.client_email || '');
  const [clientAddress, setClientAddress] = useState(initialData?.client_address || {});
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>(
    initialData?.line_items || [
      { description: '', quantity: 1, unit_price: 0, amount: 0 },
    ]
  );
  const [issueDate, setIssueDate] = useState(
    initialData?.issue_date || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(initialData?.due_date || '');
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate || 0);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [terms, setTerms] = useState(initialData?.terms || '');
  const [isRecurring, setIsRecurring] = useState(initialData?.is_recurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState<
    'monthly' | 'quarterly' | 'yearly' | null
  >(initialData?.recurring_frequency || null);

  const calculateTotals = () => {
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      updated[index].amount = updated[index].quantity * updated[index].unit_price;
    }
    
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      return;
    }

    const { subtotal, taxAmount, total } = calculateTotals();

    await onSubmit({
      client_name: clientName,
      client_email: clientEmail || null,
      client_address: Object.keys(clientAddress).length > 0 ? clientAddress : null,
      line_items: lineItems.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      })),
      issue_date: issueDate,
      due_date: dueDate || null,
      tax_rate: taxRate,
      notes: notes || null,
      terms: terms || null,
      is_recurring: isRecurring,
      recurring_frequency: recurringFrequency,
    });
  };

  const { subtotal, taxAmount, total } = calculateTotals();

  return (
    <Box>
      {/* Client Information */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Client Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Client Name *"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="Client Email"
            type="email"
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Street Address"
            value={clientAddress.street || ''}
            onChange={(e) => setClientAddress({ ...clientAddress, street: e.target.value })}
            fullWidth
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="City"
              value={clientAddress.city || ''}
              onChange={(e) => setClientAddress({ ...clientAddress, city: e.target.value })}
              fullWidth
            />
            <TextField
              label="State"
              value={clientAddress.state || ''}
              onChange={(e) => setClientAddress({ ...clientAddress, state: e.target.value })}
              fullWidth
            />
            <TextField
              label="ZIP"
              value={clientAddress.zip || ''}
              onChange={(e) => setClientAddress({ ...clientAddress, zip: e.target.value })}
              fullWidth
            />
          </Box>
          <TextField
            label="Country"
            value={clientAddress.country || ''}
            onChange={(e) => setClientAddress({ ...clientAddress, country: e.target.value })}
            fullWidth
          />
        </Box>
      </Paper>

      {/* Invoice Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Invoice Details
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Issue Date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Tax Rate (%)"
            type="number"
            value={taxRate}
            onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
            inputProps={{ min: 0, max: 100, step: 0.01 }}
            fullWidth
          />
        </Box>

        {/* Line Items */}
        <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
          Line Items
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Description</TableCell>
              <TableCell align="right" sx={{ width: 100 }}>Quantity</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Unit Price</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Amount</TableCell>
              <TableCell sx={{ width: 50 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lineItems.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <TextField
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    fullWidth
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                    size="small"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    size="small"
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </TableCell>
                <TableCell align="right">
                  ${item.amount.toFixed(2)}
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => removeLineItem(index)}
                    disabled={lineItems.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button
          startIcon={<AddIcon />}
          onClick={addLineItem}
          sx={{ mt: 2 }}
        >
          Add Line Item
        </Button>

        {/* Totals */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          <Box sx={{ minWidth: 200 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Subtotal:</Typography>
              <Typography>${subtotal.toFixed(2)}</Typography>
            </Box>
            {taxRate > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography>Tax ({taxRate}%):</Typography>
                <Typography>${taxAmount.toFixed(2)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Total:</Typography>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>${total.toFixed(2)}</Typography>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Notes and Terms */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Additional Information
        </Typography>
        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={3}
          fullWidth
          sx={{ mb: 2 }}
        />
        <TextField
          label="Terms"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          multiline
          rows={3}
          fullWidth
        />
      </Paper>

      {/* Recurring Options */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Recurring Invoice
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
              />
            }
            label="This is a recurring invoice"
          />
          {isRecurring && (
            <FormControl fullWidth>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={recurringFrequency || ''}
                onChange={(e) => setRecurringFrequency(e.target.value as 'monthly' | 'quarterly' | 'yearly')}
                label="Frequency"
              >
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="quarterly">Quarterly</MenuItem>
                <MenuItem value="yearly">Yearly</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      </Paper>

      {/* Actions */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || !clientName.trim()}
        >
          {loading ? 'Saving...' : 'Save Invoice'}
        </Button>
      </Box>
    </Box>
  );
}

