'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import type { SOWMemberWithStats } from '@/types/project';

interface SOWMemberListProps {
  sowId: string;
  projectId: string;
  members: SOWMemberWithStats[];
  onAdd?: () => void;
  onRemove?: (memberId: string) => void;
  onUpdate?: (memberId: string, updates: { organization_role_id?: string; notes?: string }) => void;
  loading?: boolean;
}

export default function SOWMemberList({
  sowId,
  projectId,
  members,
  onAdd,
  onRemove,
  onUpdate,
  loading = false,
}: SOWMemberListProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<SOWMemberWithStats | null>(null);
  const [organizationRoles, setOrganizationRoles] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [notes, setNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  // Load organization roles when editing
  useEffect(() => {
    if (editDialogOpen && editingMember) {
      loadOrganizationRoles();
      setSelectedRoleId(editingMember.organization_role_id);
      setNotes(editingMember.notes || '');
    }
  }, [editDialogOpen, editingMember]);

  const loadOrganizationRoles = async () => {
    try {
      const response = await fetch('/api/organization/roles');
      if (response.ok) {
        const data = await response.json();
        setOrganizationRoles(data.roles || []);
      }
    } catch (error) {
      console.error('[SOWMemberList] Error loading organization roles:', error);
    }
  };

  const handleEdit = (member: SOWMemberWithStats) => {
    setEditingMember(member);
    setEditDialogOpen(true);
  };

  const handleDelete = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the SOW?')) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/sow/${sowId}/members?memberId=${memberId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove member');
      }

      if (onRemove) {
        onRemove(memberId);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  const handleUpdate = async () => {
    if (!editingMember) return;

    setUpdating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/sow/${sowId}/members`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingMember.id,
          organization_role_id: selectedRoleId,
          notes: notes.trim() || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update member');
      }

      if (onUpdate) {
        onUpdate(editingMember.id, {
          organization_role_id: selectedRoleId,
          notes: notes.trim() || undefined,
        });
      }

      setEditDialogOpen(false);
      setEditingMember(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update member');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (members.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
            No team members added to this SOW yet.
            {onAdd && (
              <>
                <br />
                <Button size="small" onClick={onAdd} sx={{ mt: 1 }}>
                  Add Team Members
                </Button>
              </>
            )}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Team Members</Typography>
            {onAdd && (
              <Button size="small" variant="outlined" onClick={onAdd}>
                Add Member
              </Button>
            )}
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Tasks</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => {
                  const userName = member.project_member?.user?.name || member.project_member?.user?.email || 'Unknown';
                  const roleName = member.role_name || 'Unknown';
                  const isOverworked = member.is_overworked || false;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>{userName}</TableCell>
                      <TableCell>
                        <Chip
                          label={roleName}
                          size="small"
                          color={member.organization_role ? 'primary' : 'default'}
                        />
                        {member.organization_role?.description && (
                          <Tooltip title={member.organization_role.description}>
                            <IconButton size="small" sx={{ ml: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">ℹ️</Typography>
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                            <Typography variant="body2">{member.task_count} tasks</Typography>
                            {member.task_count_by_status && (
                              <Typography variant="caption" color="text.secondary">
                                ({member.task_count_by_status.todo} todo, {member.task_count_by_status.in_progress} in progress)
                              </Typography>
                            )}
                          </Box>
                          {(member as any).total_estimated_hours !== undefined && (
                            <Typography variant="caption" color="text.secondary">
                              {(member as any).total_estimated_hours.toFixed(1)}h estimated
                              {(member as any).allocated_hours_per_week > 0 && (
                                <> / {(member as any).allocated_hours_per_week}h/week allocated</>
                              )}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        {isOverworked ? (
                          <Chip
                            icon={<WarningIcon />}
                            label="Overworked"
                            color="error"
                            size="small"
                          />
                        ) : (member as any).allocation_utilization !== undefined && (member as any).allocation_utilization > 0 ? (
                          <Chip
                            label={`${Math.round((member as any).allocation_utilization)}% allocated`}
                            color={(member as any).allocation_utilization >= 100 ? 'error' : (member as any).allocation_utilization >= 80 ? 'warning' : 'default'}
                            size="small"
                          />
                        ) : member.workload_summary ? (
                          <Chip
                            label={`${Math.round(member.workload_summary.utilization_percentage)}% utilized`}
                            color={member.workload_summary.utilization_percentage >= 80 ? 'warning' : 'default'}
                            size="small"
                          />
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No workload data
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(member)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {onRemove && (
                          <Tooltip title="Remove">
                            <IconButton size="small" onClick={() => handleDelete(member.id)} color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          {members.some(m => m.is_overworked) && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Some team members are overworked based on task estimates vs allocated hours. Consider redistributing tasks or adjusting allocations. This is a warning only - tasks can still be assigned.
            </Alert>
          )}
          {members.some((m: any) => m.allocation_utilization && m.allocation_utilization >= 80 && m.allocation_utilization < 100) && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Some team members are approaching their allocation limits. Monitor workload to prevent over-allocation.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Team Member</DialogTitle>
        <DialogContent>
          {editingMember && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {editingMember.project_member?.user?.name || editingMember.project_member?.user?.email || 'Unknown'}
              </Typography>

              <FormControl fullWidth>
                <InputLabel>Organization Role</InputLabel>
                <Select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  label="Organization Role"
                >
                  {organizationRoles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.name}
                      {role.description && ` - ${role.description}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Notes"
                multiline
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this member's role in the SOW"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={updating}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} variant="contained" disabled={updating}>
            {updating ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

