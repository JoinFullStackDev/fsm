'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { createSupabaseClient } from '@/lib/supabaseClient';
import { useNotification } from '@/components/providers/NotificationProvider';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import EmptyState from '@/components/ui/EmptyState';
import { People as PeopleIcon } from '@mui/icons-material';
import type { UserRole } from '@/types/project';

interface ProjectMember {
  id: string;
  user_id: string;
  role: UserRole;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export default function ProjectMembersPage() {
  const theme = useTheme();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createSupabaseClient();
  const { showSuccess, showError } = useNotification();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('pm');
  const [projectName, setProjectName] = useState<string>('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Load project name for breadcrumbs
    const { data: projectData } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();
    
    if (projectData) {
      setProjectName(projectData.name);
    }

    // Load project members
    const { data: membersData, error: membersError } = await supabase
      .from('project_members')
      .select(`
        id,
        user_id,
        role,
        user:users!project_members_user_id_fkey (
          id,
          name,
          email
        )
      `)
      .eq('project_id', projectId);

    if (membersError) {
      setError(membersError.message);
      setLoading(false);
      return;
    }

    setMembers((membersData || []) as any);

    // Get current user's organization_id to filter users
    const { data: currentUser } = await supabase
      .from('users')
      .select('organization_id, role, is_super_admin')
      .eq('auth_id', session.user.id)
      .single();

    // Load users from the same organization (or all users if super admin)
    let usersQuery = supabase
      .from('users')
      .select('id, name, email, role')
      .order('name');

    // Filter by organization unless user is super admin
    if (currentUser && !(currentUser.role === 'admin' && currentUser.is_super_admin === true)) {
      if (currentUser.organization_id) {
        usersQuery = usersQuery.eq('organization_id', currentUser.organization_id);
      } else {
        // User has no organization, show no users
        setAvailableUsers([]);
        setLoading(false);
        return;
      }
    }

    const { data: usersData } = await usersQuery;

    if (usersData) {
      // Filter out users who are already members
      const memberUserIds = new Set(membersData?.map((m: any) => m.user_id) || []);
      setAvailableUsers(usersData.filter((u: any) => !memberUserIds.has(u.id)) as User[]);
    }

    setLoading(false);
  }, [projectId, router, supabase]);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId, loadData]);

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        showError('Failed to add member: ' + (error.error || 'Unknown error'));
        return;
      }

      showSuccess('Member added successfully');
      setOpenDialog(false);
      setSelectedUserId('');
      setSelectedRole('pm');
      // Reload data
      loadData();
    } catch (error) {
      showError('Failed to add member: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRemoveClick = (memberId: string) => {
    setMemberToRemove(memberId);
    setConfirmDialogOpen(true);
  };

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;

    const { error: removeError } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberToRemove);

    if (removeError) {
      showError('Failed to remove member: ' + removeError.message);
      setConfirmDialogOpen(false);
      setMemberToRemove(null);
      return;
    }

    showSuccess('Member removed successfully');
    setConfirmDialogOpen(false);
    setMemberToRemove(null);
    // Reload data
    loadData();
  };

  const handleRoleChange = (memberId: string, newRole: UserRole) => {
    setEditingMemberId(memberId);
    setEditingRole(newRole);
  };

  const handleRoleUpdate = async (memberId: string, newRole: UserRole) => {
    const member = members.find(m => m.id === memberId);
    if (!member || newRole === member.role) {
      handleRoleCancel();
      return;
    }

    setUpdatingRole(true);
    setEditingRole(newRole);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          role: newRole,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        showError('Failed to update role: ' + (error.error || 'Unknown error'));
        handleRoleCancel();
        setUpdatingRole(false);
        return;
      }

      showSuccess('Role updated successfully');
      handleRoleCancel();
      // Reload data
      loadData();
    } catch (error) {
      showError('Failed to update role: ' + (error instanceof Error ? error.message : 'Unknown error'));
      handleRoleCancel();
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleRoleCancel = () => {
    setEditingMemberId(null);
    setEditingRole(null);
  };

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
      <>
        <Container>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress sx={{ color: theme.palette.text.primary }} />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: theme.palette.background.default, minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4, px: { xs: 0, md: 3 } }}>
          <Breadcrumbs
            items={[
              { label: projectName || 'Project', href: `/project/${projectId}` },
              { label: 'Members' },
            ]}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <IconButton
              onClick={() => router.push(`/project/${projectId}`)}
              sx={{
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                flex: 1,
                fontWeight: 600,
                fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                color: theme.palette.text.primary,
              }}
            >
              Project Members
            </Typography>
          </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              backgroundColor: theme.palette.action.hover,
              border: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
            }}
          >
            {error}
          </Alert>
        )}

        <Card
          sx={{
            border: `1px solid ${theme.palette.divider}`,
            backgroundColor: theme.palette.background.paper,
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: theme.palette.text.primary, 
                  fontWeight: 600,
                  fontFamily: 'var(--font-rubik), Rubik, sans-serif',
                }}
              >
                Members
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
                sx={{
                  backgroundColor: theme.palette.text.primary,
                  color: theme.palette.background.default,
                  fontWeight: 600,
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    color: theme.palette.text.primary,
                  },
                }}
              >
                Add Member
              </Button>
            </Box>

            <TableContainer
              component={Paper}
              sx={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: theme.palette.background.paper }}>
                    <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Name</TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Email</TableCell>
                    <TableCell sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Role</TableCell>
                    <TableCell align="right" sx={{ color: theme.palette.text.primary, fontWeight: 600, borderBottom: `1px solid ${theme.palette.divider}` }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 6 }}>
                        <EmptyState
                          icon={<PeopleIcon sx={{ fontSize: 48 }} />}
                          title="No members yet"
                          description="Add team members to collaborate on this project. Each member can be assigned a role (PM, Designer, or Engineer)."
                          actionLabel="Add Member"
                          onAction={() => setOpenDialog(true)}
                          variant="minimal"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    members.map((member) => (
                      <TableRow
                        key={member.id}
                        sx={{
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                          borderBottom: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        <TableCell sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>{member.user?.name || 'N/A'}</TableCell>
                        <TableCell sx={{ color: theme.palette.text.primary, borderBottom: `1px solid ${theme.palette.divider}` }}>{member.user?.email}</TableCell>
                        <TableCell sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                          {editingMemberId === member.id ? (
                            <FormControl size="small" sx={{ minWidth: 120 }}>
                              <Select
                                value={editingRole || member.role}
                                onChange={(e) => {
                                  const newRole = e.target.value as UserRole;
                                  // Auto-save when selection changes
                                  handleRoleUpdate(member.id, newRole);
                                }}
                                disabled={updatingRole}
                                onClose={() => {
                                  // If role wasn't changed, cancel editing
                                  if (editingRole === member.role) {
                                    handleRoleCancel();
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    handleRoleCancel();
                                  }
                                }}
                                autoFocus
                                MenuProps={{
                                  PaperProps: {
                                    sx: {
                                      backgroundColor: theme.palette.background.paper,
                                      border: `1px solid ${theme.palette.divider}`,
                                      '& .MuiMenuItem-root': {
                                        color: theme.palette.text.primary,
                                        '&:hover': {
                                          backgroundColor: theme.palette.action.hover,
                                        },
                                        '&.Mui-selected': {
                                          backgroundColor: theme.palette.action.hover,
                                          '&:hover': {
                                            backgroundColor: theme.palette.action.hover,
                                          },
                                        },
                                      },
                                    },
                                  },
                                }}
                                sx={{
                                  color: theme.palette.text.primary,
                                  backgroundColor: theme.palette.background.paper,
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
                                <MenuItem value="pm">Product Manager</MenuItem>
                                <MenuItem value="designer">Designer</MenuItem>
                                <MenuItem value="engineer">Engineer</MenuItem>
                                <MenuItem value="admin">Admin</MenuItem>
                              </Select>
                            </FormControl>
                          ) : (
                            <Chip
                              label={member.role.toUpperCase()}
                              size="small"
                              onClick={() => handleRoleChange(member.id, member.role)}
                              sx={{ 
                                fontWeight: 600,
                                backgroundColor: theme.palette.action.hover,
                                color: theme.palette.text.primary,
                                border: `1px solid ${theme.palette.divider}`,
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: theme.palette.action.selected,
                                },
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                          <IconButton
                            onClick={() => handleRemoveClick(member.id)}
                            sx={{
                              color: theme.palette.text.primary,
                              '&:hover': {
                                backgroundColor: theme.palette.action.hover,
                              },
                            }}
                            size="small"
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
          </CardContent>
        </Card>

        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          PaperProps={{
            sx: {
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: theme.palette.action.hover,
              borderBottom: `1px solid ${theme.palette.divider}`,
              color: theme.palette.text.primary,
              fontWeight: 600,
              fontFamily: 'var(--font-rubik), Rubik, sans-serif',
            }}
          >
            Add Project Member
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>User</InputLabel>
              <Select
                value={selectedUserId}
                label="User"
                onChange={(e) => setSelectedUserId(e.target.value)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      '& .MuiMenuItem-root': {
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.hover,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.paper,
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
                {availableUsers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel sx={{ color: theme.palette.text.secondary }}>Role</InputLabel>
              <Select
                value={selectedRole}
                label="Role"
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}`,
                      '& .MuiMenuItem-root': {
                        color: theme.palette.text.primary,
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                        '&.Mui-selected': {
                          backgroundColor: theme.palette.action.hover,
                          '&:hover': {
                            backgroundColor: theme.palette.action.hover,
                          },
                        },
                      },
                    },
                  },
                }}
                sx={{
                  color: theme.palette.text.primary,
                  backgroundColor: theme.palette.background.paper,
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
                <MenuItem value="pm">Product Manager</MenuItem>
                <MenuItem value="designer">Designer</MenuItem>
                <MenuItem value="engineer">Engineer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
            <Button
              onClick={() => setOpenDialog(false)}
              sx={{
                color: theme.palette.text.secondary,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              variant="contained"
              disabled={!selectedUserId}
              sx={{
                backgroundColor: theme.palette.text.primary,
                color: theme.palette.background.default,
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                  color: theme.palette.text.primary,
                },
                '&.Mui-disabled': {
                  backgroundColor: theme.palette.divider,
                  color: theme.palette.text.secondary,
                },
              }}
            >
              Add
            </Button>
          </DialogActions>
        </Dialog>

        <ConfirmModal
          open={confirmDialogOpen}
          onClose={() => {
            setConfirmDialogOpen(false);
            setMemberToRemove(null);
          }}
          onConfirm={handleRemoveMember}
          title="Remove Member"
          message="Are you sure you want to remove this member from the project? This action cannot be undone."
          confirmText="Remove"
          cancelText="Cancel"
          severity="warning"
        />
        </Container>
      </Box>
    </>
  );
}

