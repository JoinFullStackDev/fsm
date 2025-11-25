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

    // Load all users for adding
    const { data: usersData } = await supabase
      .from('users')
      .select('id, name, email, role')
      .order('name');

    if (usersData) {
      // Filter out users who are already members
      const memberUserIds = new Set(membersData?.map((m: any) => m.user_id) || []);
      setAvailableUsers(usersData.filter(u => !memberUserIds.has(u.id)) as User[]);
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
            <CircularProgress />
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <Box sx={{ backgroundColor: 'background.default', minHeight: '100vh', pb: 4 }}>
        <Container maxWidth="lg" sx={{ pt: 4, pb: 4 }}>
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
                color: 'primary.main',
                border: '1px solid',
                borderColor: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(0, 229, 255, 0.1)',
                  transform: 'translateX(-4px)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                flex: 1,
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00E5FF 0%, #E91E63 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Project Members
            </Typography>
          </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Card
          sx={{
            border: '2px solid',
            borderColor: 'secondary.main',
            backgroundColor: 'background.paper',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
              <Typography variant="h6" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                Members
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setOpenDialog(true)}
                sx={{
                  backgroundColor: 'secondary.main',
                  color: 'secondary.contrastText',
                  '&:hover': {
                    backgroundColor: 'secondary.dark',
                    boxShadow: '0 6px 25px rgba(233, 30, 99, 0.5)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                Add Member
              </Button>
            </Box>

            <TableContainer
              component={Paper}
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(233, 30, 99, 0.1)' }}>
                    <TableCell sx={{ color: 'secondary.main', fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ color: 'secondary.main', fontWeight: 600 }}>Email</TableCell>
                    <TableCell sx={{ color: 'secondary.main', fontWeight: 600 }}>Role</TableCell>
                    <TableCell align="right" sx={{ color: 'secondary.main', fontWeight: 600 }}>Actions</TableCell>
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
                            backgroundColor: 'rgba(233, 30, 99, 0.05)',
                          },
                        }}
                      >
                        <TableCell sx={{ color: 'text.primary' }}>{member.user?.name || 'N/A'}</TableCell>
                        <TableCell sx={{ color: 'text.primary' }}>{member.user?.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={member.role.toUpperCase()}
                            color={getRoleColor(member.role) as any}
                            size="small"
                            sx={{ fontWeight: 600 }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            onClick={() => handleRemoveClick(member.id)}
                            sx={{
                              color: 'error.main',
                              '&:hover': {
                                backgroundColor: 'rgba(255, 23, 68, 0.1)',
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
              backgroundColor: 'background.paper',
              border: '2px solid',
              borderColor: 'secondary.main',
              borderRadius: 3,
            },
          }}
        >
          <DialogTitle
            sx={{
              backgroundColor: 'rgba(233, 30, 99, 0.1)',
              borderBottom: '1px solid',
              borderColor: 'secondary.main',
              color: 'secondary.main',
              fontWeight: 600,
            }}
          >
            Add Project Member
          </DialogTitle>
          <DialogContent sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>User</InputLabel>
              <Select
                value={selectedUserId}
                label="User"
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {availableUsers.map((user) => (
                  <MenuItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={selectedRole}
                label="Role"
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              >
                <MenuItem value="pm">Product Manager</MenuItem>
                <MenuItem value="designer">Designer</MenuItem>
                <MenuItem value="engineer">Engineer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button
              onClick={() => setOpenDialog(false)}
              sx={{
                color: 'text.secondary',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
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
                backgroundColor: 'secondary.main',
                color: 'secondary.contrastText',
                '&:hover': {
                  backgroundColor: 'secondary.dark',
                },
                '&:disabled': {
                  backgroundColor: 'rgba(233, 30, 99, 0.3)',
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

