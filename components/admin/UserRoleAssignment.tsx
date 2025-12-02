'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { OrganizationRoleWithPermissions } from '@/types/organizationRoles';

interface UserRoleAssignmentProps {
  userId: string;
  organizationId: string;
  primaryRole: string;
  assignedRoleIds: string[];
  availableRoles: OrganizationRoleWithPermissions[];
  onRolesChange: (roleIds: string[]) => void;
}

export default function UserRoleAssignment({
  userId,
  organizationId,
  primaryRole,
  assignedRoleIds,
  availableRoles,
  onRolesChange,
}: UserRoleAssignmentProps) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out default roles (users already have primary role)
  const customRoles = availableRoles.filter(r => !r.is_default);

  const handleRoleToggle = async (roleId: string) => {
    const isAssigned = assignedRoleIds.includes(roleId);
    setLoading(true);
    setError(null);

    try {
      if (isAssigned) {
        // Remove role
        const response = await fetch(`/api/users/${userId}/roles?role_id=${roleId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to remove role');
        }

        onRolesChange(assignedRoleIds.filter(id => id !== roleId));
      } else {
        // Add role
        const response = await fetch(`/api/users/${userId}/roles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role_id: roleId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to assign role');
        }

        onRolesChange([...assignedRoleIds, roleId]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
        Roles
      </Typography>

      {/* Primary Role */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Primary Role
        </Typography>
        <Chip
          label={primaryRole}
          color="primary"
          size="small"
          sx={{ fontWeight: 500 }}
        />
      </Box>

      {/* Custom Roles */}
      {customRoles.length > 0 ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Additional Roles
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {error}
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {customRoles.map((role) => {
              const isAssigned = assignedRoleIds.includes(role.id);
              return (
                <Chip
                  key={role.id}
                  label={role.name}
                  onClick={() => !loading && handleRoleToggle(role.id)}
                  color={isAssigned ? 'primary' : 'default'}
                  variant={isAssigned ? 'filled' : 'outlined'}
                  disabled={loading}
                  sx={{
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                />
              );
            })}
          </Box>
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Updating roles...
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No custom roles available. Create custom roles in the Roles tab.
        </Typography>
      )}
    </Box>
  );
}

