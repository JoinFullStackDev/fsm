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
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Sync as SyncIcon,
} from '@mui/icons-material';
import { useNotification } from '@/lib/hooks/useNotification';
import { AVAILABLE_MODULES, getModulesByCategory } from '@/lib/modules';
import * as Icons from '@mui/icons-material';
import type { PackageFeatures } from '@/lib/organizationContext';

interface Package {
  id: string;
  name: string;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  price_per_user_monthly: number;
  features: PackageFeatures;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const defaultFeatures: PackageFeatures = {
  max_projects: null,
  max_users: null,
  max_templates: null,
  ai_features_enabled: false,
  export_features_enabled: false,
  ops_tool_enabled: false,
  analytics_enabled: false,
  api_access_enabled: false,
  support_level: 'community',
};

export default function PackagesPage() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<Package[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [stripeProducts, setStripeProducts] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    stripe_price_id: '',
    stripe_product_id: '',
    price_per_user_monthly: 0,
    features: { ...defaultFeatures },
    is_active: true,
    display_order: 0,
  });

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/global/admin/packages');
      if (!response.ok) {
        throw new Error('Failed to load packages');
      }
      const data = await response.json();
      // Normalize features to ensure all packages have complete feature objects
      const normalizedPackages = (data.packages || []).map((pkg: Package) => ({
        ...pkg,
        features: {
          ...defaultFeatures,
          ...(pkg.features || {}),
        },
      }));
      setPackages(normalizedPackages);
    } catch (err) {
      showError('Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadPackages();
  }, [loadPackages]);

  const handleOpenDialog = (pkg?: Package) => {
    if (pkg) {
      setEditingPackage(pkg);
      setFormData({
        name: pkg.name,
        stripe_price_id: pkg.stripe_price_id || '',
        stripe_product_id: pkg.stripe_product_id || '',
        price_per_user_monthly: pkg.price_per_user_monthly,
        features: { ...defaultFeatures, ...pkg.features },
        is_active: pkg.is_active,
        display_order: pkg.display_order,
      });
    } else {
      setEditingPackage(null);
      setFormData({
        name: '',
        stripe_price_id: '',
        stripe_product_id: '',
        price_per_user_monthly: 0,
        features: { ...defaultFeatures },
        is_active: true,
        display_order: packages.length,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPackage(null);
  };

  const handleOpenSyncDialog = async () => {
    setSyncDialogOpen(true);
    setSyncing(true);
    try {
      const response = await fetch('/api/stripe/sync-products');
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe products');
      }
      const data = await response.json();
      setStripeProducts(data.products || []);
    } catch (err) {
      showError('Failed to load Stripe products');
    } finally {
      setSyncing(false);
    }
  };

  const handleLinkProduct = async (
    packageId: string,
    productId: string,
    priceId: string | null,
    priceAmount: number | null
  ) => {
    try {
      const response = await fetch('/api/stripe/sync-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: packageId,
          stripe_product_id: productId,
          stripe_price_id: priceId,
          price_per_user_monthly: priceAmount, // Sync the pricing from Stripe
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link product');
      }

      showSuccess('Product ID, Price ID, and pricing synced successfully');
      loadPackages();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to sync product');
    }
  };

  const handleSave = async () => {
    try {
      const url = editingPackage
        ? `/api/global/admin/packages/${editingPackage.id}`
        : '/api/global/admin/packages';
      const method = editingPackage ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          stripe_price_id: formData.stripe_price_id || null,
          stripe_product_id: formData.stripe_product_id || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save package');
      }

      showSuccess(editingPackage ? 'Package updated successfully' : 'Package created successfully');
      handleCloseDialog();
      loadPackages();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save package');
    }
  };

  const handleDelete = async (pkg: Package) => {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/global/admin/packages/${pkg.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete package');
      }

      showSuccess('Package deleted successfully');
      loadPackages();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete package');
    }
  };

  const updateFeature = (key: keyof PackageFeatures, value: any) => {
    setFormData({
      ...formData,
      features: {
        ...formData.features,
        [key]: value,
      },
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontSize: '1.75rem',
            fontWeight: 600,
            color: theme.palette.text.primary,
          }}
        >
          Package Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<SyncIcon />}
            onClick={handleOpenSyncDialog}
          >
            Sync with Stripe
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            Create Package
          </Button>
        </Box>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Price (per user/month)</TableCell>
              <TableCell>Stripe Price ID</TableCell>
              <TableCell>Features</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Order</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No packages found. Create your first package to get started.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              packages.map((pkg) => (
                <TableRow key={pkg.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {pkg.name}
                    </Typography>
                  </TableCell>
                  <TableCell>${pkg.price_per_user_monthly.toFixed(2)}</TableCell>
                  <TableCell>
                    {pkg.stripe_price_id ? (
                      <Chip label={pkg.stripe_price_id} size="small" variant="outlined" />
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Not set
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {/* Module Features */}
                      {pkg.features?.ai_features_enabled && (
                        <Chip label="AI" size="small" color="primary" />
                      )}
                      {pkg.features?.ops_tool_enabled && (
                        <Chip label="Ops" size="small" color="primary" />
                      )}
                      {pkg.features?.analytics_enabled && (
                        <Chip label="Analytics" size="small" color="primary" />
                      )}
                      {pkg.features?.api_access_enabled && (
                        <Chip label="API" size="small" color="primary" />
                      )}
                      {pkg.features?.export_features_enabled && (
                        <Chip label="Export" size="small" color="primary" />
                      )}
                      {/* Limits */}
                      {pkg.features?.max_projects !== null && pkg.features?.max_projects !== undefined && (
                        <Chip 
                          label={`${pkg.features.max_projects} Projects`} 
                          size="small" 
                          variant="outlined" 
                          color="secondary" 
                        />
                      )}
                      {pkg.features?.max_users !== null && pkg.features?.max_users !== undefined && (
                        <Chip 
                          label={`${pkg.features.max_users} Users`} 
                          size="small" 
                          variant="outlined" 
                          color="secondary" 
                        />
                      )}
                      {pkg.features?.max_templates !== null && pkg.features?.max_templates !== undefined && (
                        <Chip 
                          label={`${pkg.features.max_templates} Templates`} 
                          size="small" 
                          variant="outlined" 
                          color="secondary" 
                        />
                      )}
                      {/* Support Level */}
                      {pkg.features?.support_level && (
                        <Chip 
                          label={`${pkg.features.support_level.charAt(0).toUpperCase() + pkg.features.support_level.slice(1)} Support`} 
                          size="small" 
                          variant="outlined" 
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pkg.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={pkg.is_active ? 'success' : 'default'}
                      icon={pkg.is_active ? <CheckCircleIcon /> : <CancelIcon />}
                    />
                  </TableCell>
                  <TableCell>{pkg.display_order}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenDialog(pkg)}
                      aria-label="Edit package"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(pkg)}
                      aria-label="Delete package"
                      color="error"
                    >
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
        <DialogTitle>{editingPackage ? 'Edit Package' : 'Create Package'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Package Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Price per User (Monthly)"
                type="number"
                value={formData.price_per_user_monthly}
                onChange={(e) =>
                  setFormData({ ...formData, price_per_user_monthly: Number(e.target.value) })
                }
                required
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Stripe Price ID"
                value={formData.stripe_price_id}
                onChange={(e) => setFormData({ ...formData, stripe_price_id: e.target.value })}
                placeholder="price_..."
                helperText="Optional: Direct price ID. If not set, will use Product ID."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Stripe Product ID"
                value={formData.stripe_product_id}
                onChange={(e) => setFormData({ ...formData, stripe_product_id: e.target.value })}
                placeholder="prod_..."
                helperText="Optional: Product ID. Prices will be fetched/created from this product."
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Display Order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: Number(e.target.value) })
                }
                inputProps={{ min: 0 }}
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

            {/* Limits */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                Limits (leave null for unlimited)
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Projects"
                type="number"
                value={formData.features.max_projects || ''}
                onChange={(e) =>
                  updateFeature('max_projects', e.target.value ? Number(e.target.value) : null)
                }
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Users"
                type="number"
                value={formData.features.max_users || ''}
                onChange={(e) =>
                  updateFeature('max_users', e.target.value ? Number(e.target.value) : null)
                }
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Max Templates"
                type="number"
                value={formData.features.max_templates || ''}
                onChange={(e) =>
                  updateFeature('max_templates', e.target.value ? Number(e.target.value) : null)
                }
                inputProps={{ min: 0 }}
              />
            </Grid>

            {/* Modules/Plugins */}
            <Grid item xs={12}>
              <Typography variant="h6" sx={{ mt: 2, mb: 2 }}>
                Modules & Plugins
              </Typography>
            </Grid>
            {Object.entries(getModulesByCategory()).map(([category, modules]) => (
              <Grid item xs={12} key={category}>
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{
                      mb: 1,
                      fontWeight: 600,
                      color: theme.palette.text.secondary,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                      fontSize: '0.75rem',
                    }}
                  >
                    {category}
                  </Typography>
                  <Grid container spacing={2}>
                    {modules.map((module) => {
                      const IconComponent = (Icons as any)[module.icon || 'Business'] || Icons.Business;
                      const featureKey = module.key as keyof PackageFeatures;
                      const isEnabled = formData.features[featureKey] === true;

                      return (
                        <Grid item xs={12} md={6} key={module.key}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 2,
                              p: 2,
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: 1,
                              backgroundColor: theme.palette.background.default,
                            }}
                          >
                            <IconComponent
                              sx={{
                                fontSize: 28,
                                color: isEnabled ? theme.palette.text.primary : theme.palette.text.secondary,
                              }}
                            />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {module.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {module.description}
                              </Typography>
                            </Box>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={isEnabled}
                                  onChange={(e) => updateFeature(featureKey, e.target.checked)}
                                />
                              }
                              label=""
                              sx={{ m: 0 }}
                            />
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              </Grid>
            ))}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Support Level</InputLabel>
                <Select
                  value={formData.features.support_level}
                  onChange={(e) => updateFeature('support_level', e.target.value)}
                  label="Support Level"
                >
                  <MenuItem value="community">Community</MenuItem>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                  <MenuItem value="dedicated">Dedicated</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>
            {editingPackage ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync with Stripe Dialog */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Sync Packages with Stripe Products</DialogTitle>
        <DialogContent>
          {syncing ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : stripeProducts.length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              No active products found in Stripe. Create products in your Stripe dashboard first.
            </Alert>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                This will sync only: <strong>Product ID</strong>, <strong>Price ID</strong>, and <strong>Pricing</strong> from Stripe.
                Package names, features, and other settings will not be changed.
              </Alert>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Package</TableCell>
                      <TableCell>Current Product ID</TableCell>
                      <TableCell>Stripe Product</TableCell>
                      <TableCell>Monthly Price</TableCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {packages.map((pkg) => {
                      const matchingProduct = stripeProducts.find(
                        (p) => p.name.toLowerCase() === pkg.name.toLowerCase()
                      );
                      return (
                        <TableRow key={pkg.id}>
                          <TableCell>{pkg.name}</TableCell>
                          <TableCell>
                            {pkg.stripe_product_id ? (
                              <Chip label={pkg.stripe_product_id} size="small" />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Not linked
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              size="small"
                              value={matchingProduct?.id || ''}
                              onChange={(e) => {
                                const product = stripeProducts.find((p) => p.id === e.target.value);
                                if (product) {
                                  handleLinkProduct(
                                    pkg.id,
                                    product.id,
                                    product.monthly_price_id,
                                    product.monthly_price_amount
                                  );
                                }
                              }}
                              sx={{ minWidth: 200 }}
                            >
                              <MenuItem value="">None</MenuItem>
                              {stripeProducts.map((product) => (
                                <MenuItem key={product.id} value={product.id}>
                                  {product.name} {product.monthly_price_amount ? `($${product.monthly_price_amount}/mo)` : ''}
                                </MenuItem>
                              ))}
                            </Select>
                          </TableCell>
                          <TableCell>
                            {matchingProduct?.monthly_price_amount ? (
                              `$${matchingProduct.monthly_price_amount}/mo`
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                No monthly price
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {matchingProduct && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() =>
                                  handleLinkProduct(
                                    pkg.id,
                                    matchingProduct.id,
                                    matchingProduct.monthly_price_id,
                                    matchingProduct.monthly_price_amount
                                  )
                                }
                                disabled={pkg.stripe_product_id === matchingProduct.id}
                              >
                                {pkg.stripe_product_id === matchingProduct.id ? 'Synced' : 'Sync'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

