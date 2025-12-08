'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import type { ScopeOfWork } from '@/types/project';
import SOWMemberList from './SOWMemberList';
import SOWMemberSelector from './SOWMemberSelector';
import type { SOWMemberWithStats } from '@/types/project';

interface SOWFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<ScopeOfWork>) => Promise<void>;
  sow?: ScopeOfWork | null;
  projectId?: string;
  opportunityId?: string;
}

export default function SOWForm({ open, onClose, onSubmit, sow, projectId, opportunityId }: SOWFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'review' | 'approved' | 'active' | 'completed' | 'archived'>('draft');
  const [objectives, setObjectives] = useState<string[]>(['']);
  const [deliverables, setDeliverables] = useState<string[]>(['']);
  const [assumptions, setAssumptions] = useState<string[]>(['']);
  const [constraints, setConstraints] = useState<string[]>(['']);
  const [exclusions, setExclusions] = useState<string[]>(['']);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [sowMembers, setSowMembers] = useState<SOWMemberWithStats[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberSelectorOpen, setMemberSelectorOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (sow) {
        setTitle(sow.title);
        setDescription(sow.description || '');
        setStatus(sow.status);
        setObjectives(sow.objectives.length > 0 ? sow.objectives : ['']);
        setDeliverables(sow.deliverables.length > 0 ? sow.deliverables : ['']);
        setAssumptions(sow.assumptions.length > 0 ? sow.assumptions : ['']);
        setConstraints(sow.constraints.length > 0 ? sow.constraints : ['']);
        setExclusions(sow.exclusions.length > 0 ? sow.exclusions : ['']);
        setAcceptanceCriteria(sow.acceptance_criteria.length > 0 ? sow.acceptance_criteria : ['']);
        setStartDate(sow.timeline?.start_date || '');
        setEndDate(sow.timeline?.end_date || '');
        setEstimatedHours(sow.budget?.estimated_hours?.toString() || '');
        setHourlyRate(sow.budget?.hourly_rate?.toString() || '');
        
        // Load SOW members if SOW exists and projectId is available (skip for opportunity-based SOWs)
        if (sow.id && projectId && !opportunityId) {
          loadSOWMembers(sow.id);
        } else {
          setSowMembers([]);
        }
      } else {
        setTitle('');
        setDescription('');
        setStatus('draft');
        setObjectives(['']);
        setDeliverables(['']);
        setAssumptions(['']);
        setConstraints(['']);
        setExclusions(['']);
        setAcceptanceCriteria(['']);
        setStartDate('');
        setEndDate('');
        setEstimatedHours('');
        setHourlyRate('');
        setSowMembers([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sow, projectId, opportunityId]);

  const loadSOWMembers = async (sowId: string) => {
    if (!projectId) return;
    
    setMembersLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/sow/${sowId}/members`);
      if (response.ok) {
        const data = await response.json();
        setSowMembers(data.members || []);
      }
    } catch (error) {
      console.error('[SOWForm] Error loading members:', error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleMemberAdd = async (members: Array<{ project_member_id: string; organization_role_id: string; notes?: string }>) => {
    if (!sow?.id || !projectId || opportunityId) return; // Skip for opportunity-based SOWs

    try {
      // Add each member
      for (const member of members) {
        const response = await fetch(`/api/projects/${projectId}/sow/${sow.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(member),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to add member');
        }
      }

      // Reload members
      await loadSOWMembers(sow.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add members');
    }
  };

  const handleMemberRemove = async (memberId: string) => {
    if (!sow?.id || !projectId || opportunityId) return; // Skip for opportunity-based SOWs
    await loadSOWMembers(sow.id);
  };

  const handleMemberUpdate = async (memberId: string) => {
    if (!sow?.id || !projectId || opportunityId) return; // Skip for opportunity-based SOWs
    await loadSOWMembers(sow.id);
  };

  const addItem = (setter: (items: string[]) => void, items: string[]) => {
    setter([...items, '']);
  };

  const updateItem = (setter: (items: string[]) => void, items: string[], index: number, value: string) => {
    const newItems = [...items];
    newItems[index] = value;
    setter(newItems);
  };

  const removeItem = (setter: (items: string[]) => void, items: string[], index: number) => {
    setter(items.filter((_, i) => i !== index));
  };

  const renderListField = (
    label: string,
    items: string[],
    setter: (items: string[]) => void
  ) => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <IconButton size="small" onClick={() => addItem(setter, items)}>
          <AddIcon fontSize="small" />
        </IconButton>
      </Box>
      {items.map((item, index) => (
        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            fullWidth
            size="small"
            value={item}
            onChange={(e) => updateItem(setter, items, index, e.target.value)}
            placeholder={`${label} ${index + 1}`}
          />
          {items.length > 1 && (
            <IconButton
              size="small"
              onClick={() => removeItem(setter, items, index)}
              color="error"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const timeline: { start_date?: string; end_date?: string } = {};
      if (startDate) timeline.start_date = startDate;
      if (endDate) timeline.end_date = endDate;

      const budget: { estimated_hours?: number; hourly_rate?: number; total_budget?: number } = {};
      if (estimatedHours) budget.estimated_hours = parseFloat(estimatedHours);
      if (hourlyRate) budget.hourly_rate = parseFloat(hourlyRate);
      if (budget.estimated_hours && budget.hourly_rate) {
        budget.total_budget = budget.estimated_hours * budget.hourly_rate;
      }

      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        objectives: objectives.filter(o => o.trim()),
        deliverables: deliverables.filter(d => d.trim()),
        assumptions: assumptions.filter(a => a.trim()),
        constraints: constraints.filter(c => c.trim()),
        exclusions: exclusions.filter(e => e.trim()),
        acceptance_criteria: acceptanceCriteria.filter(a => a.trim()),
        timeline: Object.keys(timeline).length > 0 ? (timeline as NonNullable<ScopeOfWork['timeline']>) : undefined,
        budget: Object.keys(budget).length > 0 ? (budget as NonNullable<ScopeOfWork['budget']>) : undefined,
      });
      onClose();
    } catch (error) {
      console.error('Error submitting SOW:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {sow ? 'Edit Scope of Work' : 'Create Scope of Work'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            multiline
            rows={3}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'draft' | 'review' | 'approved' | 'active' | 'completed' | 'archived')}
              label="Status"
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="review">Review</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Estimated Hours"
              type="number"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(e.target.value)}
              fullWidth
            />
            <TextField
              label="Hourly Rate"
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              fullWidth
            />
          </Box>

          {renderListField('Objectives', objectives, setObjectives)}
          {renderListField('Deliverables', deliverables, setDeliverables)}
          {renderListField('Assumptions', assumptions, setAssumptions)}
          {renderListField('Constraints', constraints, setConstraints)}
          {renderListField('Exclusions', exclusions, setExclusions)}
          {renderListField('Acceptance Criteria', acceptanceCriteria, setAcceptanceCriteria)}

          {/* Team Members Section - Only show if SOW exists and projectId is available */}
          {sow?.id && projectId && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Team Members
              </Typography>
              <SOWMemberList
                sowId={sow.id}
                projectId={projectId}
                members={sowMembers}
                onAdd={() => setMemberSelectorOpen(true)}
                onRemove={handleMemberRemove}
                onUpdate={handleMemberUpdate}
                loading={membersLoading}
              />
            </Box>
          )}
        </Box>
      </DialogContent>

      {/* Member Selector Dialog */}
      {sow?.id && projectId && (
        <SOWMemberSelector
          projectId={projectId}
          sowId={sow.id}
          selectedMembers={sowMembers.map(m => ({
            project_member_id: m.project_member_id,
            organization_role_id: m.organization_role_id,
            notes: m.notes || undefined,
          }))}
          onChange={handleMemberAdd}
          open={memberSelectorOpen}
          onClose={() => setMemberSelectorOpen(false)}
        />
      )}
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !title.trim()}
        >
          {loading ? 'Saving...' : sow ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

