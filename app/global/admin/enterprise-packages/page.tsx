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
  Divider,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Business as BusinessIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import type { CustomEnterprisePackageWithDetails, VolumeDiscountRule } from '@/types/enterprise';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface Package {
  id: string;
  name: string;
}

const defaultFormData = {
  organization_id: '',
  package_id: '',
  custom_name: '',
  custom_price_per_user_monthly: null as number | null,
  custom_price_per_user_yearly: null as number | null,
  volume_discount_rules: [] as VolumeDiscountRule[],
  custom_max_users: null as number | null,
  custom_max_projects: null as number | null,
  custom_trial_days: null as number | null,
  contract_start_date: '',
  contract_end_date: '',
  minimum_commitment_users: null as number | null,
  minimum_commitment_months: null as number | null,
  net_payment_terms: 30,
  notes: '',
  is_active: true,
};

export default function EnterprisePackagesPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [enterprisePackages, setEnterprisePackages] = useState<CustomEnterprisePackageWithDetails[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<CustomEnterprisePackageWithDetails | null>(null);
  const [formData, setFormData] = useState(defaultFormData);
  const [saving, setSaving] = useState(false);
  
  // Volume discount rule editor
  const [newRule, setNewRule] = useState({ min_users: 0, discount_percent: 0 });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load enterprise packages, organizations, and base packages in parallel
      const [packagesRes, orgsRes, basePackagesRes] = await Promise.all([
        fetch('/api/global/admin/enterprise-packages'),
        fetch('/api/global/admin/organizations'),
        fetch('/api/global/admin/packages'),
      ]);

      if (!packagesRes.ok) throw new Error('Failed to load enterprise packages');
      if (!orgsRes.ok) throw new Error('Failed to load organizations');
      if (!basePackagesRes.ok) throw new Error('Failed to load packages');

      const [packagesData, orgsData, basePackagesData] = await Promise.all([
        packagesRes.json(),
        orgsRes.json(),
        basePackagesRes.json(),
      ]);

      setEnterprisePackages(packagesData.packages || []);
      setOrganizations(orgsData.organizations || []);
      setPackages(basePackagesData.packages || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenDialog = (pkg?: CustomEnterprisePackageWithDetails) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        organization_id: pkg.organization_id,
        package_id: pkg.package_id || '',
        custom_name: pkg.custom_name || '',
        custom_price_per_user_monthly: pkg.custom_price_per_user_monthly,
        custom_price_per_user_yearly: pkg.custom_price_per_user_yearly,
        volume_discount_rules: pkg.volume_discount_rules || [],
        custom_max_users: pkg.custom_max_users,
        custom_max_projects: pkg.custom_max_projects,
        custom_trial_days: pkg.custom_trial_days,
        contract_start_date: pkg.contract_start_date || '',
        contract_end_date: pkg.contract_end_date || '',
        minimum_commitment_users: pkg.minimum_commitment_users,
        minimum_commitment_months: pkg.minimum_commitment_months,
        net_payment_terms: pkg.net_payment_terms,
        notes: pkg.notes || '',
        is_active: pkg.is_active,
      });
    } else {
      setEditingPackage(null);
      setFormData({ ...defaultFormData });
    }
    setNewRule({ min_users: 0, discount_percent: 0 });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPackage(null);
  };

  const handleAddRule = () => {
    if (newRule.min_users > 0 && newRule.discount_percent > 0) {
      // Check for duplicate threshold
      if (formData.volume_discount_rules.some(r => r.min_users === newRule.min_users)) {
        showError('A rule with this user threshold already exists');
        return;
      }
      setFormData({
        ...formData,
        volume_discount_rules: [...formData.volume_discount_rules, { ...newRule }]
          .sort((a, b) => a.min_users - b.min_users),
      });
      setNewRule({ min_users: 0, discount_percent: 0 });
    }
  };

  const handleRemoveRule = (index: number) => {
    setFormData({
      ...formData,
      volume_discount_rules: formData.volume_discount_rules.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingPackage
        ? `/api/global/admin/enterprise-packages/${editingPackage.id}`
        : '/api/global/admin/enterprise-packages';
      const method = editingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save enterprise package');
      }

      showSuccess(editingPackage ? 'Enterprise package updated' : 'Enterprise package created');
      handleCloseDialog();
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: CustomEnterprisePackageWithDetails) => {
    if (!confirm(`Delete enterprise package for "${pkg.organization?.name}"?`)) return;

    try {
      const response = await fetch(`/api/global/admin/enterprise-packages/${pkg.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete');
      }

      showSuccess('Enterprise package deleted');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  // Get organizations that don't have enterprise packages yet
  const availableOrganizations = organizations.filter(
    org => !enterprisePackages.some(pkg => pkg.organization_id === org.id)
  );

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
          Enterprise Packages
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={availableOrganizations.length === 0}
        >
          Create Enterprise Package
        </Button>
      </Box>

      {availableOrganizations.length === 0 && enterprisePackages.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No organizations available. Organizations need to be created before you can set up enterprise packages.
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Organization</TableCell>
              <TableCell>Base Package</TableCell>
              <TableCell>Custom Pricing</TableCell>
              <TableCell>Volume Discounts</TableCell>
              <TableCell>Contract</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enterprisePackages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No enterprise packages configured.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              enterprisePackages.map((pkg) => (
                <TableRow key={pkg.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon color="action" fontSize="small" />
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {pkg.organization?.name || 'Unknown'}
                        </Typography>
                        {pkg.custom_name && (
                          <Typography variant="caption" color="text.secondary">
                            {pkg.custom_name}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {pkg.package?.name || 'Not set'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {pkg.custom_price_per_user_monthly !== null ? (
                      <Typography variant="body2">
                        ${pkg.custom_price_per_user_monthly}/user/mo
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Default pricing
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.volume_discount_rules && pkg.volume_discount_rules.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {pkg.volume_discount_rules.slice(0, 2).map((rule, i) => (
                          <Chip
                            key={i}
                            label={`${rule.min_users}+ users: ${rule.discount_percent}% off`}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        {pkg.volume_discount_rules.length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{pkg.volume_discount_rules.length - 2} more
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">None</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.contract_end_date ? (
                      <Typography variant="body2">
                        Until {new Date(pkg.contract_end_date).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No end date
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pkg.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={pkg.is_active ? 'success' : 'default'}
                      icon={pkg.is_active ? <CheckCircleIcon /> : <CancelIcon />}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => handleOpenDialog(pkg)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDelete(pkg)} color="error">
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
        <DialogTitle>
          {editingPackage ? 'Edit Enterprise Package' : 'Create Enterprise Package'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {!editingPackage && (
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Organization</InputLabel>
                  <Select
                    value={formData.organization_id}
                    onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                    label="Organization"
                  >
                    {availableOrganizations.map((org) => (
                      <MenuItem key={org.id} value={org.id}>
                        {org.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            <Grid item xs={12} md={editingPackage ? 12 : 6}>
              <FormControl fullWidth required>
                <InputLabel>Base Package</InputLabel>
                <Select
                  value={formData.package_id}
                  onChange={(e) => setFormData({ ...formData, package_id: e.target.value })}
                  label="Base Package"
                >
                  {packages.map((pkg) => (
                    <MenuItem key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Custom Name (for invoicing)"
                value={formData.custom_name}
                onChange={(e) => setFormData({ ...formData, custom_name: e.target.value })}
                helperText="Optional custom name to appear on invoices"
              />
            </Grid>

            {/* Custom Pricing */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                Custom Pricing (optional)
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price per User (Monthly)"
                type="number"
                value={formData.custom_price_per_user_monthly ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  custom_price_per_user_monthly: e.target.value ? Number(e.target.value) : null,
                })}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Leave empty to use package default"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price per User (Yearly)"
                type="number"
                value={formData.custom_price_per_user_yearly ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  custom_price_per_user_yearly: e.target.value ? Number(e.target.value) : null,
                })}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Leave empty to use package default"
              />
            </Grid>

            {/* Volume Discounts */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                Volume Discounts
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 2 }}>
                <TextField
                  label="Min Users"
                  type="number"
                  value={newRule.min_users || ''}
                  onChange={(e) => setNewRule({ ...newRule, min_users: Number(e.target.value) })}
                  inputProps={{ min: 1 }}
                  size="small"
                  sx={{ width: 120 }}
                />
                <TextField
                  label="Discount %"
                  type="number"
                  value={newRule.discount_percent || ''}
                  onChange={(e) => setNewRule({ ...newRule, discount_percent: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 100 }}
                  size="small"
                  sx={{ width: 120 }}
                />
                <Button
                  variant="outlined"
                  onClick={handleAddRule}
                  disabled={!newRule.min_users || !newRule.discount_percent}
                  size="small"
                >
                  Add Rule
                </Button>
              </Box>
              {formData.volume_discount_rules.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {formData.volume_discount_rules.map((rule, index) => (
                    <Chip
                      key={index}
                      label={`${rule.min_users}+ users: ${rule.discount_percent}% off`}
                      onDelete={() => handleRemoveRule(index)}
                    />
                  ))}
                </Box>
              )}
              <Typography variant="caption" color="text.secondary">
                Example: 25+ users get 15% off, 50+ users get 25% off
              </Typography>
            </Grid>

            {/* Contract Terms */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" sx={{ mt: 1, mb: 1 }}>
                Contract Terms
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contract Start Date"
                type="date"
                value={formData.contract_start_date}
                onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Contract End Date"
                type="date"
                value={formData.contract_end_date}
                onChange={(e) => setFormData({ ...formData, contract_end_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Min Commitment Users"
                type="number"
                value={formData.minimum_commitment_users ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  minimum_commitment_users: e.target.value ? Number(e.target.value) : null,
                })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Min Commitment Months"
                type="number"
                value={formData.minimum_commitment_months ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  minimum_commitment_months: e.target.value ? Number(e.target.value) : null,
                })}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Net Payment Terms (days)"
                type="number"
                value={formData.net_payment_terms}
                onChange={(e) => setFormData({
                  ...formData,
                  net_payment_terms: Number(e.target.value) || 30,
                })}
                inputProps={{ min: 0 }}
                helperText="e.g., 30 = Net 30"
              />
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                multiline
                rows={3}
                helperText="Internal notes about this enterprise deal"
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
            disabled={(!editingPackage && !formData.organization_id) || !formData.package_id || saving}
          >
            {saving ? 'Saving...' : editingPackage ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

