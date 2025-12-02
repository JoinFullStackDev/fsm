'use client';

import { Box, Typography, FormGroup, FormControlLabel, Checkbox, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { Permission } from '@/lib/rbac';

interface RolePermissionMatrixProps {
  permissions: Permission[];
  onChange: (permissions: Permission[]) => void;
}

const PERMISSION_GROUPS = [
  {
    label: 'Project Management',
    permissions: ['view_all_projects', 'create_projects', 'edit_project', 'delete_project'] as Permission[],
  },
  {
    label: 'Phase Management',
    permissions: ['edit_phases'] as Permission[],
  },
  {
    label: 'Export',
    permissions: ['export_blueprint', 'export_cursor'] as Permission[],
  },
  {
    label: 'User Management',
    permissions: ['manage_users', 'manage_project_members'] as Permission[],
  },
];

const PERMISSION_LABELS: Record<Permission, string> = {
  view_all_projects: 'View All Projects',
  create_projects: 'Create Projects',
  edit_project: 'Edit Project',
  delete_project: 'Delete Project',
  edit_phases: 'Edit Phases',
  export_blueprint: 'Export Blueprint',
  export_cursor: 'Export Cursor',
  manage_users: 'Manage Users',
  manage_project_members: 'Manage Project Members',
};

export default function RolePermissionMatrix({ permissions, onChange }: RolePermissionMatrixProps) {
  const theme = useTheme();

  const handlePermissionToggle = (permission: Permission) => {
    if (permissions.includes(permission)) {
      onChange(permissions.filter(p => p !== permission));
    } else {
      onChange([...permissions, permission]);
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        Permissions
      </Typography>
      {PERMISSION_GROUPS.map((group) => (
        <Paper
          key={group.label}
          sx={{
            p: 2,
            mb: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: theme.palette.text.secondary }}>
            {group.label}
          </Typography>
          <FormGroup>
            {group.permissions.map((permission) => (
              <FormControlLabel
                key={permission}
                control={
                  <Checkbox
                    checked={permissions.includes(permission)}
                    onChange={() => handlePermissionToggle(permission)}
                    size="small"
                  />
                }
                label={PERMISSION_LABELS[permission]}
                sx={{ mb: 0.5 }}
              />
            ))}
          </FormGroup>
        </Paper>
      ))}
    </Box>
  );
}

