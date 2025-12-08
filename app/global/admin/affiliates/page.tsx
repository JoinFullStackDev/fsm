'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Grid,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import type { AffiliateCode, AffiliateCodeWithStats, DiscountType } from '@/types/affiliate';

const defaultFormData = {
  code: '',
  name: '',
  description: '',
  discount_type: 'percentage' as DiscountType,
  discount_value: 0,
  discount_duration_months: null as number | null,
  bonus_trial_days: 0,
  affiliate_email: '',
  commission_percentage: 0,
  max_uses: null as number | null,
  valid_from: '',
  valid_until: '',
  is_active: true,
};

export default function AffiliatesPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<AffiliateCodeWithStats[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAffiliate, setEditingAffiliate] = useState<AffiliateCode | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);

  const loadAffiliates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/global/admin/affiliates');
      if (!response.ok) {
        throw new Error('Failed to load affiliates');
      }
      const data = await response.json();
      setAffiliates(data.affiliates || []);
    } catch (err) {
      showError('Failed to load affiliates');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  const handleOpenDialog = (affiliate?: AffiliateCode) => {
    if (affiliate) {
      setEditingAffiliate(affiliate);
      setFormData({
        code: affiliate.code,
        name: affiliate.name,
        description: affiliate.description || '',
        discount_type: affiliate.discount_type,
        discount_value: affiliate.discount_value,
        discount_duration_months: affiliate.discount_duration_months,
        bonus_trial_days: affiliate.bonus_trial_days,
        affiliate_email: affiliate.affiliate_email || '',
        commission_percentage: affiliate.commission_percentage,
        max_uses: affiliate.max_uses,
        valid_from: affiliate.valid_from ? affiliate.valid_from.split('T')[0] : '',
        valid_until: affiliate.valid_until ? affiliate.valid_until.split('T')[0] : '',
        is_active: affiliate.is_active,
      });
    } else {
      setEditingAffiliate(null);
      setFormData({
        ...defaultFormData,
        valid_from: new Date().toISOString().split('T')[0],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingAffiliate(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingAffiliate
        ? `/api/global/admin/affiliates/${editingAffiliate.id}`
        : '/api/global/admin/affiliates';
      const method = editingAffiliate ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        discount_duration_months: formData.discount_duration_months || null,
        max_uses: formData.max_uses || null,
        valid_from: formData.valid_from || new Date().toISOString(),
        valid_until: formData.valid_until || null,
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save affiliate');
      }

      showSuccess(editingAffiliate ? 'Affiliate updated successfully' : 'Affiliate created successfully');
      handleCloseDialog();
      loadAffiliates();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save affiliate');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (affiliate: AffiliateCode) => {
    if (!confirm(`Are you sure you want to delete "${affiliate.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/global/admin/affiliates/${affiliate.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete affiliate');
      }

      const result = await response.json();
      if (result.deactivated) {
        showSuccess('Affiliate has been deactivated (has existing conversions)');
      } else {
        showSuccess('Affiliate deleted successfully');
      }
      loadAffiliates();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete affiliate');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showSuccess(`Code "${code}" copied to clipboard`);
  };

  const formatDiscountDisplay = (affiliate: AffiliateCode) => {
    if (affiliate.discount_type === 'percentage') {
      return `${affiliate.discount_value}% off`;
    } else if (affiliate.discount_type === 'fixed_amount') {
      return `$${affiliate.discount_value} off`;
    } else {
      return `${affiliate.bonus_trial_days} extra trial days`;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 0 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: { xs: '1.25rem', md: '1.75rem' },
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Affiliate Codes
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Create Affiliate
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Code</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Discount</TableCell>
              <TableCell>Trial Bonus</TableCell>
              <TableCell>Uses</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {affiliates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No affiliate codes found. Create your first affiliate code to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              affiliates.map((affiliate) => (
                <TableRow key={affiliate.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                        {affiliate.code}
                      </Typography>
                      <Tooltip title="Copy code">
                        <IconButton size="small" onClick={() => handleCopyCode(affiliate.code)}>
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{affiliate.name}</Typography>
                    {affiliate.affiliate_email && (
                      <Typography variant="caption" color="text.secondary">
                        {affiliate.affiliate_email}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={formatDiscountDisplay(affiliate)}
                      size="small"
                      color={affiliate.discount_type === 'percentage' ? 'primary' : 'secondary'}
                    />
                    {affiliate.discount_duration_months && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        for {affiliate.discount_duration_months} months
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {affiliate.bonus_trial_days > 0 ? (
                      <Chip label={`+${affiliate.bonus_trial_days} days`} size="small" color="info" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {affiliate.current_uses}
                      {affiliate.max_uses !== null && ` / ${affiliate.max_uses}`}
                    </Typography>
                    {affiliate.conversions_count !== undefined && (
                      <Typography variant="caption" color="text.secondary">
                        {affiliate.conversions_count} conversions
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={affiliate.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={affiliate.is_active ? 'success' : 'default'}
                      icon={affiliate.is_active ? <CheckCircleIcon /> : <CancelIcon />}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(affiliate)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(affiliate)} color="error">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingAffiliate ? 'Edit Affiliate Code' : 'Create Affiliate Code'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                helperText="Unique code (letters, numbers, dashes, underscores)"
                disabled={!!editingAffiliate}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                helperText="Internal name for this affiliate"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>

            {/* Discount Configuration */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Discount Configuration
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <InputLabel>Discount Type</InputLabel>
                <Select
                  value={formData.discount_type}
                  onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as DiscountType })}
                  label="Discount Type"
                >
                  <MenuItem value="percentage">Percentage Off</MenuItem>
                  <MenuItem value="fixed_amount">Fixed Amount Off</MenuItem>
                  <MenuItem value="trial_extension">Trial Extension Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.discount_type !== 'trial_extension' && (
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label={formData.discount_type === 'percentage' ? 'Discount %' : 'Discount Amount ($)'}
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: Number(e.target.value) })}
                  inputProps={{ min: 0, max: formData.discount_type === 'percentage' ? 100 : undefined }}
                />
              </Grid>
            )}
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Discount Duration (months)"
                type="number"
                value={formData.discount_duration_months || ''}
                onChange={(e) => setFormData({ ...formData, discount_duration_months: e.target.value ? Number(e.target.value) : null })}
                inputProps={{ min: 1 }}
                helperText="Leave empty for forever"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Bonus Trial Days"
                type="number"
                value={formData.bonus_trial_days}
                onChange={(e) => setFormData({ ...formData, bonus_trial_days: Number(e.target.value) })}
                inputProps={{ min: 0 }}
                helperText="Extra days added to package trial"
              />
            </Grid>

            {/* Affiliate Owner */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Affiliate Owner
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Affiliate Email"
                type="email"
                value={formData.affiliate_email}
                onChange={(e) => setFormData({ ...formData, affiliate_email: e.target.value })}
                helperText="Email of the affiliate partner"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Commission %"
                type="number"
                value={formData.commission_percentage}
                onChange={(e) => setFormData({ ...formData, commission_percentage: Number(e.target.value) })}
                inputProps={{ min: 0, max: 100 }}
                helperText="Commission percentage for this affiliate"
              />
            </Grid>

            {/* Limits & Validity */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Limits & Validity
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Uses"
                type="number"
                value={formData.max_uses || ''}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value ? Number(e.target.value) : null })}
                inputProps={{ min: 1 }}
                helperText="Leave empty for unlimited"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Valid From"
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Valid Until"
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText="Leave empty for no expiration"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={!formData.code || !formData.name || saving}
          >
            {saving ? 'Saving...' : editingAffiliate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

