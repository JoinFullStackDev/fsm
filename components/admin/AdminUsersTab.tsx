'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
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
  Menu,
  MenuItem,
  TextField,
  InputAdornment,
  Switch,
  FormControlLabel,
  Checkbox,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Alert,
  Tooltip,
  Dialog,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { useRole } from '@/lib/hooks/useRole';
import logger from '@/lib/utils/logger';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CreateUserDialog from '@/components/admin/CreateUserDialog';
import ViewInviteDialog from '@/components/admin/ViewInviteDialog';
import { People as PeopleIcon, Edit as EditIcon } from '@mui/icons-material';
import type { User, UserRole } from '@/types/project';
import type { OrganizationRoleWithPermissions } from '@/types/organizationRoles';
import UserRoleAssignment from './UserRoleAssignment';

export default function AdminUsersTab() {
  const theme = useTheme();
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const { organization, features } = useOrganization();
  const { isSuperAdmin } = useRole();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLimit, setUserLimit] = useState<{ current: number; limit: number | null; allowed: boolean; reason?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [viewInviteDialogOpen, setViewInviteDialogOpen] = useState(false);
  const [selectedUserForInvite, setSelectedUserForInvite] = useState<User | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    perUserPrice: number | null;
    billingInterval: 'month' | 'year' | null;
    pricingModel: 'per_user' | 'flat_rate' | null;
  } | null>(null);
  const [availableRoles, setAvailableRoles] = useState<OrganizationRoleWithPermissions[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string[]>>({}); // userId -> roleIds[]
  const [roleAssignmentDialogOpen, setRoleAssignmentDialogOpen] = useState(false);
  const [selectedUserForRoleAssignment, setSelectedUserForRoleAssignment] = useState<User | null>(null);

  // Debounce search term to avoid filtering on every keystroke
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use API route to fetch users (bypasses RLS issues)
      const response = await fetch('/api/admin/users');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load users');
      }
      
      const data = await response.json();
      const fetchedUsers = (data.users as User[]) || [];
      
      // CRITICAL SAFETY CHECK: Filter out any users that don't belong to current organization
      // This is a defensive measure in case the API route has a bug
      // NEVER display users from other organizations, even if the API returns them
      if (organization?.id) {
        const orgUsers = fetchedUsers.filter((user: any) => {
          return user.organization_id === organization.id && user.organization_id !== null;
        });
        if (orgUsers.length !== fetchedUsers.length) {
          logger.error('[AdminUsersTab] CRITICAL SECURITY ISSUE: API returned users from other organizations!', {
            total: fetchedUsers.length,
            filtered: orgUsers.length,
            organizationId: organization.id,
            returnedUserIds: fetchedUsers.map((u: any) => ({ id: u.id, orgId: u.organization_id }))
          });
        }
        setUsers(orgUsers);
      } else {
        // If no organization context, don't show any users (shouldn't happen, but be safe)
        logger.error('[AdminUsersTab] No organization context available, cannot safely display users');
        setUsers([]);
        setError('Organization context not available. Please refresh the page.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError, organization?.id]);

  const loadUserLimit = useCallback(async () => {
    if (isSuperAdmin) {
      // Super admins have no limits
      setUserLimit({ current: users.length, limit: null, allowed: true });
      return;
    }

    if (!organization?.id) return;

    try {
      const response = await fetch('/api/organization/limits');
      if (response.ok) {
        const data = await response.json();
        setUserLimit({
          current: data.users?.current || users.length,
          limit: data.users?.limit || null,
          allowed: data.users?.allowed !== false,
          reason: data.users?.reason,
        });
      } else {
        // If limit check fails, use current user count
        setUserLimit({ current: users.length, limit: null, allowed: true });
      }
    } catch (err) {
      // If limit check fails, allow but don't show limit info
      setUserLimit({ current: users.length, limit: null, allowed: true });
    }
  }, [organization, isSuperAdmin, users.length]);

  const loadSubscriptionInfo = useCallback(async () => {
    if (!organization?.id) return;

    try {
      const response = await fetch('/api/organization/subscription');
      if (response.ok) {
        const data = await response.json();
        const sub = data.subscription;
        if (sub?.package) {
          const packageData = sub.package;
          const billingInterval = sub.billing_interval || 'month';
          const pricingModel = packageData.pricing_model || 'per_user';
          
          let perUserPrice: number | null = null;
          if (pricingModel === 'per_user') {
            perUserPrice = billingInterval === 'month' 
              ? packageData.price_per_user_monthly 
              : packageData.price_per_user_yearly;
          }

          setSubscriptionInfo({
            perUserPrice,
            billingInterval,
            pricingModel,
          });
        }
      }
    } catch (err) {
      // Silently fail - subscription info is optional
      logger.debug('[AdminUsersTab] Error loading subscription info:', err);
    }
  }, [organization?.id]);

  const loadRoles = useCallback(async () => {
    if (!organization?.id) return;
    
    try {
      const response = await fetch('/api/organization/roles');
      if (response.ok) {
        const data = await response.json();
        setAvailableRoles(data.roles || []);
      }
    } catch (err) {
      logger.error('[AdminUsersTab] Error loading roles:', err);
    }
  }, [organization?.id]);

  const loadUserRoles = useCallback(async () => {
    if (!organization?.id || users.length === 0) return;
    
    try {
      // OPTIMIZED: Use batch endpoint instead of N individual API calls
      // This reduces 50+ API calls to just 1 call
      const response = await fetch('/api/organization/users/roles');
      if (!response.ok) {
        throw new Error('Failed to load user roles');
      }
      
      const data = await response.json();
      const allRoles = data.roles || {};
      
      // Extract custom role IDs (exclude default role) for each user
      const rolesMap: Record<string, string[]> = {};
      Object.keys(allRoles).forEach((userId) => {
        const userRoles = allRoles[userId] || [];
        const customRoleIds = userRoles
          .filter((r: any) => !r.isDefault)
          .map((r: any) => r.id);
        rolesMap[userId] = customRoleIds;
      });
      
      setUserRoles(rolesMap);
    } catch (err) {
      logger.error('[AdminUsersTab] Error loading user roles:', err);
      // On error, set empty map to prevent UI issues
      setUserRoles({});
    }
  }, [users, organization?.id]);

  // Load users and roles on mount and when organization changes
  useEffect(() => {
    loadUsers();
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]); // Only depend on organization ID, not the callbacks

  // Load user limit when users change or organization changes
  useEffect(() => {
    if (users.length > 0 || !loading) {
      loadUserLimit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length, loading, organization?.id]); // Don't depend on callback

  // Load subscription info when organization changes
  useEffect(() => {
    loadSubscriptionInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id]); // Don't depend on callback

  // Load user roles when users change
  useEffect(() => {
    if (users.length > 0) {
      loadUserRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users.length, organization?.id]); // Only depend on users.length, not the full users array or callback

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    // Verify user belongs to current organization before updating
    const user = users.find(u => u.id === userId);
    if (!user) {
      showError('User not found');
      return;
    }
    
    if (organization?.id && (user as any).organization_id !== organization.id) {
      showError('Cannot update user from another organization');
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .eq('organization_id', organization?.id || ''); // Additional safety check

    if (updateError) {
      showError('Failed to update role: ' + updateError.message);
      return;
    }

    setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    setAnchorEl(null);
    setSelectedUser(null);
    showSuccess('User role updated successfully');
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    // Check if user was invited by admin and hasn't logged in yet
    const user = users.find(u => u.id === userId);
    if (!user) {
      showError('User not found');
      return;
    }
    
    // Verify user belongs to current organization
    if (organization?.id && (user as any).organization_id !== organization.id) {
      showError('Cannot update user from another organization');
      return;
    }
    
    if (user?.invited_by_admin && !user.last_active_at) {
      showError('Cannot activate invited users. They must log in first to activate their account.');
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !isActive }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update user status');
      }

      const data = await response.json();
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
      showSuccess(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      showError('Failed to update user status: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleViewInvite = (user: User) => {
    setSelectedUserForInvite(user);
    setViewInviteDialogOpen(true);
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
    setAnchorEl(null);
    setSelectedUser(null);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    // Verify user belongs to current organization
    if (organization?.id && (userToDelete as any).organization_id !== organization.id) {
      showError('Cannot delete user from another organization');
      setDeleteConfirmOpen(false);
      return;
    }

    // Prevent deletion of super admin users
    if ((userToDelete as any).is_super_admin) {
      showError('Cannot delete super admin user');
      setDeleteConfirmOpen(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userToDelete.id)
      .eq('organization_id', organization?.id || ''); // Additional safety check

    if (deleteError) {
      showError('Failed to delete user: ' + deleteError.message);
      setDeleteConfirmOpen(false);
      return;
    }

    setUsers(users.filter(u => u.id !== userToDelete.id));
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
    showSuccess('User deleted successfully');

    // Reload users and limits to get accurate counts
    await loadUsers();
    await loadUserLimit();

    // Update subscription quantity after user deletion
    if (organization?.id) {
      try {
        const response = await fetch('/api/admin/users/subscription', {
          method: 'POST',
        });
        if (!response.ok) {
          logger.warn('[AdminUsersTab] Failed to update subscription after user deletion');
          // Don't show error to user - subscription update is non-critical
        } else {
          // Refresh subscription info to show updated pricing
          loadSubscriptionInfo();
        }
      } catch (err) {
        logger.error('[AdminUsersTab] Error updating subscription after user deletion:', err);
      }
    }
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) {
      showError('Please select at least one user');
      return;
    }

    const userIds = Array.from(selectedUsers);
    
    // Verify all selected users belong to current organization
    const usersToModify = users.filter(u => userIds.includes(u.id));
    if (organization?.id) {
      const invalidUsers = usersToModify.filter(u => (u as any).organization_id !== organization.id);
      if (invalidUsers.length > 0) {
        showError(`Cannot ${action} users from another organization`);
        return;
      }
    }
    
    if (action === 'delete') {
      // Check for super admin users before deleting
      const superAdmins = usersToModify.filter(u => (u as any).is_super_admin);
      
      if (superAdmins.length > 0) {
        showError(`Cannot delete super admin user(s): ${superAdmins.map(u => u.email).join(', ')}`);
        return;
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', userIds)
        .eq('organization_id', organization?.id || ''); // Additional safety check
      
      if (error) {
        showError('Failed to delete users: ' + error.message);
        return;
      }
      showSuccess(`${userIds.length} users deleted successfully`);

      // Reload users and limits to get accurate counts
      await loadUsers();
      await loadUserLimit();

      // Update subscription quantity after bulk user deletion
      if (organization?.id) {
        try {
          const response = await fetch('/api/admin/users/subscription', {
            method: 'POST',
          });
          if (!response.ok) {
            logger.warn('[AdminUsersTab] Failed to update subscription after bulk user deletion');
            // Don't show error to user - subscription update is non-critical
          } else {
            // Refresh subscription info to show updated pricing
            loadSubscriptionInfo();
          }
        } catch (err) {
          logger.error('[AdminUsersTab] Error updating subscription after bulk user deletion:', err);
        }
      }
    } else {
      const { error } = await supabase
        .from('users')
        .update({ is_active: action === 'activate' })
        .in('id', userIds)
        .eq('organization_id', organization?.id || ''); // Additional safety check
      
      if (error) {
        showError(`Failed to ${action} users: ` + error.message);
        return;
      }
      showSuccess(`${userIds.length} users ${action}d successfully`);
    }

    setSelectedUsers(new Set());
    loadUsers();
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      // For active filter, consider invited users (who haven't logged in) as inactive
      const isActuallyActive = user.invited_by_admin && !user.last_active_at 
        ? false 
        : (user.is_active ?? true);
      
      const matchesActive = 
        activeFilter === 'all' || 
        (activeFilter === 'active' && isActuallyActive) ||
        (activeFilter === 'inactive' && !isActuallyActive);
      
      return matchesSearch && matchesRole && matchesActive;
    });
  }, [users, debouncedSearchTerm, roleFilter, activeFilter]);

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'pm':
        return 'primary';
      case 'designer':
        return 'secondary';
      case 'engineer':
        return 'success';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress sx={{ color: theme.palette.text.primary }} />
      </Box>
    );
  }

  // Check if at limit and show warning
  const isAtLimit = userLimit && userLimit.limit !== null && userLimit.current >= userLimit.limit;
  const showLimitWarning = isAtLimit && userLimit?.reason;

  // Calculate estimated cost increase
  const estimatedCostIncrease = subscriptionInfo?.perUserPrice 
    ? subscriptionInfo.perUserPrice 
    : null;
  const costDisplay = estimatedCostIncrease && subscriptionInfo
    ? `$${estimatedCostIncrease.toFixed(2)}/${subscriptionInfo.billingInterval === 'year' ? 'yr' : 'mo'}`
    : null;

  return (
    <Box>
      {showLimitWarning && (
        <Alert 
          severity="info" 
          sx={{ 
            mb: 2,
            backgroundColor: theme.palette.action.hover,
            border: `1px solid ${theme.palette.divider}`,
            color: theme.palette.text.primary,
          }}
        >
          {userLimit.reason}
          {costDisplay && (
            <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
              Each additional user will cost {costDisplay}.
            </Typography>
          )}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            User Management
          </Typography>
          {userLimit && !isSuperAdmin && (
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mt: 0.5, display: 'block' }}>
              {userLimit.limit !== null 
                ? `${userLimit.current} / ${userLimit.limit} users`
                : `${userLimit.current} users (unlimited)`}
              {subscriptionInfo?.pricingModel === 'per_user' && costDisplay && (
                <span> • {costDisplay} per user</span>
              )}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip
            title={
              subscriptionInfo?.pricingModel === 'per_user' && costDisplay
                ? `Adding a user will increase your subscription by ${costDisplay}`
                : ''
            }
            arrow
          >
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setCreateUserDialogOpen(true)}
              disabled={userLimit !== null && !userLimit.allowed}
              sx={{
                borderColor: theme.palette.text.primary,
                color: theme.palette.text.primary,
                fontWeight: 600,
                '&:hover': {
                  borderColor: theme.palette.text.primary,
                  backgroundColor: theme.palette.action.hover,
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
            >
              Add User
            </Button>
          </Tooltip>
          {selectedUsers.size > 0 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkAction('activate')}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Activate ({selectedUsers.size})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkAction('deactivate')}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Deactivate ({selectedUsers.size})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkAction('delete')}
                sx={{
                  borderColor: theme.palette.text.primary,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.text.primary,
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                disabled={Array.from(selectedUsers).some(id => {
                  const user = users.find(u => u.id === id);
                  return (user as any)?.is_super_admin === true;
                })}
              >
                Delete ({selectedUsers.size})
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{
            flex: 1,
            minWidth: 200,
            '& .MuiOutlinedInput-root': {
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              '& fieldset': {
                borderColor: theme.palette.divider,
              },
              '&:hover fieldset': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused fieldset': {
                borderColor: theme.palette.text.primary,
              },
            },
            '& .MuiInputLabel-root': {
              color: theme.palette.text.secondary,
            },
            '& input::placeholder': {
              color: theme.palette.text.secondary,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: theme.palette.text.secondary }} />
              </InputAdornment>
            ),
          }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ color: theme.palette.text.secondary }}>Role</InputLabel>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            label="Role"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.primary,
              },
              '& .MuiSvgIcon-root': {
                color: theme.palette.text.secondary,
              },
            }}
          >
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="pm">PM</MenuItem>
            <MenuItem value="designer">Designer</MenuItem>
            <MenuItem value="engineer">Engineer</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ color: theme.palette.text.secondary }}>Status</InputLabel>
          <Select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            label="Status"
            sx={{
              backgroundColor: theme.palette.action.hover,
              color: theme.palette.text.primary,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.divider,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.secondary,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: theme.palette.text.primary,
              },
              '& .MuiSvgIcon-root': {
                color: theme.palette.text.secondary,
              },
            }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="inactive">Inactive</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer
        sx={{
          backgroundColor: theme.palette.background.paper,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2,
        }}
      >
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.background.paper }}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                  indeterminate={selectedUsers.size > 0 && selectedUsers.size < filteredUsers.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
                    } else {
                      setSelectedUsers(new Set());
                    }
                  }}
                  sx={{
                    color: theme.palette.text.secondary,
                    '&.Mui-checked': {
                      color: theme.palette.text.primary,
                    },
                  }}
                />
              </TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Name</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Email</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Role</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Custom Roles</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Status</TableCell>
              <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Created</TableCell>
              <TableCell align="right" sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Actions</TableCell>
            </TableRow>
          </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 6 }}>
                      <EmptyState
                        icon={<PeopleIcon sx={{ fontSize: 48 }} />}
                        title={searchTerm || roleFilter !== 'all' || activeFilter !== 'all' ? "No users found" : "No users yet"}
                        description={searchTerm || roleFilter !== 'all' || activeFilter !== 'all'
                          ? "Try adjusting your search or filter criteria."
                          : "Users will appear here once they sign up."}
                        variant="minimal"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        opacity: user.is_active === false ? 0.6 : 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          disabled={(user as any)?.is_super_admin === true}
                          onChange={(e) => {
                            const newSelected = new Set(selectedUsers);
                            if (e.target.checked) {
                              newSelected.add(user.id);
                            } else {
                              newSelected.delete(user.id);
                            }
                            setSelectedUsers(newSelected);
                          }}
                          sx={{
                            color: theme.palette.text.secondary,
                            '&.Mui-checked': {
                              color: theme.palette.text.primary,
                            },
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>{user.name || 'N/A'}</TableCell>
                      <TableCell sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>{user.email}</TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Chip
                            label={user.role.toUpperCase()}
                            color={getRoleColor(user.role) as any}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                          {(user as any)?.is_super_admin && (
                            <Chip
                              label="SUPER ADMIN"
                              color="warning"
                              size="small"
                              sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          {userRoles[user.id]?.length > 0 ? (
                            <>
                              {userRoles[user.id].map((roleId) => {
                                const role = availableRoles.find(r => r.id === roleId);
                                return role ? (
                                  <Chip
                                    key={roleId}
                                    label={role.name}
                                    size="small"
                                    sx={{ fontSize: '0.7rem' }}
                                  />
                                ) : null;
                              })}
                            </>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                              None
                            </Typography>
                          )}
                          <IconButton
                            size="small"
                            onClick={() => {
                              setSelectedUserForRoleAssignment(user);
                              setRoleAssignmentDialogOpen(true);
                            }}
                            sx={{ ml: 0.5 }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {user.invited_by_admin && !user.last_active_at ? (
                          <Chip
                            label="Pending Invite"
                            size="small"
                            sx={{
                              backgroundColor: theme.palette.action.hover,
                              color: theme.palette.text.primary,
                              border: `1px solid ${theme.palette.divider}`,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <FormControlLabel
                            control={
                              <Switch
                                checked={user.is_active ?? true}
                                onChange={() => handleToggleActive(user.id, user.is_active ?? true)}
                                size="small"
                                disabled={user.invited_by_admin && !user.last_active_at}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: theme.palette.text.primary,
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: theme.palette.text.primary,
                                  },
                                }}
                              />
                            }
                            label={user.is_active ?? true ? 'Active' : 'Inactive'}
                            sx={{ m: 0, color: theme.palette.text.primary }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: theme.palette.text.secondary, borderBottom: `1px solid ${theme.palette.divider}` }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                        <IconButton
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedUser(user.id);
                          }}
                          sx={{
                            color: theme.palette.text.primary,
                            '&:hover': {
                              backgroundColor: theme.palette.action.hover,
                            },
                          }}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedUser(null);
        }}
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          },
        }}
      >
        {selectedUser && (() => {
          const user = users.find(u => u.id === selectedUser);
          const isInvitedPending = user?.invited_by_admin && !user?.last_active_at;
          
          return (
            <>
              {isInvitedPending && (
                <MenuItem 
                  onClick={() => {
                    if (user) handleViewInvite(user);
                  }}
                  sx={{
                    color: theme.palette.text.primary,
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  View Invite
                </MenuItem>
              )}
              <MenuItem
                onClick={() => selectedUser && handleRoleChange(selectedUser, 'admin')}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Set as Admin
              </MenuItem>
              <MenuItem
                onClick={() => selectedUser && handleRoleChange(selectedUser, 'pm')}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Set as PM
              </MenuItem>
              <MenuItem
                onClick={() => selectedUser && handleRoleChange(selectedUser, 'designer')}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Set as Designer
              </MenuItem>
              <MenuItem
                onClick={() => selectedUser && handleRoleChange(selectedUser, 'engineer')}
                sx={{
                  color: theme.palette.text.primary,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                Set as Engineer
              </MenuItem>
              <MenuItem 
                onClick={() => {
                  if (user) {
                    handleDeleteClick(user);
                  }
                }}
                disabled={(user as any)?.is_super_admin === true}
                sx={{
                  color: theme.palette.error.main,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
                {(user as any)?.is_super_admin ? 'Delete User (Super Admin)' : 'Delete User'}
              </MenuItem>
            </>
          );
        })()}
      </Menu>

      <ConfirmModal
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={`Are you sure you want to delete ${userToDelete?.name || userToDelete?.email}? This action cannot be undone.`}
        confirmText="Delete"
        severity="error"
      />

      <CreateUserDialog
        open={createUserDialogOpen}
        onClose={() => {
          setCreateUserDialogOpen(false);
          // Reload users and subscription info when dialog closes (in case user was created)
          loadUsers();
          loadSubscriptionInfo();
        }}
        onUserCreated={() => {
          // Refresh the user list and subscription info when user is created
          // Don't close dialog here - let user see the password first
          loadUsers();
          loadSubscriptionInfo();
        }}
      />

      {selectedUserForInvite && (
        <ViewInviteDialog
          open={viewInviteDialogOpen}
          userEmail={selectedUserForInvite.email}
          userId={selectedUserForInvite.id}
          onClose={() => {
            setViewInviteDialogOpen(false);
            setSelectedUserForInvite(null);
          }}
        />
      )}

      {/* Role Assignment Dialog */}
      {selectedUserForRoleAssignment && organization?.id && (
        <Dialog
          open={roleAssignmentDialogOpen}
          onClose={() => {
            setRoleAssignmentDialogOpen(false);
            setSelectedUserForRoleAssignment(null);
          }}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Assign Roles: {selectedUserForRoleAssignment.name || selectedUserForRoleAssignment.email}
            </Typography>
            <UserRoleAssignment
              userId={selectedUserForRoleAssignment.id}
              organizationId={organization.id}
              primaryRole={selectedUserForRoleAssignment.role}
              assignedRoleIds={userRoles[selectedUserForRoleAssignment.id] || []}
              availableRoles={availableRoles}
              onRolesChange={(roleIds) => {
                setUserRoles({
                  ...userRoles,
                  [selectedUserForRoleAssignment.id]: roleIds,
                });
                loadUserRoles(); // Refresh to get updated data
              }}
            />
          </Box>
        </Dialog>
      )}
    </Box>
  );
}

