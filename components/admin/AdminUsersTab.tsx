'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '@/lib/hooks/useDebounce';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
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
} from '@mui/material';
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
import EmptyState from '@/components/ui/EmptyState';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CreateUserDialog from '@/components/admin/CreateUserDialog';
import ViewInviteDialog from '@/components/admin/ViewInviteDialog';
import { People as PeopleIcon } from '@mui/icons-material';
import type { User, UserRole } from '@/types/project';

export default function AdminUsersTab() {
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setUsers((data.users as User[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load users';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    const { error: updateError } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

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
    if (user?.invited_by_admin && !user.last_active_at) {
      showError('Cannot activate invited users. They must log in first to activate their account.');
      return;
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ is_active: !isActive })
      .eq('id', userId);

    if (updateError) {
      showError('Failed to update user status: ' + updateError.message);
      return;
    }

    setUsers(users.map(u => u.id === userId ? { ...u, is_active: !isActive } : u));
    showSuccess(`User ${!isActive ? 'activated' : 'deactivated'} successfully`);
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

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userToDelete.id);

    if (deleteError) {
      showError('Failed to delete user: ' + deleteError.message);
      setDeleteConfirmOpen(false);
      return;
    }

    setUsers(users.filter(u => u.id !== userToDelete.id));
    setDeleteConfirmOpen(false);
    setUserToDelete(null);
    showSuccess('User deleted successfully');
  };

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (selectedUsers.size === 0) {
      showError('Please select at least one user');
      return;
    }

    const userIds = Array.from(selectedUsers);
    
    if (action === 'delete') {
      const { error } = await supabase
        .from('users')
        .delete()
        .in('id', userIds);
      
      if (error) {
        showError('Failed to delete users: ' + error.message);
        return;
      }
      showSuccess(`${userIds.length} users deleted successfully`);
    } else {
      const { error } = await supabase
        .from('users')
        .update({ is_active: action === 'activate' })
        .in('id', userIds);
      
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
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ color: 'text.primary', fontWeight: 600 }}>
          User Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateUserDialogOpen(true)}
            sx={{
              backgroundColor: '#00E5FF',
              color: '#000',
              fontWeight: 600,
              '&:hover': {
                backgroundColor: '#00B2CC',
              },
            }}
          >
            Add User
          </Button>
          {selectedUsers.size > 0 && (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkAction('activate')}
                sx={{ borderColor: 'success.main', color: 'success.main' }}
              >
                Activate ({selectedUsers.size})
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleBulkAction('deactivate')}
                sx={{ borderColor: 'warning.main', color: 'warning.main' }}
              >
                Deactivate ({selectedUsers.size})
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => handleBulkAction('delete')}
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
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          select
          label="Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
          SelectProps={{
            native: true,
          }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="pm">PM</option>
          <option value="designer">Designer</option>
          <option value="engineer">Engineer</option>
        </TextField>
        <TextField
          select
          label="Status"
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 120 }}
          SelectProps={{
            native: true,
          }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </TextField>
      </Box>

      <Card
        sx={{
          border: '2px solid',
          borderColor: 'error.main',
          backgroundColor: 'background.paper',
        }}
      >
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(0, 229, 255, 0.1)' }}>
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
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Role</TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Created</TableCell>
                  <TableCell align="right" sx={{ color: 'primary.main', fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 6 }}>
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
                          backgroundColor: 'rgba(0, 229, 255, 0.05)',
                        },
                        opacity: user.is_active === false ? 0.6 : 1,
                      }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUsers.has(user.id)}
                          onChange={(e) => {
                            const newSelected = new Set(selectedUsers);
                            if (e.target.checked) {
                              newSelected.add(user.id);
                            } else {
                              newSelected.delete(user.id);
                            }
                            setSelectedUsers(newSelected);
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: 'text.primary' }}>{user.name || 'N/A'}</TableCell>
                      <TableCell sx={{ color: 'text.primary' }}>{user.email}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role.toUpperCase()}
                          color={getRoleColor(user.role) as any}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      <TableCell>
                        {user.invited_by_admin && !user.last_active_at ? (
                          <Chip
                            label="Pending Invite"
                            size="small"
                            sx={{
                              backgroundColor: 'rgba(255, 152, 0, 0.2)',
                              color: '#FF9800',
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
                                    color: 'success.main',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: 'success.main',
                                  },
                                }}
                              />
                            }
                            label={user.is_active ?? true ? 'Active' : 'Inactive'}
                            sx={{ m: 0 }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget);
                            setSelectedUser(user.id);
                          }}
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: 'primary.main',
                              backgroundColor: 'rgba(0, 229, 255, 0.1)',
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
        </CardContent>
      </Card>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => {
          setAnchorEl(null);
          setSelectedUser(null);
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
                  sx={{ color: '#00E5FF' }}
                >
                  View Invite
                </MenuItem>
              )}
              <MenuItem onClick={() => selectedUser && handleRoleChange(selectedUser, 'admin')}>
                Set as Admin
              </MenuItem>
              <MenuItem onClick={() => selectedUser && handleRoleChange(selectedUser, 'pm')}>
                Set as PM
              </MenuItem>
              <MenuItem onClick={() => selectedUser && handleRoleChange(selectedUser, 'designer')}>
                Set as Designer
              </MenuItem>
              <MenuItem onClick={() => selectedUser && handleRoleChange(selectedUser, 'engineer')}>
                Set as Engineer
              </MenuItem>
              <MenuItem 
                onClick={() => {
                  if (user) {
                    handleDeleteClick(user);
                  }
                }}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon sx={{ mr: 1, fontSize: 18 }} />
                Delete User
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
          // Reload users when dialog closes (in case user was created)
          loadUsers();
        }}
        onUserCreated={() => {
          // Refresh the user list when user is created
          // Don't close dialog here - let user see the password first
          loadUsers();
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
    </Box>
  );
}

