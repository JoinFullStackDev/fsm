'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Tabs,
  Tab,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Paper,
  Divider,
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  AutoAwesome as AutoAwesomeIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type {
  StakeholderUpdate,
  Stakeholder,
  CreateStakeholderUpdateInput,
  UpdateType,
  ApprovalStatus,
} from '@/types/workspace-extended';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function StakeholderUpdatesPage() {
  const params = useParams();
  const router = useRouter();
  const theme = useTheme();
  const projectId = params.projectId as string;

  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updates, setUpdates] = useState<StakeholderUpdate[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<StakeholderUpdate | null>(null);
  const [formData, setFormData] = useState<Partial<CreateStakeholderUpdateInput>>({
    update_type: 'email',
    title: '',
    summary: '',
    full_content: '',
    stakeholder_ids: [],
  });
  const [aiFormData, setAiFormData] = useState({
    update_type: 'email' as UpdateType,
    stakeholder_ids: [] as string[],
    tone: 'formal' as 'formal' | 'casual' | 'technical',
    key_points: '',
  });

  useEffect(() => {
    fetchUpdates();
    fetchStakeholders();
  }, [projectId]);

  const fetchUpdates = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/stakeholders/updates`);
      if (response.ok) {
        const data = await response.json();
        setUpdates(data.updates);
      }
    } catch (error) {
      console.error('Error fetching updates:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStakeholders = async () => {
    try {
      const response = await fetch(`/api/workspaces/${projectId}/stakeholders`);
      if (response.ok) {
        const data = await response.json();
        setStakeholders(data.stakeholders);
      }
    } catch (error) {
      console.error('Error fetching stakeholders:', error);
    }
  };

  const handleOpenDialog = (update?: StakeholderUpdate) => {
    if (update) {
      setEditingUpdate(update);
      setFormData({
        update_type: update.update_type,
        title: update.title,
        summary: update.summary || '',
        full_content: update.full_content || '',
        stakeholder_ids: update.stakeholder_ids,
      });
    } else {
      setEditingUpdate(null);
      setFormData({
        update_type: 'email',
        title: '',
        summary: '',
        full_content: '',
        stakeholder_ids: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUpdate(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingUpdate) {
        const response = await fetch(
          `/api/workspaces/${projectId}/stakeholders/updates/${editingUpdate.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          }
        );
        if (response.ok) {
          await fetchUpdates();
          handleCloseDialog();
        }
      } else {
        const response = await fetch(
          `/api/workspaces/${projectId}/stakeholders/updates`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, workspace_id: projectId }),
          }
        );
        if (response.ok) {
          await fetchUpdates();
          handleCloseDialog();
        }
      }
    } catch (error) {
      console.error('Error saving update:', error);
    }
  };

  const handleGenerateAIDraft = async () => {
    setAiLoading(true);
    try {
      const keyPointsArray = aiFormData.key_points
        .split('\n')
        .filter(p => p.trim())
        .map(p => p.trim());

      const response = await fetch(
        `/api/workspaces/${projectId}/stakeholders/updates/draft-ai`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            update_type: aiFormData.update_type,
            stakeholder_ids: aiFormData.stakeholder_ids,
            tone: aiFormData.tone,
            key_points: keyPointsArray.length > 0 ? keyPointsArray : undefined,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFormData({
          ...formData,
          update_type: data.draft.update_type,
          title: data.draft.title,
          summary: data.draft.summary,
          full_content: data.draft.full_content,
          stakeholder_ids: data.draft.stakeholder_ids,
        });
        setAiDialogOpen(false);
        setDialogOpen(true);
      }
    } catch (error) {
      console.error('Error generating AI draft:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleDelete = async (updateId: string) => {
    if (!confirm('Are you sure you want to delete this update?')) return;

    try {
      const response = await fetch(
        `/api/workspaces/${projectId}/stakeholders/updates/${updateId}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        await fetchUpdates();
      }
    } catch (error) {
      console.error('Error deleting update:', error);
    }
  };

  const renderUpdateCard = (update: StakeholderUpdate) => {
    const selectedStakeholders = stakeholders.filter(s =>
      update.stakeholder_ids.includes(s.id)
    );

    return (
      <Card key={update.id} sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Chip label={update.update_type} size="small" color="primary" />
                {update.approval_status && (
                  <Chip label={update.approval_status} size="small" variant="outlined" />
                )}
              </Box>
              <Typography variant="h6">{update.title}</Typography>
              {update.summary && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {update.summary}
                </Typography>
              )}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Recipients: {selectedStakeholders.map(s => s.name).join(', ') || 'None selected'}
                </Typography>
              </Box>
              {update.sent_date && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Sent: {new Date(update.sent_date).toLocaleDateString()}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<EditIcon />} onClick={() => handleOpenDialog(update)}>
                Edit
              </Button>
              <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(update.id)}>
                Delete
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push(`/workspace/${projectId}/stakeholders`)}
          sx={{ fontWeight: 600 }}
        >
          Back to Stakeholders
        </Button>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => setAiDialogOpen(true)}
          >
            AI Draft Update
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            New Update
          </Button>
        </Box>
      </Box>

      <Typography variant="h4" gutterBottom>
        Stakeholder Updates & Communication
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Track and manage all stakeholder communications and updates.
      </Typography>

      <Box sx={{ mt: 3 }}>
        {updates.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No updates yet. Create your first update to start communicating with stakeholders.
            </Typography>
          </Paper>
        ) : (
          updates.map(renderUpdateCard)
        )}
      </Box>

      {/* AI Draft Dialog */}
      <Dialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>AI-Powered Update Drafting</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Update Type</InputLabel>
                <Select
                  value={aiFormData.update_type}
                  label="Update Type"
                  onChange={(e) => setAiFormData({ ...aiFormData, update_type: e.target.value as UpdateType })}
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="meeting">Meeting</MenuItem>
                  <MenuItem value="demo">Demo</MenuItem>
                  <MenuItem value="presentation">Presentation</MenuItem>
                  <MenuItem value="report">Report</MenuItem>
                  <MenuItem value="slack">Slack</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Tone</InputLabel>
                <Select
                  value={aiFormData.tone}
                  label="Tone"
                  onChange={(e) => setAiFormData({ ...aiFormData, tone: e.target.value as any })}
                >
                  <MenuItem value="formal">Formal</MenuItem>
                  <MenuItem value="casual">Casual</MenuItem>
                  <MenuItem value="technical">Technical</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Autocomplete
                multiple
                options={stakeholders}
                getOptionLabel={(option) => option.name}
                value={stakeholders.filter(s => aiFormData.stakeholder_ids.includes(s.id))}
                onChange={(_, newValue) => {
                  setAiFormData({ ...aiFormData, stakeholder_ids: newValue.map(s => s.id) });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Select Stakeholders" placeholder="Choose recipients" />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Key Points to Include (one per line)"
                value={aiFormData.key_points}
                onChange={(e) => setAiFormData({ ...aiFormData, key_points: e.target.value })}
                placeholder="e.g., Launch date moved to Q2&#10;Positive user feedback from beta&#10;Need approval for additional budget"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleGenerateAIDraft}
            variant="contained"
            startIcon={aiLoading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            disabled={aiLoading || aiFormData.stakeholder_ids.length === 0}
          >
            {aiLoading ? 'Generating...' : 'Generate Draft'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingUpdate ? 'Edit Update' : 'New Stakeholder Update'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Update Type</InputLabel>
                <Select
                  value={formData.update_type}
                  label="Update Type"
                  onChange={(e) => setFormData({ ...formData, update_type: e.target.value as UpdateType })}
                >
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="meeting">Meeting</MenuItem>
                  <MenuItem value="demo">Demo</MenuItem>
                  <MenuItem value="presentation">Presentation</MenuItem>
                  <MenuItem value="report">Report</MenuItem>
                  <MenuItem value="slack">Slack</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                multiple
                options={stakeholders}
                getOptionLabel={(option) => option.name}
                value={stakeholders.filter(s => formData.stakeholder_ids?.includes(s.id))}
                onChange={(_, newValue) => {
                  setFormData({ ...formData, stakeholder_ids: newValue.map(s => s.id) });
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Recipients" />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Summary"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={6}
                label="Full Content"
                value={formData.full_content}
                onChange={(e) => setFormData({ ...formData, full_content: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingUpdate ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

