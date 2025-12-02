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
  CircularProgress,
  Alert,
  Tooltip,
  Paper,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import logger from '@/lib/utils/logger';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import RoleDialog from './RoleDialog';
import type { OrganizationRoleWithPermissions } from '@/types/organizationRoles';

export default function AdminRolesTab() {
  const theme = useTheme();
  const { showSuccess, showError } = useNotification();
  const { organization } = useOrganization();
  const [roles, setRoles] = useState<OrganizationRoleWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<OrganizationRoleWithPermissions | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<OrganizationRoleWithPermissions | null>(null);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/organization/roles');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load roles');
      }

      const data = await response.json();
      setRoles(data.roles || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load roles';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const handleCreateRole = () => {
    setSelectedRole(null);
    setRoleDialogOpen(true);
  };

  const handleEditRole = (role: OrganizationRoleWithPermissions) => {
    setSelectedRole(role);
    setRoleDialogOpen(true);
  };

  const handleDeleteRole = (role: OrganizationRoleWithPermissions) => {
    if (role.is_default) {
      showError('Cannot delete default roles');
      return;
    }

    if (role.user_count && role.user_count > 0) {
      showError(`Cannot delete role: ${role.user_count} user(s) are assigned to this role`);
      return;
    }

    setRoleToDelete(role);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    try {
      const response = await fetch(`/api/organization/roles/${roleToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete role');
      }

      showSuccess('Role deleted successfully');
      setDeleteConfirmOpen(false);
      setRoleToDelete(null);
      loadRoles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete role';
      showError(errorMessage);
    }
  };

  const handleRoleSaved = () => {
    loadRoles();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  if (error && roles.length === 0) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  const defaultRoles = roles.filter(r => r.is_default);
  const customRoles = roles.filter(r => !r.is_default);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Organization Roles
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateRole}
          sx={{ ml: 'auto' }}
        >
          Create Role
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {roles.length === 0 ? (
        <EmptyState
          icon={<SecurityIcon sx={{ fontSize: 48 }} />}
          title="No roles found"
          description="Create your first custom role to get started with granular permissions."
          actionLabel="Create Role"
          onAction={handleCreateRole}
        />
      ) : (
        <>
          {/* Default Roles */}
          {defaultRoles.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.secondary }}>
                Default Roles
              </Typography>
              <TableContainer component={Paper} sx={{ border: `1px solid ${theme.palette.divider}` }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Users</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {defaultRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontWeight: 500 }}>{role.name}</Typography>
                            <Chip label="Default" size="small" color="primary" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {role.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{role.user_count || 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip title="Edit role">
                            <IconButton
                              size="small"
                              onClick={() => handleEditRole(role)}
                              sx={{ color: theme.palette.text.secondary }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Custom Roles */}
          {customRoles.length > 0 && (
            <Box>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: theme.palette.text.secondary }}>
                Custom Roles
              </Typography>
              <TableContainer component={Paper} sx={{ border: `1px solid ${theme.palette.divider}` }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Permissions</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Users</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {customRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Typography sx={{ fontWeight: 500 }}>{role.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {role.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{role.user_count || 0}</Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit role">
                              <IconButton
                                size="small"
                                onClick={() => handleEditRole(role)}
                                sx={{ color: theme.palette.text.secondary }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete role">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteRole(role)}
                                disabled={!!role.user_count && role.user_count > 0}
                                sx={{ color: theme.palette.error.main }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {customRoles.length === 0 && defaultRoles.length > 0 && (
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                No custom roles yet. Create one to get started.
              </Typography>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleCreateRole}>
                Create Custom Role
              </Button>
            </Box>
          )}
        </>
      )}

      <RoleDialog
        open={roleDialogOpen}
        onClose={() => setRoleDialogOpen(false)}
        onSave={handleRoleSaved}
        role={selectedRole}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setRoleToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Role"
        message={`Are you sure you want to delete the role "${roleToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        severity="error"
      />
    </Box>
  );
}

