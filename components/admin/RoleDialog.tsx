'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useNotification } from '@/components/providers/NotificationProvider';
import RolePermissionMatrix from './RolePermissionMatrix';
import type { Permission } from '@/lib/rbac';
import type { OrganizationRoleWithPermissions } from '@/types/organizationRoles';

interface RoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  role?: OrganizationRoleWithPermissions | null;
}

export default function RoleDialog({ open, onClose, onSave, role }: RoleDialogProps) {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!role;
  const isDefaultRole = role?.is_default ?? false;

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name);
        setDescription(role.description || '');
        setPermissions(role.permissions || []);
      } else {
        setName('');
        setDescription('');
        setPermissions([]);
      }
      setError(null);
    }
  }, [open, role]);

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    if (name.trim().length > 100) {
      setError('Role name must be 100 characters or less');
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update role
        const updateResponse = await fetch(`/api/organization/roles/${role.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        });

        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || 'Failed to update role');
        }

        // Update permissions
        const permResponse = await fetch(`/api/organization/roles/${role.id}/permissions`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions }),
        });

        if (!permResponse.ok) {
          const errorData = await permResponse.json();
          throw new Error(errorData.error || 'Failed to update permissions');
        }

        showSuccess('Role updated successfully');
      } else {
        // Create role
        const response = await fetch('/api/organization/roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
            permissions,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create role');
        }

        showSuccess('Role created successfully');
      }

      onSave();
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
        {isEditing ? 'Edit Role' : 'Create Role'}
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isDefaultRole && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a default role. Only the name and description can be modified.
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <TextField
            label="Role Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            disabled={loading || isDefaultRole}
            sx={{ mb: 2 }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            disabled={loading}
            placeholder="Describe what this role can do..."
          />
        </Box>

        {!isDefaultRole && (
          <RolePermissionMatrix permissions={permissions} onChange={setPermissions} />
        )}

        {isDefaultRole && role && (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Permissions
            </Typography>
            <Box sx={{ pl: 2 }}>
              {role.permissions.length > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {role.permissions.join(', ')}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No permissions assigned
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={loading || !name.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {isEditing ? 'Save Changes' : 'Create Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

