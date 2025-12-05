'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  Avatar,
  AvatarGroup,
  Tooltip,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  PersonRemove as PersonRemoveIcon,
  Groups as GroupsIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type { TeamWithMembers, TeamMember } from '@/types/project';

// Color palette for teams
const TEAM_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

interface OrgUser {
  id: string;
  name: string | null;
  email: string;
}

export default function AdminTeamsTab() {
  const theme = useTheme();
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Form state
  const [editingTeam, setEditingTeam] = useState<TeamWithMembers | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);
  const [saving, setSaving] = useState(false);
  
  // Member management state
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/teams');
      if (!response.ok) throw new Error('Failed to load teams');
      const data = await response.json();
      setTeams(data.teams || []);
      setError(null);
    } catch (err) {
      setError('Failed to load teams');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrgUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch('/api/admin/users');
      if (!response.ok) throw new Error('Failed to load users');
      const data = await response.json();
      setOrgUsers(data.users || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleOpenTeamDialog = (team?: TeamWithMembers) => {
    if (team) {
      setEditingTeam(team);
      setTeamName(team.name);
      setTeamDescription(team.description || '');
      setTeamColor(team.color);
    } else {
      setEditingTeam(null);
      setTeamName('');
      setTeamDescription('');
      setTeamColor(TEAM_COLORS[teams.length % TEAM_COLORS.length]);
    }
    setTeamDialogOpen(true);
  };

  const handleCloseTeamDialog = () => {
    setTeamDialogOpen(false);
    setEditingTeam(null);
    setTeamName('');
    setTeamDescription('');
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return;
    
    setSaving(true);
    try {
      const url = editingTeam ? `/api/teams/${editingTeam.id}` : '/api/teams';
      const method = editingTeam ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          color: teamColor,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save team');
      }
      
      await loadTeams();
      handleCloseTeamDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDeleteDialog = (team: TeamWithMembers) => {
    setSelectedTeam(team);
    setDeleteDialogOpen(true);
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete team');
      
      await loadTeams();
      setDeleteDialogOpen(false);
      setSelectedTeam(null);
    } catch (err) {
      setError('Failed to delete team');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenMemberDialog = (team: TeamWithMembers) => {
    setSelectedTeam(team);
    setSelectedUser(null);
    setMemberDialogOpen(true);
    loadOrgUsers();
  };

  const handleCloseMemberDialog = () => {
    setMemberDialogOpen(false);
    setSelectedTeam(null);
    setSelectedUser(null);
  };

  const handleAddMember = async () => {
    if (!selectedTeam || !selectedUser) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: selectedUser.id }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add member');
      }
      
      await loadTeams();
      handleCloseMemberDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (team: TeamWithMembers, userId: string) => {
    setRemovingMember(userId);
    try {
      const response = await fetch(`/api/teams/${team.id}/members?user_id=${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to remove member');
      
      await loadTeams();
    } catch (err) {
      setError('Failed to remove member');
    } finally {
      setRemovingMember(null);
    }
  };

  // Get users not already in the selected team
  const availableUsers = orgUsers.filter(
    (user) => !selectedTeam?.members.some((m) => m.user_id === user.id)
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, fontWeight: 600 }}>
            Teams
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Organize members into teams for cross-project collaboration and filtering
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenTeamDialog()}
          sx={{ textTransform: 'none' }}
        >
          Create Team
        </Button>
      </Box>

      {teams.length === 0 ? (
        <Paper
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <GroupsIcon sx={{ fontSize: 48, color: theme.palette.text.secondary, mb: 2 }} />
          <Typography variant="h6" sx={{ color: theme.palette.text.primary, mb: 1 }}>
            No teams yet
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 2 }}>
            Create teams to group members for easier collaboration and data filtering.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenTeamDialog()}>
            Create First Team
          </Button>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Team</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Members</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 150 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id} hover>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: team.color,
                        }}
                      />
                      <Typography sx={{ fontWeight: 500 }}>{team.name}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ color: theme.palette.text.secondary, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {team.description || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {team.members.length > 0 ? (
                        <>
                          <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' } }}>
                            {team.members.map((member) => (
                              <Tooltip key={member.id} title={member.user?.name || member.user?.email || 'Unknown'}>
                                <Avatar sx={{ bgcolor: team.color }}>
                                  {(member.user?.name || member.user?.email || '?')[0].toUpperCase()}
                                </Avatar>
                              </Tooltip>
                            ))}
                          </AvatarGroup>
                          <Chip label={team.member_count} size="small" variant="outlined" />
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                          No members
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Add Member">
                        <IconButton size="small" onClick={() => handleOpenMemberDialog(team)}>
                          <PersonAddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit Team">
                        <IconButton size="small" onClick={() => handleOpenTeamDialog(team)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Team">
                        <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(team)}>
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
      )}

      {/* Team Create/Edit Dialog */}
      <Dialog open={teamDialogOpen} onClose={handleCloseTeamDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTeam ? 'Edit Team' : 'Create Team'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Team Name"
            fullWidth
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <TextField
            label="Description (optional)"
            fullWidth
            multiline
            rows={2}
            value={teamDescription}
            onChange={(e) => setTeamDescription(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" sx={{ mb: 1, color: theme.palette.text.secondary }}>
            Team Color
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {TEAM_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setTeamColor(color)}
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: color,
                  cursor: 'pointer',
                  border: teamColor === color ? '3px solid' : '2px solid transparent',
                  borderColor: teamColor === color ? theme.palette.text.primary : 'transparent',
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'scale(1.1)' },
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseTeamDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveTeam} disabled={!teamName.trim() || saving}>
            {saving ? <CircularProgress size={20} /> : editingTeam ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={memberDialogOpen} onClose={handleCloseMemberDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Member to {selectedTeam?.name}</DialogTitle>
        <DialogContent>
          {selectedTeam && selectedTeam.members.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mb: 1 }}>
                Current Members
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {selectedTeam.members.map((member) => (
                  <Chip
                    key={member.id}
                    label={member.user?.name || member.user?.email || 'Unknown'}
                    onDelete={() => handleRemoveMember(selectedTeam, member.user_id)}
                    deleteIcon={
                      removingMember === member.user_id ? (
                        <CircularProgress size={16} />
                      ) : (
                        <PersonRemoveIcon fontSize="small" />
                      )
                    }
                    disabled={removingMember === member.user_id}
                    sx={{ '& .MuiChip-deleteIcon': { color: theme.palette.error.main } }}
                  />
                ))}
              </Box>
            </Box>
          )}
          <Autocomplete
            options={availableUsers}
            loading={loadingUsers}
            getOptionLabel={(option) => option.name || option.email}
            value={selectedUser}
            onChange={(_, value) => setSelectedUser(value)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select User to Add"
                placeholder="Search users..."
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingUsers ? <CircularProgress size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <Box>
                  <Typography variant="body2">{option.name || 'Unnamed'}</Typography>
                  <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                    {option.email}
                  </Typography>
                </Box>
              </Box>
            )}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMemberDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleAddMember} disabled={!selectedUser || saving}>
            {saving ? <CircularProgress size={20} /> : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Team</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the team &quot;{selectedTeam?.name}&quot;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteTeam} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

