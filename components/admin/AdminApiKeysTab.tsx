'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Paper,
  Grid,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
  Block as BlockIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import type { ApiKey } from '@/types/apiKeys';

interface CreateApiKeyForm {
  name: string;
  scope: 'global' | 'org';
  organization_id: string | null;
  permissions: 'read' | 'write';
  expires_at: string | null;
  description: string;
  key_prefix: string;
}

export default function AdminApiKeysTab() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [isRotatedKey, setIsRotatedKey] = useState(false);
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }>>([]);
  const [formData, setFormData] = useState<CreateApiKeyForm>({
    name: '',
    scope: 'org',
    organization_id: null,
    permissions: 'read',
    key_prefix: '',
    expires_at: null,
    description: '',
  });

  const loadApiKeys = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/api-keys');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load API keys');
      }

      const data = await response.json();
      setApiKeys(data.data || data.keys || []); // Support both 'data' and 'keys' response formats
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load API keys';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const loadOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/organizations');
      if (!response.ok) {
        throw new Error('Failed to load organizations');
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
    } catch (err) {
      console.error('Error loading organizations:', err);
    }
  }, []);

  useEffect(() => {
    loadApiKeys();
    loadOrganizations();
  }, [loadApiKeys, loadOrganizations]);

  const handleCreateKey = async () => {
    if (!formData.name.trim()) {
      showError('Key name is required');
      return;
    }

    if (formData.scope === 'org' && !formData.organization_id) {
      showError('Organization is required for org-scoped keys');
      return;
    }

    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          scope: formData.scope,
          organization_id: formData.scope === 'org' ? formData.organization_id : null,
          permissions: formData.permissions,
          expires_at: formData.expires_at || null,
          description: formData.description.trim() || null,
          key_prefix: formData.key_prefix.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create API key');
      }

      const data = await response.json();
      setNewKeyValue(data.api_key); // API returns 'api_key', not 'key_value'
      setIsRotatedKey(false); // This is a new key, not a rotated one
      showSuccess('API key created successfully');
      loadApiKeys();
      setFormData({
        name: '',
        scope: 'org',
        organization_id: null,
        permissions: 'read',
        expires_at: null,
        description: '',
        key_prefix: '',
      });
      // Don't close dialog - keep it open to show the new key value
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create API key';
      showError(errorMessage);
    }
  };

  const handleViewKey = (key: ApiKey) => {
    setSelectedKey(key);
    setViewDialogOpen(true);
  };

  const handleRotateKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to rotate this API key? The old key will be invalidated immediately.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}/rotate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to rotate API key');
      }

      const data = await response.json();
      setNewKeyValue(data.api_key || data.key_value); // Support both field names
      setIsRotatedKey(true); // This is a rotated key
      setCreateDialogOpen(true); // Open dialog to show the new rotated key
      showSuccess('API key rotated successfully');
      loadApiKeys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rotate API key';
      showError(errorMessage);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to revoke API key');
      }

      showSuccess('API key revoked successfully');
      loadApiKeys();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to revoke API key';
      showError(errorMessage);
    }
  };

  const handleCopyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    showSuccess('API key copied to clipboard');
  };

  const filteredKeys = apiKeys.filter((key) =>
    key.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    key.key_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getOrganizationName = (orgId: string | null) => {
    if (!orgId) return 'N/A';
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || 'Unknown';
  };

  const maskKeyId = (keyId: string) => {
    if (keyId.length <= 20) return keyId;
    return `${keyId.substring(0, 12)}****${keyId.substring(keyId.length - 4)}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            color: theme.palette.text.primary,
            fontWeight: 600,
            fontFamily: 'var(--font-rubik), Rubik, sans-serif',
          }}
        >
          API Key Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            backgroundColor: theme.palette.text.primary,
            color: theme.palette.background.default,
            '&:hover': {
              backgroundColor: theme.palette.text.secondary,
            },
          }}
        >
          Create API Key
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name or key ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: theme.palette.text.secondary }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.action.hover,
              '& fieldset': {
                borderColor: theme.palette.divider,
              },
            },
          }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} sx={{ backgroundColor: theme.palette.action.hover }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Key Name</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Key ID</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Scope</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Organization</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Permissions</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Last Used</TableCell>
                <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredKeys.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: theme.palette.text.secondary }}>
                    {searchTerm ? 'No API keys found matching your search' : 'No API keys created yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredKeys.map((key) => (
                  <TableRow key={key.id} hover>
                    <TableCell sx={{ color: theme.palette.text.primary }}>{key.name}</TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                      {maskKeyId(key.key_id)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={key.scope === 'global' ? 'Global' : 'Org'}
                        size="small"
                        sx={{
                          backgroundColor: key.scope === 'global' ? theme.palette.info.main : theme.palette.primary.main,
                          color: theme.palette.background.default,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>
                      {key.scope === 'org' ? getOrganizationName(key.organization_id) : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={key.permissions === 'read' ? 'Read-only' : 'Read & Write'}
                        size="small"
                        sx={{
                          backgroundColor: key.permissions === 'read' ? theme.palette.warning.main : theme.palette.success.main,
                          color: theme.palette.background.default,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={key.status}
                        size="small"
                        sx={{
                          backgroundColor:
                            key.status === 'active'
                              ? theme.palette.success.main
                              : key.status === 'revoked'
                              ? theme.palette.error.main
                              : theme.palette.warning.main,
                          color: theme.palette.background.default,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>
                      {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewKey(key)}
                          sx={{ color: theme.palette.text.secondary }}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                        {key.status === 'active' && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleRotateKey(key.id)}
                              sx={{ color: theme.palette.text.secondary }}
                            >
                              <RefreshIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleRevokeKey(key.id)}
                              sx={{ color: theme.palette.error.main }}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create API Key Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false);
          setNewKeyValue(null);
          setIsRotatedKey(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: theme.palette.text.primary }}>
          {isRotatedKey ? 'API Key Rotated' : 'Create API Key'}
        </DialogTitle>
        <DialogContent>
          {newKeyValue ? (
            <Box>
              <Alert severity="warning" sx={{ mb: 2 }}>
                This is the only time you will see this API key. Make sure to copy it now!
              </Alert>
              <TextField
                fullWidth
                label="API Key"
                value={newKeyValue}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => handleCopyKey(newKeyValue)}>
                        <ContentCopyIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setNewKeyValue(null);
                  setIsRotatedKey(false);
                }}
              >
                Done
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Key Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Key Prefix (optional)"
                  value={formData.key_prefix}
                  onChange={(e) => setFormData({ ...formData, key_prefix: e.target.value })}
                  helperText="Custom prefix for the key ID (e.g., 'prod', 'webhook'). Will result in: sk_live_prod_abc12345"
                  placeholder="e.g., prod, webhook, staging"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Scope</InputLabel>
                  <Select
                    value={formData.scope}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        scope: e.target.value as 'global' | 'org',
                        organization_id: e.target.value === 'global' ? null : formData.organization_id,
                      })
                    }
                    label="Scope"
                  >
                    <MenuItem value="global">Global</MenuItem>
                    <MenuItem value="org">Organization-specific</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {formData.scope === 'org' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Organization</InputLabel>
                    <Select
                      value={formData.organization_id || ''}
                      onChange={(e) => setFormData({ ...formData, organization_id: e.target.value || null })}
                      label="Organization"
                      required
                    >
                      {organizations.map((org) => (
                        <MenuItem key={org.id} value={org.id}>
                          {org.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Permissions</InputLabel>
                  <Select
                    value={formData.permissions}
                    onChange={(e) => setFormData({ ...formData, permissions: e.target.value as 'read' | 'write' })}
                    label="Permissions"
                  >
                    <MenuItem value="read">Read-only</MenuItem>
                    <MenuItem value="write">Read & Write</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Expiration Date (optional)"
                  type="date"
                  value={formData.expires_at || ''}
                  onChange={(e) => setFormData({ ...formData, expires_at: e.target.value || null })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description (optional)"
                  multiline
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        {!newKeyValue && (
          <DialogActions>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateKey} variant="contained">
              Create
            </Button>
          </DialogActions>
        )}
      </Dialog>

      {/* View API Key Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: theme.palette.text.primary }}>API Key Details</DialogTitle>
        <DialogContent>
          {selectedKey && (
            <Box sx={{ mt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Name
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary }}>{selectedKey.name}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Key ID
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.secondary, fontFamily: 'monospace' }}>
                    {selectedKey.key_id}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Scope
                  </Typography>
                  <Chip
                    label={selectedKey.scope === 'global' ? 'Global' : 'Org'}
                    size="small"
                    sx={{
                      backgroundColor:
                        selectedKey.scope === 'global' ? theme.palette.info.main : theme.palette.primary.main,
                      color: theme.palette.background.default,
                    }}
                  />
                </Grid>
                {selectedKey.scope === 'org' && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                      Organization
                    </Typography>
                    <Typography sx={{ color: theme.palette.text.primary }}>
                      {getOrganizationName(selectedKey.organization_id)}
                    </Typography>
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Permissions
                  </Typography>
                  <Chip
                    label={selectedKey.permissions === 'read' ? 'Read-only' : 'Read & Write'}
                    size="small"
                    sx={{
                      backgroundColor:
                        selectedKey.permissions === 'read' ? theme.palette.warning.main : theme.palette.success.main,
                      color: theme.palette.background.default,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Status
                  </Typography>
                  <Chip
                    label={selectedKey.status}
                    size="small"
                    sx={{
                      backgroundColor:
                        selectedKey.status === 'active'
                          ? theme.palette.success.main
                          : selectedKey.status === 'revoked'
                          ? theme.palette.error.main
                          : theme.palette.warning.main,
                      color: theme.palette.background.default,
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Created At
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary }}>
                    {new Date(selectedKey.created_at).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                    Last Used
                  </Typography>
                  <Typography sx={{ color: theme.palette.text.primary }}>
                    {selectedKey.last_used_at ? new Date(selectedKey.last_used_at).toLocaleString() : 'Never'}
                  </Typography>
                </Grid>
                {selectedKey.description && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary }}>
                      Description
                    </Typography>
                    <Typography sx={{ color: theme.palette.text.primary }}>{selectedKey.description}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

