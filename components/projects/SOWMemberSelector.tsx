'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Checkbox,
  FormControlLabel,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Tooltip,
} from '@mui/material';
import { Warning as WarningIcon } from '@mui/icons-material';

interface ProjectMember {
  id: string;
  user_id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface OrganizationRole {
  id: string;
  name: string;
  description: string | null;
}

interface SelectedMember {
  project_member_id: string;
  organization_role_id: string;
  notes?: string;
}

interface SOWMemberSelectorProps {
  projectId: string;
  sowId?: string;
  selectedMembers: SelectedMember[];
  onChange: (members: SelectedMember[]) => void;
  open: boolean;
  onClose: () => void;
}

export default function SOWMemberSelector({
  projectId,
  sowId,
  selectedMembers,
  onChange,
  open,
  onClose,
}: SOWMemberSelectorProps) {
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [organizationRoles, setOrganizationRoles] = useState<OrganizationRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memberTaskCounts, setMemberTaskCounts] = useState<Map<string, number>>(new Map());
  const [memberWorkloads, setMemberWorkloads] = useState<Map<string, { is_over_allocated: boolean; utilization_percentage: number }>>(new Map());
  const [localSelections, setLocalSelections] = useState<Map<string, { roleId: string; notes: string }>>(new Map());

  // Initialize local selections from selectedMembers prop
  useEffect(() => {
    if (open) {
      const selections = new Map<string, { roleId: string; notes: string }>();
      selectedMembers.forEach(m => {
        selections.set(m.project_member_id, {
          roleId: m.organization_role_id,
          notes: m.notes || '',
        });
      });
      setLocalSelections(selections);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedMembers]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load project members
      const membersResponse = await fetch(`/api/projects/${projectId}/members`);
      if (!membersResponse.ok) {
        throw new Error('Failed to load project members');
      }
      const membersData = await membersResponse.json();
      setProjectMembers(membersData.members || []);

      // Load organization roles
      const rolesResponse = await fetch('/api/organization/roles');
      if (rolesResponse.ok) {
        const rolesData = await rolesResponse.json();
        setOrganizationRoles(rolesData.roles || []);
      }

      // Load task counts and workloads for members
      const userIds = (membersData.members || []).map((m: ProjectMember) => m.user_id);
      if (userIds.length > 0) {
        // Get task counts
        const tasksResponse = await fetch(`/api/projects/${projectId}/tasks`);
        if (tasksResponse.ok) {
          const tasksData = await tasksResponse.json();
          const tasks = tasksData.tasks || [];
          const counts = new Map<string, number>();
          userIds.forEach((userId: string) => {
            const count = tasks.filter((t: any) => t.assignee_id === userId && t.status !== 'archived').length;
            counts.set(userId, count);
          });
          setMemberTaskCounts(counts);
        }

        // Get workload summaries (simplified - could be enhanced)
        // For now, we'll just mark as overworked if task count > 10
        const workloads = new Map<string, { is_over_allocated: boolean; utilization_percentage: number }>();
        userIds.forEach((userId: string) => {
          const taskCount = memberTaskCounts.get(userId) || 0;
          workloads.set(userId, {
            is_over_allocated: taskCount > 10,
            utilization_percentage: Math.min((taskCount / 10) * 100, 100),
          });
        });
        setMemberWorkloads(workloads);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberToggle = (memberId: string, checked: boolean) => {
    const newSelections = new Map(localSelections);
    if (checked) {
      // Get default role (first org role or use project member role)
      const member = projectMembers.find(m => m.id === memberId);
      const defaultRoleId = organizationRoles.length > 0 ? organizationRoles[0].id : '';
      newSelections.set(memberId, {
        roleId: defaultRoleId,
        notes: '',
      });
    } else {
      newSelections.delete(memberId);
    }
    setLocalSelections(newSelections);
  };

  const handleRoleChange = (memberId: string, roleId: string) => {
    const newSelections = new Map(localSelections);
    const current = newSelections.get(memberId);
    if (current) {
      newSelections.set(memberId, {
        ...current,
        roleId,
      });
    }
    setLocalSelections(newSelections);
  };

  const handleNotesChange = (memberId: string, notes: string) => {
    const newSelections = new Map(localSelections);
    const current = newSelections.get(memberId);
    if (current) {
      newSelections.set(memberId, {
        ...current,
        notes,
      });
    }
    setLocalSelections(newSelections);
  };

  const handleSave = () => {
    const members: SelectedMember[] = Array.from(localSelections.entries()).map(([memberId, data]) => ({
      project_member_id: memberId,
      organization_role_id: data.roleId,
      notes: data.notes.trim() || undefined,
    }));
    onChange(members);
    onClose();
  };

  const isMemberSelected = (memberId: string) => localSelections.has(memberId);
  const getMemberSelection = (memberId: string) => localSelections.get(memberId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Select Team Members</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select project members to add to the SOW team. Assign organization roles to help with AI task assignment.
            </Typography>

            {projectMembers.length === 0 ? (
              <Alert severity="info">No project members found. Add members to the project first.</Alert>
            ) : (
              <List>
                {projectMembers.map((member, index) => {
                  const isSelected = isMemberSelected(member.id);
                  const selection = getMemberSelection(member.id);
                  const userName = member.user.name || member.user.email;
                  const taskCount = memberTaskCounts.get(member.user_id) || 0;
                  const workload = memberWorkloads.get(member.user_id);
                  const isOverworked = workload?.is_over_allocated || false;

                  return (
                    <Box key={member.id}>
                      <ListItem>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={isSelected}
                              onChange={(e) => handleMemberToggle(member.id, e.target.checked)}
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1">{userName}</Typography>
                              <Chip label={member.role} size="small" />
                              <Typography variant="caption" color="text.secondary">
                                {taskCount} tasks
                              </Typography>
                              {isOverworked && (
                                <Tooltip title="This member is overworked">
                                  <Chip
                                    icon={<WarningIcon />}
                                    label="Overworked"
                                    color="error"
                                    size="small"
                                  />
                                </Tooltip>
                              )}
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          {workload && (
                            <Chip
                              label={`${Math.round(workload.utilization_percentage)}%`}
                              color={workload.utilization_percentage >= 80 ? 'warning' : 'default'}
                              size="small"
                              sx={{ mr: 1 }}
                            />
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>

                      {isSelected && (
                        <Box sx={{ pl: 4, pr: 2, pb: 2 }}>
                          <FormControl fullWidth size="small" sx={{ mb: 1 }}>
                            <InputLabel>Organization Role</InputLabel>
                            <Select
                              value={selection?.roleId || ''}
                              onChange={(e) => handleRoleChange(member.id, e.target.value)}
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
                            fullWidth
                            size="small"
                            label="Notes (optional)"
                            multiline
                            rows={2}
                            value={selection?.notes || ''}
                            onChange={(e) => handleNotesChange(member.id, e.target.value)}
                            placeholder="Optional notes about this member's role"
                          />
                        </Box>
                      )}

                      {index < projectMembers.length - 1 && <Divider />}
                    </Box>
                  );
                })}
              </List>
            )}

            {Array.from(localSelections.values()).some(s => {
              const member = projectMembers.find(m => localSelections.has(m.id));
              const userId = member?.user_id;
              return userId && memberWorkloads.get(userId)?.is_over_allocated;
            }) && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Some selected members are overworked. Consider redistributing tasks before adding them to the SOW.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={localSelections.size === 0}>
          Save ({localSelections.size} selected)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

